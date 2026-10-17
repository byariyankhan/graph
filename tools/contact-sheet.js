/* Renders preview frames of every chart variant into an HTML contact sheet
 * and (optionally) screenshots it with Playwright.
 *   node tools/contact-sheet.js [outDir] [theme] [time|end] [WxH]
 */
const fs = require('fs');
const path = require('path');
const { load } = require('../tests/load');

const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs', 'img'));
const theme = process.argv[3] || 'brand';
const when = process.argv[4] || 'end';
const size = (process.argv[5] || '1920x1080').split('x').map(Number);
fs.mkdirSync(out, { recursive: true });

const S = load(['client/js/preview.js']);
const DG = S.DG;
const cells = [];
for (const type of Object.keys(DG.VARIANTS)) {
    for (const v of DG.VARIANTS[type]) {
        const spec = Object.assign({}, DG.sample(type, v.id), { type, variant: v.id, theme, width: size[0], height: size[1] });
        const sc = DG.build(spec);
        const t = when === 'end' ? sc.duration : Number(when);
        cells.push(`<figure><div class="f" style="aspect-ratio:${size[0]}/${size[1]}">${S.DGPreview.render(sc, t)}</div><figcaption>${type} · ${v.label}</figcaption></figure>`);
    }
}
const cols = size[0] > size[1] ? 3 : 5;
const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#222;font:14px Arial;color:#ddd}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:10px}figure{margin:0}.f{background:#000}.f svg{display:block}
figcaption{padding:4px 2px}</style><div class="g">${cells.join('')}</div>`;
const file = path.join(out, `sheet-${theme}-${when}-${size.join('x')}.html`);
fs.writeFileSync(file, html);

(async () => {
    let chromium;
    try { ({ chromium } = require('playwright')); } catch (e) { console.log('wrote', file); return; }
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
    await page.goto('file://' + file);
    await page.screenshot({ path: file.replace('.html', '.png'), fullPage: true });
    await browser.close();
    console.log('wrote', file.replace('.html', '.png'));
})();
