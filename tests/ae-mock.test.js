/* Runs host/main.jsx + render.jsx against a recording mock of the After
 * Effects scripting DOM. It cannot prove AE semantics, but it catches
 * runtime errors (typos, wrong call shapes, bad values) in every chart
 * variant, and checks key invariants of what would be created. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EXT } = require('./load');

function makeAE() {
    const log = { layers: 0, props: 0, keys: 0, exprs: [], textExprs: [], badValues: [], egp: [], colorExprs: 0 };
    function checkVal(v, where) {
        const flat = Array.isArray(v) ? v.flat(3) : [v];
        for (const x of flat) { if (typeof x === 'number' && !Number.isFinite(x)) { log.badValues.push(where); } }
    }
    function prop(name) {
        const kids = {};
        const p = {
            name, numKeys: 0, propertyValueType: 0, expression: '', value: {},
            property(n) { if (!kids[n]) { kids[n] = prop(n); } return kids[n]; },
            addProperty(m) { log.props++; const c = prop(m); kids[m + '#' + log.props] = c; const proxy = c; setTimeout(() => {}, 0); return trackName(proxy, kids); },
            setValue(v) { checkVal(v, name); },
            set expression(v) { log.exprs.push(v); if (/effect\(".*"\)\(1\)$/.test(v) && v.indexOf('DG Controller') >= 0) { log.colorExprs++; } }, get expression() { return ''; },
            canAddToMotionGraphicsTemplate() { return true; },
            addToMotionGraphicsTemplateAs(c, n) { assert.ok(c && typeof n === 'string' && n.length); log.egp.push(n); },
            setValueAtTime(t, v) { assert.ok(Number.isFinite(t), 'key time NaN on ' + name); checkVal(v, name + '@' + t); log.keys++; this.numKeys++; },
            nearestKeyIndex() { return 1; },
            setTemporalEaseAtKey(i, a, b) { assert.ok(a.length >= 1 && b.length === a.length); for (const e of a.concat(b)) { assert.ok(e.influence >= 0.1 && e.influence <= 100, 'influence ' + e.influence); } },
            setInterpolationTypeAtKey() {}, setSpatialAutoBezierAtKey() {}, setSpatialTangentsAtKey(i, a, b) { checkVal(a, 'tan'); checkVal(b, 'tan'); },
            moveToBeginning() {}
        };
        return p;
    }
    /* addProperty(...) then `.name = x` must make it findable by that name */
    function trackName(c, kids) {
        return new Proxy(c, { set(o, k, v) { o[k] = v; if (k === 'name') { kids[v] = o; } return true; } });
    }
    function layer(kind, comp) {
        log.layers++;
        const l = prop('layer:' + kind);
        l.transform = { position: prop('pos'), anchorPoint: prop('anchor'), opacity: prop('opacity'), scale: prop('scale') };
        const tkids = {};
        l.transform.property = (n) => { if (!tkids[n]) { tkids[n] = prop(n); } return tkids[n]; };
        l.parent = null; l.locked = false; l.comment = '';
        l.remove = () => { const i = comp.list.indexOf(l); if (i >= 0) { comp.list.splice(i, 1); comp.numLayers--; } };
        l.moveToBeginning = () => { const i = comp.list.indexOf(l); comp.list.splice(i, 1); comp.list.unshift(l); };
        comp.list.unshift(l);
        const tp = prop('ADBE Text Document'); tp.value = { resetCharStyle() {}, resetParagraphStyle() {} };
        Object.defineProperty(tp, 'expression', { set(v) { log.exprs.push(v); log.textExprs.push({ layer: l, expr: v }); }, get() { return ''; } });
        const posP = l.transform.position;
        Object.defineProperty(posP, 'expression', { set(v) { log.exprs.push(v); }, get() { return ''; } });
        const orig = l.property.bind(l);
        l.property = (n) => n === 'ADBE Text Properties' ? { property: () => tp } : orig(n);
        return l;
    }
    const CompItem = function CompItem() {};
    function makeComp(name, w, h) {
        const comp = Object.assign(Object.create(CompItem.prototype), {
            name, width: w || 1920, height: h || 1080, time: 2, numLayers: 0, comment: '', bgColor: null, list: [], selectedLayers: [],
            layer(i) { return comp.list[i - 1]; },
            layers: {
                addShape() { comp.numLayers++; return layer('shape', comp); },
                addText(s) { comp.numLayers++; assert.ok(typeof s === 'string'); const l = layer('text', comp); l.initialText = s; return l; },
                addSolid() { comp.numLayers++; return layer('solid', comp); },
                addNull() { comp.numLayers++; return layer('null', comp); },
                add(src) { comp.numLayers++; const l = layer('precomp', comp); l.source = src; return l; }
            },
            openInViewer() {}
        });
        return comp;
    }
    function FolderItem() {}
    const app = {
        version: '24.0-mock', project: {
            numItems: 0, item() { return null; },
            items: {
                addComp(name, w, h, par, dur, fps) { assert.ok(w > 0 && h > 0 && dur > 0 && fps > 0); const c = makeComp(name, w, h); log.lastComp = c; return c; },
                addFolder() { return new FolderItem(); }
            }
        },
        beginUndoGroup() {}, endUndoGroup() {}
    };
    function Shape() { this.vertices = []; }
    function KeyframeEase(speed, influence) { this.speed = speed; this.influence = influence; }
    return {
        log, makeComp, globals: {
            app, Shape, KeyframeEase, FolderItem, CompItem,
            KeyframeInterpolationType: { LINEAR: 6612, BEZIER: 6613 },
            PropertyValueType: { OneD: 1, TwoD: 2, ThreeD: 3, TwoD_SPATIAL: 4, ThreeD_SPATIAL: 5, COLOR: 6 },
            ParagraphJustification: { LEFT_JUSTIFY: 1, CENTER_JUSTIFY: 2, RIGHT_JUSTIFY: 3 },
            clamp: (v, a, b) => Math.min(b, Math.max(a, v))
        }
    };
}

