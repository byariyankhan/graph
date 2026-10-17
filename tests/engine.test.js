/* Engine tests: formatting, parsing, scales, and a build of every
 * type × variant × theme with structural checks on the scene. */
const assert = require('assert');
const { load } = require('./load');

const S = load(['client/js/preview.js']);
const DG = S.DG;
let passed = 0;
function t(name, fn) {
    try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}

t('fmt intl grouping', () => assert.strictEqual(DG.fmt(1234567.891, { decimals: 2 }), '1,234,567.89'));
t('fmt compact en', () => assert.strictEqual(DG.fmt(4.6e11, { compact: 'en', decimals: 1, prefix: '$' }), '$460.0B'));
t('fmt compact words', () => assert.strictEqual(DG.fmt(23.9e6, { compact: 'words', decimals: 1 }), '23.9 million'));
t('fmt ref keeps unit', () => assert.strictEqual(DG.fmt(500, { compact: 'en', ref: 2e6, decimals: 3 }), '0.001M'));
t('fmt negative', () => assert.strictEqual(DG.fmt(-1500, { prefix: '$' }), '-$1,500'));
t('fmt no negative zero', () => assert.strictEqual(DG.fmt(-0.001, {}), '0'));
t('num parses currency + separators', () => assert.strictEqual(DG.num('$ 1,234'), 1234));
t('num suffix', () => assert.strictEqual(DG.num('4.6B'), 4.6e9));
t('num percent / parens', () => { assert.strictEqual(DG.num('12%'), 12); assert.strictEqual(DG.num('(5)'), -5); });
t('parse TSV with header', () => {
    const tb = DG.parseTable('Country\tPop\nIndia\t1441\nBangladesh\t174\n');
    assert.deepStrictEqual(Array.from(tb.headers), ['Country', 'Pop']);
    assert.strictEqual(tb.rows.length, 2);
});
t('parse CSV quoted', () => {
    const tb = DG.parseTable('Name,Value\n"Dhaka, BD",5\n');
    assert.strictEqual(tb.rows[0][0], 'Dhaka, BD');
});
t('parse header made of years', () => {
    const tb = DG.parseTable('Country\t1990\t2020\nBangladesh\t58\t72\nIndia\t58\t70');
    assert.deepStrictEqual(Array.from(tb.headers), ['Country', '1990', '2020']);
    assert.strictEqual(tb.rows.length, 2);
});
t('parse numeric data first row is not a header', () => assert.strictEqual(DG.parseTable('India\t1441\nChina\t1425').rows.length, 2));
t('parse headerless', () => assert.strictEqual(DG.parseTable('A,1\nB,2').rows.length, 2));
t('ticks nice', () => {
    const tk = DG.ticks(0, 1441, 5);
    assert.strictEqual(tk.min, 0); assert.ok(tk.max >= 1441); assert.ok(tk.ticks.length >= 4 && tk.ticks.length <= 8);
});
t('ease endpoints', () => { for (const e of ['out', 'smooth', 'easy', 'linear']) { assert.ok(Math.abs(DG.ease(e, 1) - 1) < 1e-6); assert.strictEqual(DG.ease(e, 0), 0); } });
t('ease monotonic', () => { let p = 0; for (let i = 1; i <= 100; i++) { const v = DG.ease('out', i / 100); assert.ok(v >= p - 1e-9); p = v; } });
t('overshoot peaks then settles', () => {
    const a = { t0: 0, t1: 1, ease: 'out', over: 1.12 };
    assert.ok(Math.abs(DG.animF(a, DG.OVER_MID) - 1.12) < 1e-6);
    assert.strictEqual(DG.animF(a, 1), 1);
});
t('toJSON roundtrip with unicode', () => {
    const o = { a: [1, 2.5, null], s: 'Dhaka "Caf\u00e9 \u2014 30\u00b0"\n', b: true };
    assert.deepStrictEqual(JSON.parse(DG.toJSON(o)), o);
});
t('FMT_SRC is self-contained (expression-safe)', () => {
    // eslint-disable-next-line no-new-func
    const f = new Function('return (' + DG.FMT_SRC + ')')();
    assert.strictEqual(f(1234.5, { decimals: 1, prefix: '$' }), '$1,234.5');
});

