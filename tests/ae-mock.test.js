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
    const log = { layers: 0, props: 0, keys: 0, exprs: [], badValues: [] };
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
    function layer(kind) {
        log.layers++;
        const l = prop('layer:' + kind);
        l.transform = { position: prop('pos'), anchorPoint: prop('anchor'), opacity: prop('opacity'), scale: prop('scale') };
        l.parent = null; l.locked = false;
        const tp = prop('ADBE Text Document'); tp.value = { resetCharStyle() {}, resetParagraphStyle() {} };
        Object.defineProperty(tp, 'expression', { set(v) { log.exprs.push(v); }, get() { return ''; } });
        const posP = l.transform.position;
        Object.defineProperty(posP, 'expression', { set(v) { log.exprs.push(v); }, get() { return ''; } });
        const orig = l.property.bind(l);
        l.property = (n) => n === 'ADBE Text Properties' ? { property: () => tp } : orig(n);
        return l;
    }
    const comp = {
        name: '', numLayers: 0, comment: '', bgColor: null,
        layers: {
            addShape() { comp.numLayers++; return layer('shape'); },
            addText(s) { comp.numLayers++; assert.ok(typeof s === 'string'); return layer('text'); },
            addSolid() { comp.numLayers++; return layer('solid'); },
            addNull() { comp.numLayers++; return layer('null'); }
        },
        openInViewer() {}
    };
    function FolderItem() {}
    const app = {
        version: '24.0-mock', project: {
            numItems: 0, item() { return null; },
            items: {
                addComp(name, w, h, par, dur, fps) { assert.ok(w > 0 && h > 0 && dur > 0 && fps > 0); comp.name = name; return comp; },
                addFolder() { return new FolderItem(); }
            }
        },
        beginUndoGroup() {}, endUndoGroup() {}
    };
    function Shape() { this.vertices = []; }
    function KeyframeEase(speed, influence) { this.speed = speed; this.influence = influence; }
    return {
        log, globals: {
            app, Shape, KeyframeEase, FolderItem, CompItem: function () {},
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
    vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(EXT, 'host', 'main.jsx'), 'utf8'), sb);
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
    const spec = Object.assign({}, DG.sample('counter', 'single'), { type: 'counter', variant: 'single', format: { digits: 'bn', grouping: 'indian' } });
    sb.DGHost.build(JSON.stringify(spec));
    const ex = ae.log.exprs.find(e => e.indexOf('FROM') >= 0);
    // eslint-disable-next-line no-new-func
    const out = new Function('effect', 'return eval(' + JSON.stringify(ex) + ')')(() => () => 100);
    try { assert.strictEqual(out, '১৭,৩০,০০,০০০'); passed++; } catch (e) { fail++; console.error('FAIL expression value', e.message); }
}
console.log(`${passed} passed, ${fail} failed (mock AE render)`);
if (fail) { process.exitCode = 1; }
