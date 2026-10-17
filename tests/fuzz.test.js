/* Robustness: every chart variant must survive bad / edge-case data without
 * NaN, undefined or a crash, live and static. */
const { load } = require('./load');
const S = load(['client/js/preview.js']); const DG = S.DG;
const DATA = {
  empty: '', blank: '\n\n', headerOnly: 'A\tB', oneRow: 'X\t5', oneCol: 'Label\nA\nB',
  text: 'A\tB\nfoo\tbar\nbaz\tqux', zeros: 'A\tB\nx\t0\ny\t0', neg: 'A\tB\nx\t-5\ny\t3\nz\t-10',
  huge: 'A\tB\nx\t4.6e14\ny\t1e15', tiny: 'A\tB\nx\t0.0001\ny\t0.0003', dup: 'A\tB\nx\t1\nx\t2\nx\t3',
  mixed: 'Year\tA\tB\n1990\t1\t\n2000\t\t5\n2010\t3\t7', long: 'A\tB\n' + Array.from({length: 60}, (_, i) => 'Item ' + i + '\t' + (i * 7 % 23)).join('\n'),
  wide: 'Y\t' + Array.from({length: 25}, (_, i) => 'S' + i).join('\t') + '\n2000\t' + Array.from({length: 25}, (_, i) => i).join('\t') + '\n2010\t' + Array.from({length: 25}, (_, i) => 25 - i).join('\t'),
  same: 'A\tB\nx\t5\ny\t5\nz\t5', single: 'A\tB\nonly\t42', unicode: 'Name\tV\nCôte d’Ivoire\t3\nSão Tomé\t4', quotes: 'A\tB\n"He said ""hi"""\t5\nx\t2',
};
let bad = [];
for (const type of Object.keys(DG.VARIANTS)) for (const v of DG.VARIANTS[type]) for (const [dn, d] of Object.entries(DATA)) {
  for (const live of [true, false]) {
    try {
      const sc = DG.build({ type, variant: v.id, data: d, title: 'T', options: { live } });
      for (const el of sc.els) for (const k of ['x','y','w','h','x1','y1','x2','y2','cx','cy','r','size','a0','a1','inner'])
        if (el[k] !== undefined && !Number.isFinite(el[k])) throw new Error(`${el.name}.${k}=${el[k]}`);
      for (const t of [0.5, 2, sc.duration]) { const svg = S.DGPreview.render(sc, t); if (/NaN|undefined|Infinity/.test(svg)) throw new Error('bad svg @' + t + ' ' + (svg.match(/.{40}(NaN|undefined|Infinity).{20}/)||[''])[0]); }
      if (sc.live) for (const c of sc.live.cells) if (!Number.isFinite(c.value)) throw new Error('live cell ' + c.name + '=' + c.value);
      if (!(sc.duration > 0 && sc.duration < 600)) throw new Error('duration ' + sc.duration);
    } catch (e) { bad.push(`${type}:${v.id} [${dn}${live?'':' static'}] ${e.message.slice(0,140)}`); }
  }
}
console.log(bad.length ? bad.slice(0, 20).join('\n') : ''); console.log((bad.length ? bad.length + ' FAILED' : 'all passed') + ' (bad-data fuzz: every variant x 16 data shapes x live/static)'); if (bad.length) { process.exitCode = 1; }
