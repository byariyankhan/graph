/* Data check: plain-language problems for the pasted table, and silence
 * for every built-in sample. */
const assert = require('assert');
const { load } = require('./load');

const S = load(['client/js/check.js']);
const C = S.DGCheck, DG = S.DG;
let passed = 0;
function t(name, fn) {
    try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e.message); process.exitCode = 1; }
}
const levels = (r) => Array.from(r, x => x.level);

t('empty data is an error', () => assert.deepStrictEqual(levels(C.check('bar', 'column', '')), ['error']));
t('too few columns', () => assert.ok(C.check('scatter', 'bubble', 'A\t1\t2\nB\t3\t4').some(x => x.level === 'error')));
t('non-number cell is named', () => {
    const r = C.check('bar', 'column', 'K\tV\nA\t1\nB\tabc');
    assert.ok(r.some(x => x.level === 'warn' && x.text.indexOf('abc') >= 0 && x.text.indexOf('Row 2') === 0));
});
t('only 3 bad cells listed, rest summed', () => {
    const r = C.check('bar', 'column', 'K\tV\nA\tx\nB\tx\nC\tx\nD\tx\nE\tx');
    assert.ok(r.some(x => x.text.indexOf('2 more cells') === 0));
});
t('repeated names', () => assert.ok(C.check('bar', 'column', 'K\tV\nA\t1\nA\t2').some(x => x.text.indexOf('Repeated name') === 0)));
t('negative pie values', () => assert.ok(C.check('pie', 'donut', 'K\tV\nA\t1\nB\t-2').some(x => x.text.indexOf('Negative') === 0)));
t('pie with many rows', () => {
    let d = 'K\tV'; for (let i = 0; i < 12; i++) { d += '\nR' + i + '\t' + (i + 1); }
    assert.ok(C.check('pie', 'donut', d).some(x => x.level === 'info'));
});
t('every sample passes without errors or warnings', () => {
    for (const type of DG.typeIds()) {
        for (const v of DG.VARIANTS[type]) {
            const smp = DG.sample(type, v.id);
            const bad = Array.from(C.check(type, v.id, smp.data)).filter(x => x.level !== 'info').map(x => x.text);
            assert.strictEqual(bad.length, 0, type + ':' + v.id + ' → ' + bad.join(' | '));
        }
    }
});

console.log(`${passed} check tests passed` + (process.exitCode ? ' — WITH FAILURES' : ''));