function hostSandbox(ae) {
    const sb = Object.assign({ console }, ae.globals);
    sb.File = function (p) { this.fsName = p; this.exists = fs.existsSync(p); this.parent = { fsName: path.dirname(p) }; };
    sb.$ = { fileName: path.join(EXT, 'host', 'main.jsx'), evalFile: (f) => vm.runInContext(fs.readFileSync(f.fsName, 'utf8'), sb, { filename: f.fsName }) };
    sb.$.global = sb;
    sb.$.readFile = (f) => fs.readFileSync(f.fsName, 'utf8');
    vm.createContext(sb);
    // Real ExtendScript: $.evalFile runs the file in the CALLER's scope (like a
    // direct eval), not the global one. Emulate that faithfully.
    const main = fs.readFileSync(path.join(EXT, 'host', 'main.jsx'), 'utf8').replace(/\$\.evalFile\((\w+)\);/g, 'eval($.readFile($1));');
    vm.runInContext(main, sb);
    return sb;
}

let passed = 0, fail = 0;
const ae0 = makeAE(), sb0 = hostSandbox(ae0);
const init = sb0.DGHost.init(EXT);
assert.ok(init.indexOf('OK|') === 0, init);
const DG = sb0.DG;
for (const type of Object.keys(DG.VARIANTS)) {
    for (const v of DG.VARIANTS[type]) {
        for (const theme of ['docDark', 'neon', 'vintage']) {
            const ae = makeAE(), sb = hostSandbox(ae);
            sb.DGHost.init(EXT);
            const spec = Object.assign({}, DG.sample(type, v.id), { type, variant: v.id, theme });
            const res = sb.DGHost.build(JSON.stringify(spec));
            try {
                assert.ok(res.indexOf('OK|') === 0, res);
                assert.strictEqual(ae.log.badValues.length, 0, 'non-finite values: ' + ae.log.badValues.slice(0, 3));
                assert.ok(ae.log.keys > 0, 'no keyframes');
                for (const ex of ae.log.exprs) {
                    // every generated expression must be syntactically valid JavaScript
                    // eslint-disable-next-line no-new-func
                    new Function('effect', 'thisComp', 'time', 'clamp', ex);
                }
                passed++;
            } catch (e) { fail++; console.error('FAIL', type, v.id, theme, e.message); }
        }
    }
}
// Bangla + expression evaluation: the count-up expression prints the same as the preview
{
    const ae = makeAE(), sb = hostSandbox(ae);
    sb.DGHost.init(EXT);
    const spec = Object.assign({}, DG.sample('counter', 'single'), { type: 'counter', variant: 'single', options: { live: false }, format: { digits: 'bn', grouping: 'indian' } });
    sb.DGHost.build(JSON.stringify(spec));
    const ex = ae.log.exprs.find(e => e.indexOf('FROM') >= 0);
    // eslint-disable-next-line no-new-func
    const out = new Function('effect', 'return eval(' + JSON.stringify(ex) + ')')(() => () => 100);
    try { assert.strictEqual(out, '১৭,৩০,০০,০০০'); passed++; } catch (e) { fail++; console.error('FAIL expression value', e.message); }
}
/* Evaluate live expressions with the slider values: must match the preview. */
function evalExpr(ex, sliders, progress) {
    // any layer: has the sliders, and sits far right (a line tip at the end of its line)
    const ctrlLayer = { effect: (n) => () => { if (!(n in sliders)) { throw new Error('no slider ' + n); } return sliders[n]; }, transform: { position: [1e9, 0] } };
    const createPath = (p, i, o, c) => {
        assert.ok(p.length === i.length && p.length === o.length, 'createPath arrays differ');
        for (const q of p.concat(i, o)) { assert.ok(Number.isFinite(q[0]) && Number.isFinite(q[1]), 'bad path point ' + q); }
        return { pts: p, closed: c };
    };
    // eslint-disable-next-line no-new-func
    return new Function('thisComp', 'effect', 'time', 'clamp', 'createPath', 'return eval(' + JSON.stringify(ex) + ')')(
        { layer: () => ctrlLayer }, () => () => progress, 1e9, (v, a, b) => Math.min(b, Math.max(a, v)), createPath);
}
const S2 = require('./load').load(['client/js/preview.js']);
for (const [type, variant] of [['line', 'line'], ['line', 'smooth'], ['line', 'stepped'], ['line', 'area'], ['bar', 'column'], ['bar', 'horizontal'], ['bar', 'grouped'], ['pie', 'donut'], ['pie', 'semi'], ['pie', 'pie'], ['pie', 'rings'], ['counter', 'single'], ['counter', 'compare'], ['counter', 'cards']]) {
    try {
        const ae = makeAE(), sb = hostSandbox(ae);
        sb.DGHost.init(EXT);
        const spec = Object.assign({}, DG.sample(type, variant), { type, variant });
        const res = sb.DGHost.build(JSON.stringify(spec));
        assert.ok(res.indexOf('OK|') === 0, res);
        const scene = sb.DG.build(JSON.parse(JSON.stringify(spec)));
        assert.ok(scene.live && scene.live.cells.length > 0, 'no live cells');
        const sliders = { 'Axis Max (0 = auto)': 0 };
        for (const c of scene.live.cells) { sliders[c.name] = c.value; }
        // every expression evaluates without error, no NaN
        for (const ex of ae.log.exprs) {
            if (ex.indexOf('DocuGraph live data') < 0) { continue; }
            const v = evalExpr(ex, sliders, 100);
            const flat = v && v.pts ? v.pts.flat() : [].concat(v);
            assert.ok(flat.every(x => typeof x === 'string' || Number.isFinite(x)), 'bad value ' + JSON.stringify(v) + ' from\n' + ex);
        }
        // live text at the end == preview text at the end
        const liveTexts = scene.els.filter(e => e.type === 'text' && e.live);
        const exprs = ae.log.textExprs.filter(t => t.expr.indexOf('DocuGraph live data') >= 0);
        assert.strictEqual(exprs.length, liveTexts.length, 'live text count');
        const want = liveTexts.map(e => S2.DGPreview.textString(e, scene.duration)).sort();
        const got = exprs.map(t => evalExpr(t.expr, sliders, 100)).sort();
        assert.deepStrictEqual(Array.from(got, String), Array.from(want, String));
        // changing a slider changes the output
        const liveAll = ae.log.exprs.filter(e => e.indexOf('DocuGraph live data') >= 0);
        const snap = () => JSON.stringify(liveAll.map(e => evalExpr(e, sliders, 100)));
        for (const c of new Set([scene.live.cells[0], scene.live.cells[scene.live.cells.length - 1]])) {
            const before = snap();
            sliders[c.name] = c.value * 1.5 + 1;
            assert.notStrictEqual(snap(), before, 'slider ' + c.name + ' had no effect');
        }
        passed++;
    } catch (e) { fail++; console.error('FAIL live', type, variant, e.message.slice(0, 600)); }
}
/* The live line path in AE == the preview's path (same points + tangents) */
for (const variant of ['line', 'smooth', 'stepped']) {
    try {
        const ae = makeAE(), sb = hostSandbox(ae);
        sb.DGHost.init(EXT);
        const spec = Object.assign({}, DG.sample('line', variant), { type: 'line', variant });
        sb.DGHost.build(JSON.stringify(spec));
        const scene = sb.DG.build(JSON.parse(JSON.stringify(spec)));
        const sliders = { 'Axis Max (0 = auto)': 0 };
        for (const c of scene.live.cells) { sliders[c.name] = c.value; }
        const lines = scene.els.filter(e => e.type === 'path' && e.name.indexOf('Line ') === 0);
        const pathExprs = ae.log.exprs.filter(e => e.indexOf('createPath') >= 0);
        assert.strictEqual(pathExprs.length, lines.length);
        lines.forEach((el, i) => {
            const got = evalExpr(pathExprs[i], sliders, 100).pts;
            assert.strictEqual(got.length, el.pts.length, 'vertex count');
            got.forEach((q, k) => { assert.ok(Math.abs(q[0] - el.pts[k][0]) < 1e-6 && Math.abs(q[1] - el.pts[k][1]) < 1e-6, `vertex ${k}: ${q} vs ${el.pts[k]}`); });
        });
        passed++;
    } catch (e) { fail++; console.error('FAIL live path geometry', variant, e.message); }
}
/* Update in place: only DocuGraph layers are replaced, user layers survive */
try {
    const ae = makeAE(), sb = hostSandbox(ae);
    sb.DGHost.init(EXT);
    const spec = Object.assign({}, DG.sample('bar', 'column'), { type: 'bar', variant: 'column' });
    assert.ok(sb.DGHost.build(JSON.stringify(spec)).indexOf('OK|') === 0);
    const comp = ae.log.lastComp;
    sb.app.project.activeItem = comp;
    comp.comment = 'DocuGraph x\n{}';
    comp.layers.addSolid().comment = 'mine';
    const n1 = comp.numLayers;
    spec.data += '\nNepal\t30';
    const r = sb.DGHost.update(JSON.stringify(spec));
    assert.ok(r.indexOf('OK|') === 0, r);
    assert.ok(comp.list.some(l => l.comment === 'mine'), 'user layer removed');
    assert.ok(comp.numLayers > 1 && comp.numLayers !== n1, 'layers not rebuilt');
    assert.strictEqual(comp.list.filter(l => l.comment !== 'DocuGraph').length, 1);
    passed++;
} catch (e) { fail++; console.error('FAIL update', e.message); }
/* Motion-Bro style: insert into the active comp, Essential Graphics, edit via selected layer */
try {
    const ae = makeAE(), sb = hostSandbox(ae);
    sb.DGHost.init(EXT);
    const edit = ae.makeComp('My Edit', 3840, 2160);
    sb.app.project.activeItem = edit;
    const spec = Object.assign({}, DG.sample('pie', 'donut'), { type: 'pie', variant: 'donut', insert: true });
    const res = sb.DGHost.build(JSON.stringify(spec));
    assert.ok(res.indexOf('OK|') === 0, res);
    assert.strictEqual(res.split('|')[4], 'My Edit', 'not inserted: ' + res);
    const L = edit.list.find(l => l.source === ae.log.lastComp);
    assert.ok(L, 'precomp layer missing');
    for (const n of ['Title', 'Subtitle', 'Source', 'Text', 'Background', 'Chart Scale']) { assert.ok(ae.log.egp.includes(n), 'EGP missing ' + n + ' in ' + ae.log.egp); }
    assert.ok(ae.log.egp.includes('Natural gas'), 'data slider not in EGP');
    assert.ok(ae.log.colorExprs > 10, 'colours not linked: ' + ae.log.colorExprs);
    // select the precomp layer in the edit → Load / Update find the chart comp
    ae.log.lastComp.comment = 'DocuGraph x\n' + JSON.stringify(spec);
    edit.selectedLayers = [L];
    assert.ok(sb.DGHost.readActive().indexOf('OK|') === 0, 'readActive via selected layer');
    assert.ok(sb.DGHost.update(JSON.stringify(spec)).indexOf('OK|') === 0, 'update via selected layer');
    passed++;
} catch (e) { fail++; console.error('FAIL insert/EGP', e.message); }
console.log(`${passed} passed, ${fail} failed (mock AE render)`);
if (fail) { process.exitCode = 1; }
