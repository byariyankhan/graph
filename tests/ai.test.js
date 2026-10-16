/* AI helper: smart paste of typical chatbot answers, prompt building, and
 * the direct Claude call against a fake SDK (no network, no key). */
const assert = require('assert');
const { load } = require('./load');

const S = load(['client/js/ai.js']);
const AI = S.DGAI, DG = S.DG;
let passed = 0, failed = 0;
async function t(name, fn) {
    try { await fn(); passed++; } catch (e) { failed++; console.error('FAIL', name, '\n ', e.message); }
}
const rowsOf = (r) => r.data.split('\n').map(l => l.split('\t'));

(async () => {
    await t('markdown table + meta (ChatGPT style)', () => {
        const r = AI.smartParse([
            'Here is the data you asked for:',
            '',
            '**Title:** The South Asian race',
            '**Subtitle:** GDP per person, current US$',
            '**Source:** World Bank, World Development Indicators (2024)',
            '',
            '| Year | Bangladesh | India | Pakistan |',
            '|------|-----------:|------:|---------:|',
            '| 1990 | 306 | 368 | 371 |',
            '| 2000 | 418 | 443 | 534 |',
            '| 2023 | 2,551 | 2,481 | 1,365 |',
            '',
            'Notes: 2023 values are provisional.'
        ].join('\n'));
        assert.ok(r, 'not parsed');
        assert.strictEqual(r.title, 'The South Asian race');
        assert.strictEqual(r.source, 'Source: World Bank, World Development Indicators (2024)');
        assert.strictEqual(r.notes, '2023 values are provisional.');
        assert.strictEqual(r.rows, 3);
        assert.deepStrictEqual(rowsOf(r)[0], ['Year', 'Bangladesh', 'India', 'Pakistan']);
        // the chart engine reads the thousands separators correctly
        const sd = DG.seriesData(DG.parseTable(r.data));
        assert.strictEqual(sd.series[0].values[2], 2551);
    });
    await t('fenced TSV block (the format our prompt asks for)', () => {
        const r = AI.smartParse('Title: Who can read?\nSubtitle: Adult literacy, %\nSource: UNESCO (2022)\n```tsv\nGroup\tPercent\nCan read and write\t76\n```\nNotes: none');
        assert.strictEqual(r.rows, 1);
        assert.strictEqual(r.title, 'Who can read?');
        assert.deepStrictEqual(rowsOf(r)[1], ['Can read and write', '76']);
    });
    await t('fenced CSV with quotes', () => {
        const r = AI.smartParse('```csv\nCountry,Population (M)\n"Congo, Dem. Rep.",102\nBangladesh,173\n```');
        assert.deepStrictEqual(rowsOf(r)[1], ['Congo, Dem. Rep.', '102']);
    });
    await t('JSON array of objects', () => {
        const r = AI.smartParse('```json\n[{"country":"India","value":1441},{"country":"China","value":1425}]\n```');
        assert.deepStrictEqual(rowsOf(r), [['country', 'value'], ['India', '1441'], ['China', '1425']]);
    });
    await t('JSON wrapped in an object', () => {
        const r = AI.smartParse('{"data": [["Year","A"],[1990,5],[2000,7]]}');
        assert.strictEqual(r.rows, 2);
    });
    await t('Bangla meta labels + footnote marks + bold cells', () => {
        const r = AI.smartParse('শিরোনাম: জনসংখ্যা\nসূত্র: বিবিএস\n| দেশ | জনসংখ্যা |\n|---|---|\n| **বাংলাদেশ** | 173[1] |\n| নেপাল | 30 |');
        assert.strictEqual(r.title, 'জনসংখ্যা');
        assert.strictEqual(r.source, 'সূত্র: বিবিএস');
        assert.deepStrictEqual(rowsOf(r)[1], ['বাংলাদেশ', '173']);
    });
    await t('prose only → null', () => { assert.strictEqual(AI.smartParse('Sorry, I could not find reliable data.'), null); });
    await t('every chart type has a table-shape instruction', () => {
        for (const type of Object.keys(DG.VARIANTS)) {
            for (const v of DG.VARIANTS[type]) {
                const p = AI.buildPrompt({ ask: 'x', type, variant: v.id, typeLabel: type, variantLabel: v.label, example: 'a\tb' });
                assert.ok(p.indexOf(AI.shape(type, v.id)) > 0);
                assert.ok(/Never guess/.test(p) && /```tsv/.test(p) && /Source:/.test(p));
            }
        }
    });
    await t('prompt asks for Bangla labels when ticked', () => {
        assert.ok(/বাংলা/.test(AI.buildPrompt({ ask: 'x', type: 'bar', variant: 'column', typeLabel: 'Bar', variantLabel: 'Column', bangla: true })));
    });

    /* ---- direct Claude call with a fake SDK ---- */
    function fakeSDK(script) {
        const calls = [];
        class APIError extends Error { constructor(m, status) { super(m); this.status = status; } }
        class AuthenticationError extends APIError {}
        class PermissionDeniedError extends APIError {}
        class RateLimitError extends APIError {}
        class APIConnectionError extends APIError {}
        function Anthropic(opts) {
            assert.strictEqual(opts.dangerouslyAllowBrowser, true);
            this.beta = { messages: { stream: (params) => { calls.push(JSON.parse(JSON.stringify(params))); const step = script[calls.length - 1]; return { finalMessage: async () => { if (step instanceof Error) { throw step; } return step; } }; } } };
        }
        Object.assign(Anthropic, { APIError, AuthenticationError, PermissionDeniedError, RateLimitError, APIConnectionError });
        return { Anthropic, calls };
    }
    const answer = 'Title: T\nSource: World Bank\n```tsv\nYear\tA\n1990\t1\n2000\t2\n```';
    await t('generate: request shape (model, web search, fallbacks, effort)', async () => {
        const f = fakeSDK([{ stop_reason: 'end_turn', content: [{ type: 'server_tool_use' }, { type: 'text', text: answer }] }]);
        const text = await AI.generate('sk-test', 'PROMPT', null, f.Anthropic);
        assert.strictEqual(text, answer);
        const c = f.calls[0];
        assert.strictEqual(c.model, 'claude-opus-5-5');
        assert.deepStrictEqual(c.betas, ['server-side-fallback-2026-07-01']);
        assert.strictEqual(c.fallbacks, 'default');
        assert.strictEqual(c.tools[0].type, 'web_search_20260209');
        assert.strictEqual(c.output_config.effort, 'medium');
        assert.ok(!('thinking' in c), 'thinking must be omitted on Opus 5.5');
        assert.ok(AI.smartParse(text).rows === 2);
    });
    await t('generate: pause_turn is continued with the assistant turn', async () => {
        const paused = { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 's1' }] };
        const f = fakeSDK([paused, { stop_reason: 'end_turn', content: [{ type: 'text', text: answer }] }]);
        await AI.generate('k', 'P', null, f.Anthropic);
        assert.strictEqual(f.calls.length, 2);
        const m = f.calls[1].messages;
        assert.strictEqual(m.length, 2);
        assert.strictEqual(m[1].role, 'assistant');
        assert.deepStrictEqual(m[1].content, paused.content);
    });
    await t('generate: refusal becomes a readable error', async () => {
        const f = fakeSDK([{ stop_reason: 'refusal', stop_details: { explanation: 'policy' }, content: [] }]);
        await assert.rejects(AI.generate('k', 'P', null, f.Anthropic), /declined.*policy/);
    });
    await t('errorText maps typed SDK errors', () => {
        const f = fakeSDK([]);
        assert.ok(/key not accepted/.test(AI.errorText(new f.Anthropic.AuthenticationError('x', 401), f.Anthropic)));
        assert.ok(/Rate limited/.test(AI.errorText(new f.Anthropic.RateLimitError('x', 429), f.Anthropic)));
        assert.ok(/API error 500/.test(AI.errorText(new f.Anthropic.APIError('boom', 500), f.Anthropic)));
    });

    console.log(`${passed} passed, ${failed} failed (AI helper)`);
    if (failed) { process.exitCode = 1; }
})();