t('registry: every chart type is complete', () => {
    assert.deepStrictEqual(Array.from(DG.typeIds()).sort(), Object.keys(DG.VARIANTS).sort());
    for (const type of DG.typeIds()) {
        const T = DG.TYPES[type];
        assert.ok(T.label && T.icon && T.columns._ && T.ai._, type + ' metadata');
        for (const v of T.live) { assert.ok(DG.VARIANTS[type].some(x => x.id === v), type + ' live variant ' + v); }
        for (const v of DG.VARIANTS[type]) { assert.ok(DG.sample(type, v.id), type + ':' + v.id + ' sample'); }
    }
});
t('registry: live flag matches what the chart really does', () => {
    for (const type of DG.typeIds()) {
        for (const v of DG.VARIANTS[type]) {
            const sc = DG.build(Object.assign({}, DG.sample(type, v.id), { type, variant: v.id }));
            assert.strictEqual(!!sc.live, DG.isLive(type, v.id), type + ':' + v.id);
        }
    }
});

const TYPES = Object.keys(DG.VARIANTS);
let builds = 0;
for (const type of TYPES) {
    for (const v of DG.VARIANTS[type]) {
        for (const theme of DG.THEME_ORDER) {
            for (const size of [[1920, 1080], [1080, 1920]]) {
                t(`build ${type}:${v.id} ${theme} ${size}`, () => {
                    const smp = DG.sample(type, v.id);
                    const spec = Object.assign({}, smp, { type, variant: v.id, theme, width: size[0], height: size[1] });
                    const sc = DG.build(spec);
                    assert.ok(sc.els.length > 5, 'too few elements: ' + sc.els.length);
                    for (const el of sc.els) {
                        for (const k of ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'size', 'a0', 'a1']) {
                            if (el[k] !== undefined) { assert.ok(Number.isFinite(el[k]), `${el.name}.${k}=${el[k]}`); }
                        }
                        if (el.type === 'rect') { assert.ok(el.w >= 0 && el.h >= 0, el.name + ' negative size'); }
                        if (el.type === 'text') { assert.ok(el.fontAE && el.fontCSS, el.name + ' no font'); }
                        for (const a of el.anims) {
                            assert.ok(a.t1 > a.t0, el.name + ' anim ' + a.kind + ' bad times');
                            assert.ok(a.t1 <= sc.duration, el.name + ' anim beyond duration');
                        }
                    }
                    for (const tt of [0, 1.2, 2.5, sc.duration]) {
                        const svg = S.DGPreview.render(sc, tt);
                        assert.ok(svg.indexOf('NaN') < 0, 'NaN in svg at t=' + tt);
                        assert.ok(svg.indexOf('undefined') < 0, 'undefined in svg at t=' + tt);
                    }
                    builds++;
                });
            }
        }
    }
}

t('count text ends at exact final value', () => {
    const sc = DG.build(Object.assign({}, DG.sample('counter', 'single'), { type: 'counter', variant: 'single' }));
    const big = sc.els.find(e => e.name === 'Big Number');
    assert.strictEqual(S.DGPreview.textString(big, sc.duration), '173,000,000');
});
t('follow dot reaches last vertex', () => {
    const sc = DG.build(Object.assign({}, DG.sample('line', 'line'), { type: 'line', variant: 'line' }));
    const tip = sc.els.find(e => e.name.indexOf('Tip ') === 0);
    const fa = tip.anims.find(a => a.kind === 'follow');
    const p = S.DGPreview.followPos(fa, sc.duration);
    assert.deepStrictEqual(Array.from(p), Array.from(fa.pts[fa.pts.length - 1]));
});

console.log(`${passed} passed (${builds} full builds)` + (process.exitCode ? ' — WITH FAILURES' : ''));
