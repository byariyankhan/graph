/*
 * DocuGraph — AI data helper.
 *
 *  1. buildPrompt()  → a prompt tailored to the current chart type, for any
 *                      chatbot (ChatGPT, Claude, Gemini …). No key needed.
 *  2. smartParse()   → reads whatever the AI answers (markdown table, fenced
 *                      TSV/CSV, JSON, plain CSV) plus Title / Subtitle /
 *                      Source lines, and returns clean tab-separated data.
 *  3. generate()     → optional: asks Claude directly (user's own API key)
 *                      with web search, so numbers come from real sources.
 */
(function (root) {
    var AI = {};

    /* ------------------------------------------------------------ prompts */
    var SHAPES = {
        bar: 'First column = category (e.g. country). One more column per series (e.g. one per year). One row per category.',
        line: 'First column = year (or date), oldest first. One column per series (e.g. one per country). One row per year.',
        pie: 'Two columns: label, value. Values are parts of one whole (they may be percentages that add up to about 100).',
        counter: 'Columns: label, value, start value (optional — where the count-up should start, e.g. an earlier year). One row per number.',
        timeline: 'Columns: year (or date), event title, short note (max 6 words). One row per event, oldest first.',
        'timeline:eras': 'Columns: start year, end year, period name. One row per period, oldest first.',
        pyramid: 'Columns: age group (youngest first, e.g. 0-4, 5-9 …), male, female. Values as % of total population or in people.',
        race: 'First column = year, oldest first. One column per entity (e.g. country). One row per year. Include enough entities (8–15) and years to make a race.',
        scatter: 'Columns: label, x value, y value, size value, group (e.g. region). Put the real measure names in the header row.',
        'scatter:scatter': 'Columns: label, x value, y value, group (optional). Put the real measure names in the header row.',
        'scatter:gapminder': 'Long format. Columns: entity, year, x value, y value, size value, group (e.g. region). One row per entity per year; the same years for every entity.',
        waffle: 'Columns: label, value. One row with a single percentage (e.g. 76) — or several rows that are parts of one whole.',
        compare: 'Columns: label, value then, value now. Put the two periods (e.g. 1990, 2020) as the header names.',
        'compare:waterfall': 'Columns: step, value. First row = the starting total, then one row per change (+ or −). Do not add the final total.',
        'compare:diverging': 'Columns: label, change. Changes can be positive or negative.',
        gauge: 'Columns: label, value, maximum of the scale, target (optional).'
    };
    AI.shape = function (type, variant) { return SHAPES[type + ':' + variant] || SHAPES[type] || SHAPES.bar; };

    AI.buildPrompt = function (o) {
        var lines = [
            'I am making an animated chart for a documentary video. Find the data for:',
            '"' + String(o.ask || '').trim() + '"',
            '',
            'Chart: ' + o.typeLabel + ' (' + o.variantLabel + ').',
            'Table shape: ' + AI.shape(o.type, o.variant),
            '',
            'Rules:',
            '- Use reliable, citable sources (World Bank, IMF, UN, WHO, national statistics offices, etc.). Prefer one consistent source for the whole table.',
            '- Never guess or invent numbers. If a value is unknown, leave the cell empty.',
            '- Numbers only in data cells: plain digits with a decimal point if needed, no thousands separators, no units, no currency signs (put units in the subtitle).',
            '- Keep labels short and in English.',
            '',
            'Answer in exactly this format:',
            'Title: <short headline, max 6 words>',
            'Subtitle: <what is measured, unit, years>',
            'Source: <source name(s), and year of the data>',
            '```tsv',
            '<header row>',
            '<data rows, columns separated by TAB characters>',
            '```',
            'Notes: <anything estimated or missing, one line>'
        ];
        if (o.example) { lines.push('', 'Example of the expected columns (replace with real data):', '```tsv', o.example, '```'); }
        return lines.join('\n');
    };

    /* -------------------------------------------------------- smart paste */
    function trim(s) { return String(s).replace(/^[\s ﻿]+|[\s ﻿]+$/g, ''); }
    function cleanCell(c) {
        c = trim(c).replace(/^\*\*(.*)\*\*$/, '$1').replace(/^`(.*)`$/, '$1').replace(/\[(\d+|[a-z])\]/g, '');
        return trim(c.replace(/\t/g, ' '));
    }
    function toTSV(rows) {
        return rows.filter(function (r) { return r.some(function (c) { return trim(c) !== ''; }); })
            .map(function (r) { return r.map(cleanCell).join('\t'); }).join('\n');
    }
    function fromMarkdown(lines) {
        var rows = [];
        lines.forEach(function (l) {
            if (!/^\s*\|/.test(l)) { return; }
            if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)) { return; }
            var cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
            rows.push(cells);
        });
        return rows;
    }
    function fromJSON(txt) {
        var data;
        try { data = JSON.parse(txt); } catch (e) { return null; }
        if (data && !Array.isArray(data)) {
            var arr = null;
            Object.keys(data).forEach(function (k) { if (!arr && Array.isArray(data[k])) { arr = data[k]; } });
            data = arr;
        }
        if (!Array.isArray(data) || !data.length) { return null; }
        if (Array.isArray(data[0])) { return data.map(function (r) { return r.map(String); }); }
        if (typeof data[0] === 'object') {
            var keys = Object.keys(data[0]);
            return [keys].concat(data.map(function (r) { return keys.map(function (k) { return r[k] === null || r[k] === undefined ? '' : String(r[k]); }); }));
        }
        return null;
    }
    function fromDelimited(txt) {
        var tb = root.DG.parseTable(txt);
        if (!tb.rows.length) { return null; }
        return [tb.headers].concat(tb.rows);
    }

    /* Returns { data, title, subtitle, source, notes, rows } (data = TSV) or null. */
    AI.smartParse = function (text) {
        text = String(text || '').replace(/\r\n?/g, '\n');
        if (!trim(text)) { return null; }
        var out = { title: '', subtitle: '', source: '', notes: '' };
        var meta = { title: /^(?:#+\s*)?\**\s*(title)\s*\**\s*[:：]\s*(.+)$/i, subtitle: /^\**\s*(subtitle|subheading)\s*\**\s*[:：]\s*(.+)$/i, source: /^\**\s*(sources?)\s*\**\s*[:：]\s*(.+)$/i, notes: /^\**\s*(notes?)\s*\**\s*[:：]\s*(.+)$/i };
        var body = [];
        text.split('\n').forEach(function (l) {
            var hit = false;
            Object.keys(meta).forEach(function (k) {
                var m = !hit && meta[k].exec(trim(l));
                if (m) { out[k] = trim(m[2].replace(/\*\*/g, '')); hit = true; }
            });
            if (!hit) { body.push(l); }
        });
        if (out.source && !/^source/i.test(out.source)) { out.source = 'Source: ' + out.source; }
        var rest = body.join('\n'), rows = null;

        /* 1. fenced code blocks */
        var fence = /```[a-zA-Z]*\n([\s\S]*?)```/g, m2;
        while (!rows && (m2 = fence.exec(rest))) {
            var inner = m2[1];
            rows = /^\s*[\[{]/.test(inner) ? fromJSON(inner) : (/^\s*\|/m.test(inner) ? fromMarkdown(inner.split('\n')) : fromDelimited(inner));
            if (rows && rows.length < 2) { rows = null; }
        }
        /* 2. markdown table */
        if (!rows) { var md = fromMarkdown(rest.split('\n')); if (md.length >= 2) { rows = md; } }
        /* 3. bare JSON */
        if (!rows) { var js = rest.match(/[\[{][\s\S]*[\]}]/); if (js) { rows = fromJSON(js[0]); } }
        /* 4. tab / comma separated lines */
        if (!rows) {
            var tabular = rest.split('\n').filter(function (l) { return /\t/.test(l) || (l.split(',').length > 1 && !/[.!?]\s*$/.test(trim(l))); });
            if (tabular.length >= 2) { rows = fromDelimited(tabular.join('\n')); }
        }
        if (!rows || rows.length < 2) { return null; }
        out.data = toTSV(rows);
        out.rows = rows.length - 1;
        return out;
    };

    /* Copy text: Clipboard API where allowed, textarea fallback for CEP. */
    AI.copy = function (text) {
        var fallback = function () {
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            document.body.removeChild(ta);
            return ok;
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
        }
        return Promise.resolve(fallback());
    };

    /* ------------------------------------------------ direct Claude call
     * Official Anthropic SDK (bundled at js/vendor/anthropic.js). Runs in the
     * panel on the user's own machine with the user's own key.
     * - claude-opus-5-5 with web search so figures come from real sources
     * - server-side refusal fallback enabled ("default" routing)
     * - pause_turn (long web searches) is continued automatically */
    AI.MODEL = 'claude-opus-5-5';
    AI.generate = async function (apiKey, prompt, onStatus, SDK) {
        var Anthropic = SDK || root.Anthropic;
        if (!Anthropic) { throw new Error('Claude SDK not loaded'); }
        var client = new Anthropic({ apiKey: apiKey, dangerouslyAllowBrowser: true });
        var messages = [{ role: 'user', content: prompt + '\n\nSearch the web for current, sourced figures before answering.' }];
        for (var round = 0; round < 4; round++) {
            if (onStatus) { onStatus(round ? 'Still researching…' : 'Claude is searching the web…'); }
            var stream = client.beta.messages.stream({
                model: AI.MODEL,
                max_tokens: 16000,
                betas: ['server-side-fallback-2026-07-01'],
                fallbacks: 'default',
                output_config: { effort: 'medium' },
                tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
                messages: messages
            });
            var msg = await stream.finalMessage();
            if (msg.stop_reason === 'refusal') {
                throw new Error('Claude declined this request' + (msg.stop_details && msg.stop_details.explanation ? ': ' + msg.stop_details.explanation : ''));
            }
            if (msg.stop_reason === 'pause_turn') {
                /* the server paused a long search — send the turn back to continue */
                messages = messages.concat([{ role: 'assistant', content: msg.content }]);
                continue;
            }
            var text = msg.content.filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
            if (msg.stop_reason === 'max_tokens' && !/```[\s\S]*```/.test(text)) { throw new Error('The answer was cut off — ask for fewer rows'); }
            return text;
        }
        throw new Error('Research took too long — try a narrower request');
    };

    /* Friendly message for SDK errors (typed classes, most specific first). */
    AI.errorText = function (e, SDK) {
        var A = SDK || root.Anthropic;
        if (A && e instanceof A.AuthenticationError) { return 'API key not accepted — check it at console.anthropic.com'; }
        if (A && e instanceof A.PermissionDeniedError) { return 'This key cannot use web search — enable it in the Claude Console'; }
        if (A && e instanceof A.RateLimitError) { return 'Rate limited — wait a minute and try again'; }
        if (A && e instanceof A.APIConnectionError) { return 'No connection to Claude — check the internet'; }
        if (A && e instanceof A.APIError) { return 'Claude API error ' + (e.status || '') + ': ' + e.message; }
        return e && e.message ? e.message : String(e);
    };

    root.DGAI = AI;
    if (typeof module !== 'undefined' && module.exports) { module.exports = AI; }
}(typeof window !== 'undefined' ? window : globalThis));
