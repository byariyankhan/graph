/*
 * DocuGraph — After Effects renderer (ExtendScript, ES3).
 *
 * Converts a scene from DG.build() into a native, fully editable comp:
 *   - every chart element is a shape layer (or a group inside a shared layer)
 *   - every label is a real text layer
 *   - animation = ordinary keyframes with the same easing as the preview,
 *     so editors can retime everything in the Graph Editor
 *   - count-up numbers = a "Progress" slider (0→100, keyframed) + a Source
 *     Text expression; the start/end values sit at the top of the expression
 *   - all layers are parented to "DG Controller" (a null at comp centre) so
 *     the whole chart can be moved / scaled at once
 */
var DGAE = (function () {
    var comp, ctrl, W, H, layerMap, nameCount, glowDone, LIVE, COLORS, EGP_TEXT, BYID;
    var AXIS_MAX = 'Axis Max (0 = auto)';

    function P(x, y) { return [x - W / 2, y - H / 2]; }
    function rgb(hex) { return DG.hexToRgb(hex); }
    function rgba(hex) { var c = DG.hexToRgb(hex); return [c[0], c[1], c[2], 1]; }
    function mixv(a, b, t) {
        if (typeof a === 'number') { return a + (b - a) * t; }
        var r = [];
        for (var i = 0; i < a.length; i++) { r.push(a[i] + (b[i] - a[i]) * t); }
        return r;
    }
    function findA(el, kind) {
        for (var i = 0; i < el.anims.length; i++) { if (el.anims[i].kind === kind) { return el.anims[i]; } }
        return null;
    }
    function uniqueName(n) {
        n = String(n).substring(0, 60);
        if (!nameCount.hasOwnProperty(n)) { nameCount[n] = 1; return n; }
        nameCount[n] += 1;
        return n + ' ' + nameCount[n];
    }

    /* ------------------------------------------------------------ keyframes */

    function easeDims(prop) {
        var t = prop.propertyValueType;
        if (t === PropertyValueType.TwoD) { return 2; }
        if (t === PropertyValueType.ThreeD) { return 3; }
        return 1;
    }
    function applyEase(prop, ki, e) {
        if (!e) {
            prop.setInterpolationTypeAtKey(ki, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
            return;
        }
        var tries = [easeDims(prop), 1, 2, 3], k, d;
        for (k = 0; k < tries.length; k++) {
            var ins = [], outs = [];
            for (d = 0; d < tries[k]; d++) { ins.push(new KeyframeEase(0, e.i)); outs.push(new KeyframeEase(0, e.o)); }
            try { prop.setTemporalEaseAtKey(ki, ins, outs); return; } catch (err) { /* try next dimension count */ }
        }
    }
    function setKeys(prop, keys, e) {
        var k;
        for (k = 0; k < keys.length; k++) { prop.setValueAtTime(keys[k][0], keys[k][1]); }
        for (k = 0; k < keys.length; k++) { applyEase(prop, prop.nearestKeyIndex(keys[k][0]), e); }
    }
    /* Two keys (three with overshoot) exactly matching DG.animF. */
    function animKeys(prop, a, v0, v1) {
        var keys = [[a.t0, v0]];
        if (a.over) { keys.push([a.t0 + (a.t1 - a.t0) * DG.OVER_MID, mixv(v0, v1, a.over)]); }
        keys.push([a.t1, v1]);
        setKeys(prop, keys, DG.easeDef(a.ease));
    }

    /* ------------------------------------------------------------ live data
     * Each data value is a slider on "DG Controller". Live elements read
     * them through expressions, so changing a slider re-draws bars, slices,
     * labels and the axis. A per-layer "Progress" slider (keyframed) keeps
     * the entrance animation. */
    function liveHead() {
        return '// DocuGraph live data: edit the sliders on "DG Controller"\n' +
            'var C = thisComp.layer("DG Controller");\nvar F = ' + LIVE.factor + ';\n' +
            'function V(n) { return C.effect(n)(1) * F; }\n';
    }
    function vref(ci) { return 'V(' + DG.quote(LIVE.cells[ci].name) + ')'; }
    function vArr(cells) {
        var a = [];
        for (var i = 0; i < cells.length; i++) { a.push(vref(cells[i])); }
        return '[' + a.join(', ') + ']';
    }
    function maxCode(mx) {
        return 'var MX = (function () { var a = ' + vArr(mx.cells) + ', m = 0, i; for (i = 0; i < a.length; i++) { if (Math.abs(a[i]) > m) { m = Math.abs(a[i]); } }\n' +
            (mx.nice ? '  var o = C.effect("' + AXIS_MAX + '")(1) * F; if (o > 0) { return o; }\n  return (' + DG.NICEMAX_SRC + ')(m);'
                : '  return m > 0 ? m : 1;') + ' })();\n';
    }
    /* tot / cum / vI for slice-based kinds */
    function sliceCode(lv) {
        return 'var a = ' + vArr(lv.cells) + ', tot = 0, cum = 0, i;\n' +
            'for (i = 0; i < a.length; i++) { var x = Math.max(0, a[i]); tot += x; if (i < ' + lv.index + ') { cum += x; } }\n' +
            'if (tot <= 0) { tot = 1; }\nvar vI = Math.max(0, a[' + lv.index + ']);\n';
    }
    var PROG = 'var p = effect("Progress")(1) / 100;\n';
    var PROG01 = 'var p = clamp(effect("Progress")(1) / 100, 0, 1);\n';
    function addProgress(l, a) {
        var sl = l.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
        sl.name = 'Progress';
        if (a) { animKeys(l.property('ADBE Effect Parade').property('Progress').property(1), a, 0, 100); } else { l.property('ADBE Effect Parade').property('Progress').property(1).setValue(100); }
    }
    function liveSliders(scene) {
        var fx = ctrl.property('ADBE Effect Parade'), i, needAxis = false;
        for (i = 0; i < scene.els.length; i++) {
            var lv = scene.els[i].live;
            if (lv && ((lv.max && lv.max.nice) || (lv.pos && lv.pos.max && lv.pos.max.nice))) { needAxis = true; }
        }
        for (i = 0; i < LIVE.cells.length; i++) {
            var sl = fx.addProperty('ADBE Slider Control');
            sl.name = LIVE.cells[i].name;
            ctrl.property('ADBE Effect Parade').property(LIVE.cells[i].name).property(1).setValue(LIVE.cells[i].value);
        }
        if (needAxis) {
            var ax = ctrl.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
            ax.name = AXIS_MAX;
        }
    }
    /* Text value + position expressions for a live text element. */
    function liveTextExpr(el) {
        var lv = el.live, fmt = lv.fmt || (el.count ? el.count.fmt : {}), code = liveHead(), X, ref = null;
        if (lv.kind === 'tick') {
            code += maxCode(lv.max); X = 'MX * ' + lv.frac; ref = 'MX';
        } else if (lv.kind === 'value') {
            var from = lv.from || 0;
            code += PROG01; X = from + ' + (' + vref(lv.cell) + ' - ' + from + ') * p'; ref = vref(lv.cell);
        } else if (lv.kind === 'pct') {
            code += PROG01 + sliceCode(lv); X = 'vI / tot * 100 * p';
        } else if (lv.kind === 'tipValue') {
            var dotEl = BYID[lv.dot];
            code += 'var x = thisComp.layer(' + DG.quote(dotEl && dotEl.aeLayerName ? dotEl.aeLayerName : '') + ').transform.position[0] + ' + (W / 2) + ';\n' +
                'var X = ' + DG.toJSON(lv.xs) + ', A = ' + vArr(lv.cells) + ', v = A[0], k;\n' +
                'if (x >= X[X.length - 1]) { v = A[A.length - 1]; } else { for (k = 0; k < X.length - 1; k++) { if (x < X[k + 1]) { v = x <= X[k] ? A[k] : ' +
                (lv.step ? 'A[k]' : 'A[k] + (A[k + 1] - A[k]) * (x - X[k]) / (X[k + 1] - X[k])') + '; break; } } }\n';
            X = 'v';
        } else if (lv.kind === 'sum') {
            code += PROG01 + 'var a = ' + vArr(lv.cells) + ', s = 0, i; for (i = 0; i < a.length; i++) { s += a[i]; }\n'; X = 's * p'; ref = 's';
        }
        code += 'var O = ' + DG.toJSON(fmt) + ';\n';
        if (ref && fmt.ref !== undefined) { code += 'O.ref = ' + ref + ';\n'; }
        return code + '(' + DG.FMT_SRC + ')(' + X + ', O);';
    }
    /* Live line / area path rebuilt from the sliders (same smoothing as the preview). */
    function linePathExpr(lv) {
        var zeros = 'var t = { i: [], o: [] }; for (i = 0; i < p.length; i++) { t.i.push([0, 0]); t.o.push([0, 0]); }\n';
        return liveHead() + maxCode(lv.max) +
            'var X = ' + DG.toJSON(lv.xs) + ', A = ' + vArr(lv.cells) + ', B = ' + lv.base + ', L = ' + lv.len + ', p = [], i;\n' +
            'for (i = 0; i < X.length; i++) { p.push([X[i], B - A[i] / MX * L]); }\n' +
            (lv.step ? 'var q = []; for (i = 0; i < p.length; i++) { if (i > 0) { q.push([p[i][0], q[q.length - 1][1]]); } q.push(p[i]); } p = q;\n' : '') +
            (lv.smooth ? 'var t = (' + DG.SMOOTH_SRC + ')(p);\n' : zeros) +
            (lv.area ? 'p.push([X[X.length - 1], B]); p.push([X[0], B]); t.i.push([0, 0], [0, 0]); t.o.push([0, 0], [0, 0]);\n' : '') +
            'createPath(p, t.i, t.o, ' + (lv.area ? 'true' : 'false') + ');';
    }

    function livePosExpr(pos) {
        var code = liveHead();
        if (pos.kind === 'barEnd') {
            code += maxCode(pos.max) + PROG01 + 'var L = ' + vref(pos.cell) + ' / MX * ' + pos.len + ' * p;\n';
            if (pos.dir === 'up') { return code + '[' + (pos.at - W / 2) + ', ' + pos.base + ' - L - ' + pos.off + ' - ' + (H / 2) + '];'; }
            return code + '[' + pos.base + ' + L + ' + pos.off + ' - ' + (W / 2) + ', ' + (pos.at - H / 2) + '];';
        }
        if (pos.kind === 'sliceMid') {
            return code + sliceCode(pos) + 'var mid = (' + pos.start + ' + ' + pos.span + ' * (cum + vI / 2) / tot) * Math.PI / 180;\n' +
                '[' + pos.cx + ' + Math.sin(mid) * ' + pos.r + ' - ' + (W / 2) + ', ' + pos.cy + ' - Math.cos(mid) * ' + pos.r + ' + ' + pos.dy + ' - ' + (H / 2) + '];';
        }
        return null;
    }

    /* Multi-key animation → keyframes; mapFn turns each value into the
     * property value (e.g. a width into a rect size). */
    function multiKeys(prop, a, mapFn) {
        var keys = [];
        for (var k = 0; k < a.times.length; k++) { keys.push([a.times[k], mapFn(a.vals[k])]); }
        setKeys(prop, keys, DG.easeDef(a.ease));
    }
    function findKeys(el, propName) {
        for (var i = 0; i < el.anims.length; i++) {
            if (el.anims[i].kind === 'keys' && el.anims[i].prop === propName) { return el.anims[i]; }
        }
        return null;
    }

    /* --------------------------------------------------------- shape layers */

    function newShapeLayer(name) {
        var l = comp.layers.addShape();
        l.name = uniqueName(name);
        l.parent = ctrl;
        l.transform.anchorPoint.setValue([0, 0]);
        l.transform.position.setValue(P(0, 0));
        return l;
    }
    function shapeLayerFor(el) {
        if (el.layer) {
            if (!layerMap.hasOwnProperty(el.layer)) { layerMap[el.layer] = newShapeLayer(el.layer); }
            return layerMap[el.layer];
        }
        return newShapeLayer(el.name);
    }
    function root(l) { return l.property('ADBE Root Vectors Group'); }
    function grp(l, g) { return root(l).property(g); }
    function gc(l, g) { return grp(l, g).property('ADBE Vectors Group'); }
    function gt(l, g) { return grp(l, g).property('ADBE Vector Transform Group'); }
    function addTo(l, g, match, name) { var p = gc(l, g).addProperty(match); p.name = name; }
    function item(l, g, name) { return gc(l, g).property(name); }

    function makeShape(pts, inT, outT, closed, dx, dy) {
        var s = new Shape(), v = [], i;
        for (i = 0; i < pts.length; i++) { v.push([pts[i][0] - (dx || 0), pts[i][1] - (dy || 0)]); }
        s.vertices = v; s.inTangents = inT; s.outTangents = outT; s.closed = !!closed;
        return s;
    }
    /* Circle path that starts at 12 o'clock and runs clockwise. */
    function circleShape(cx, cy, r) {
        var k = 0.5522847 * r;
        return makeShape([[cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]],
            [[-k, 0], [0, -k], [k, 0], [0, k]], [[k, 0], [0, k], [-k, 0], [0, -k]], true);
    }
    /* ---------------------------------------------------------------- colours
     * Every colour used becomes a Color Control on DG Controller (named by
     * its theme role: Text, Accent, Color 1 …). Fills, strokes and text
     * follow those controls by expression, so one change recolours the whole
     * chart — and the controls are exposed in Essential Graphics. */
    function hexKey(hex) { return String(hex).toUpperCase(); }
    function setupColors(scene) {
        COLORS = { byHex: {}, order: [] };
        var used = {}, i, el, k;
        var mark = function (h) { if (h) { used[hexKey(h)] = true; } };
        for (i = 0; i < scene.els.length; i++) { el = scene.els[i]; mark(el.fill); mark(el.stroke); if (el.type === 'text') { mark(el.color); } }
        if (!scene.transparent) { mark(scene.bg); if (scene.bg2) { mark(scene.bg2); } }
        var roles = scene.colorRoles || [], taken = {};
        for (i = 0; i < roles.length; i++) {
            k = hexKey(roles[i][1]);
            if (used[k] && !COLORS.byHex.hasOwnProperty(k) && !taken[roles[i][0]]) { COLORS.byHex[k] = roles[i][0]; taken[roles[i][0]] = true; COLORS.order.push(k); }
        }
        var extra = 1;
        for (k in used) {
            if (used.hasOwnProperty(k) && !COLORS.byHex.hasOwnProperty(k)) { COLORS.byHex[k] = 'Color ' + k.replace('#', ''); COLORS.order.push(k); extra++; }
        }
        var fx = ctrl.property('ADBE Effect Parade');
        for (i = 0; i < COLORS.order.length; i++) {
            var c = fx.addProperty('ADBE Color Control');
            c.name = COLORS.byHex[COLORS.order[i]];
            ctrl.property('ADBE Effect Parade').property(COLORS.byHex[COLORS.order[i]]).property(1).setValue(rgba(COLORS.order[i]));
        }
    }
    function colorExpr(hex) {
        if (!COLORS || !COLORS.byHex.hasOwnProperty(hexKey(hex))) { return null; }
        return 'thisComp.layer("DG Controller").effect(' + DG.quote(COLORS.byHex[hexKey(hex)]) + ')(1)';
    }
    function linkColor(prop, hex) {
        var e = colorExpr(hex);
        if (e) { try { prop.expression = e; } catch (err) { /* keep static colour */ } }
    }
    /* "Fill" effect drives a layer's colour (text, background) from a control. */
    function fillEffect(l, hex) {
        if (!colorExpr(hex)) { return; }
        try {
            l.property('ADBE Effect Parade').addProperty('ADBE Fill');
            var fe = l.property('ADBE Effect Parade').property('ADBE Fill');
            for (var i = 1; i <= fe.numProperties; i++) {
                var pr = fe.property(i);
                if (pr.propertyValueType === PropertyValueType.COLOR) { pr.setValue(rgba(hex)); linkColor(pr, hex); break; }
            }
        } catch (e) { /* optional */ }
    }

    function setFill(l, g, hex, opacity) {
        var f = item(l, g, 'Fill');
        f.property('ADBE Vector Fill Color').setValue(rgba(hex));
        linkColor(item(l, g, 'Fill').property('ADBE Vector Fill Color'), hex);
        f.property('ADBE Vector Fill Opacity').setValue(opacity === undefined ? 100 : opacity * 100);
    }
    function setStroke(l, g, el, colorHex, width, cap) {
        var s = item(l, g, 'Stroke');
        s.property('ADBE Vector Stroke Color').setValue(rgba(colorHex));
        linkColor(s.property('ADBE Vector Stroke Color'), colorHex);
        s.property('ADBE Vector Stroke Width').setValue(width);
        s.property('ADBE Vector Stroke Line Cap').setValue(cap === 'round' ? 2 : 1);
        s.property('ADBE Vector Stroke Line Join').setValue(el.join === 'miter' ? 1 : 2);
        if (el.dash && el.dash.length === 2) {
            try {
                var dashes = s.property('ADBE Vector Stroke Dashes');
                dashes.addProperty('ADBE Vector Stroke Dash 1');
                item(l, g, 'Stroke').property('ADBE Vector Stroke Dashes').addProperty('ADBE Vector Stroke Gap 1');
                var d2 = item(l, g, 'Stroke').property('ADBE Vector Stroke Dashes');
                d2.property('ADBE Vector Stroke Dash 1').setValue(el.dash[0] * (W / 1920));
                d2.property('ADBE Vector Stroke Gap 1').setValue(el.dash[1] * (W / 1920));
            } catch (e) { /* dashes are cosmetic */ }
        }
    }
    function newGroup(l, el) {
        var g = uniqueName(el.name + ' #' + el.id);
        var p = root(l).addProperty('ADBE Vector Group');
        p.name = g;
        return g;
    }
    /* Opacity / pop / fade that apply to the whole group */
    function groupAnims(l, g, el, center) {
        var T = gt(l, g), a;
        var op = (el.opacity === undefined ? 1 : el.opacity) * 100;
        T.property('ADBE Vector Group Opacity').setValue(op);
        if ((a = findA(el, 'fade'))) { animKeys(T.property('ADBE Vector Group Opacity'), a, 0, op); }
        if ((a = findKeys(el, 'op'))) {
            multiKeys(gt(l, g).property('ADBE Vector Group Opacity'), a, function (v) { return v * op; });
        }
        var kx = findKeys(el, 'tx'), ky = findKeys(el, 'ty');
        if (kx) { multiKeys(gt(l, g).property('ADBE Vector Position'), kx, function (v) { return [v, 0]; }); }
        if (ky) { multiKeys(gt(l, g).property('ADBE Vector Position'), ky, function (v) { return [0, v]; }); }
        T = gt(l, g);
        if ((a = findA(el, 'pop'))) {
            T.property('ADBE Vector Anchor').setValue(center);
            T.property('ADBE Vector Position').setValue(center);
            animKeys(T.property('ADBE Vector Scale'), a, [0, 0], [100, 100]);
        }
    }

    function rect(el) {
        var l = shapeLayerFor(el), g = newGroup(l, el);
        addTo(l, g, 'ADBE Vector Shape - Rect', 'Rect');
        addTo(l, g, 'ADBE Vector Graphic - Fill', 'Fill');
        if (el.stroke) { addTo(l, g, 'ADBE Vector Graphic - Stroke', 'Stroke'); }
        var R = item(l, g, 'Rect'), cx = el.x + el.w / 2, cy = el.y + el.h / 2;
        R.property('ADBE Vector Rect Size').setValue([el.w, el.h]);
        R.property('ADBE Vector Rect Position').setValue([cx, cy]);
        R.property('ADBE Vector Rect Roundness').setValue(el.r || 0);
        setFill(l, g, el.fill);
        if (el.stroke) { setStroke(l, g, el, el.stroke, el.sw, 'butt'); }
        var a = findA(el, 'grow');
        if (el.live && el.live.kind === 'bar' && LIVE) {
            var lv = el.live, lc = liveHead() + maxCode(lv.max) + PROG + 'var L = ' + vref(lv.cell) + ' / MX * ' + lv.len + ' * p;\n';
            addProgress(l, a);
            if (lv.dir === 'up') {
                item(l, g, 'Rect').property('ADBE Vector Rect Size').expression = lc + '[' + el.w + ', Math.abs(L)];';
                item(l, g, 'Rect').property('ADBE Vector Rect Position').expression = lc + '[' + cx + ', ' + lv.base + ' - L / 2];';
            } else {
                item(l, g, 'Rect').property('ADBE Vector Rect Size').expression = lc + '[Math.abs(L), ' + el.h + '];';
                item(l, g, 'Rect').property('ADBE Vector Rect Position').expression = lc + '[' + lv.base + ' + L / 2, ' + cy + '];';
            }
            a = null;
        }
        if (a) {
            var s0, p0;
            if (a.dir === 'up') { s0 = [el.w, 0]; p0 = [cx, el.y + el.h]; } else if (a.dir === 'down') { s0 = [el.w, 0]; p0 = [cx, el.y]; } else if (a.dir === 'right') { s0 = [0, el.h]; p0 = [el.x, cy]; } else { s0 = [0, el.h]; p0 = [el.x + el.w, cy]; }
            animKeys(item(l, g, 'Rect').property('ADBE Vector Rect Size'), a, s0, [el.w, el.h]);
            animKeys(item(l, g, 'Rect').property('ADBE Vector Rect Position'), a, p0, [cx, cy]);
        }
        var kw = findKeys(el, 'w'), kh = findKeys(el, 'h');
        if (kw) {
            multiKeys(item(l, g, 'Rect').property('ADBE Vector Rect Size'), kw, function (v) { return [v, el.h]; });
            multiKeys(item(l, g, 'Rect').property('ADBE Vector Rect Position'), kw, function (v) { return [el.x + v / 2, cy]; });
        }
        if (kh) {
            multiKeys(item(l, g, 'Rect').property('ADBE Vector Rect Size'), kh, function (v) { return [el.w, v]; });
            multiKeys(item(l, g, 'Rect').property('ADBE Vector Rect Position'), kh, function (v) { return [cx, el.y + el.h - v / 2]; });
        }
        groupAnims(l, g, el, [cx, cy]);
        return l;
    }

    function trimDraw(l, g, a) {
        var tr = item(l, g, 'Trim');
        tr.property('ADBE Vector Trim Start').setValue(0);
        if (a) { animKeys(tr.property('ADBE Vector Trim End'), DG.extend({}, a, { over: 0 }), 0, 100); }
    }

    function line(el) {
        var l = shapeLayerFor(el), g = newGroup(l, el), a = findA(el, 'draw');
        addTo(l, g, 'ADBE Vector Shape - Group', 'Path');
        if (a) { addTo(l, g, 'ADBE Vector Filter - Trim', 'Trim'); }
        addTo(l, g, 'ADBE Vector Graphic - Stroke', 'Stroke');
        item(l, g, 'Path').property('ADBE Vector Shape').setValue(makeShape([[el.x1, el.y1], [el.x2, el.y2]], [[0, 0], [0, 0]], [[0, 0], [0, 0]], false));
        setStroke(l, g, el, el.stroke, el.sw, el.cap);
        if (a) { trimDraw(l, g, a); }
        groupAnims(l, g, el, [(el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2]);
        return l;
    }

    function path(el) {
        var l = shapeLayerFor(el), g = newGroup(l, el), a = findA(el, 'draw'), w = findA(el, 'wipe'), rs = findA(el, 'rise');
        addTo(l, g, 'ADBE Vector Shape - Group', 'Path');
        if (w) { addTo(l, g, 'ADBE Vector Shape - Rect', 'Wipe'); addTo(l, g, 'ADBE Vector Filter - Merge', 'Merge'); }
        if (a) { addTo(l, g, 'ADBE Vector Filter - Trim', 'Trim'); }
        if (el.fill) { addTo(l, g, 'ADBE Vector Graphic - Fill', 'Fill'); }
        if (el.stroke) { addTo(l, g, 'ADBE Vector Graphic - Stroke', 'Stroke'); }
        item(l, g, 'Path').property('ADBE Vector Shape').setValue(makeShape(el.pts, el.inT, el.outT, el.closed));
        if (el.live && el.live.kind === 'linePath' && LIVE) { item(l, g, 'Path').property('ADBE Vector Shape').expression = linePathExpr(el.live); }
        el.aeLayerName = l.name; el.aeGroup = g;
        if (el.fill) { setFill(l, g, el.fill, el.fillOpacity); }
        if (el.stroke) { setStroke(l, g, el, el.stroke, el.sw, el.cap || 'round'); }
        if (a) { trimDraw(l, g, a); }
        if (w) {
            item(l, g, 'Merge').property('ADBE Vector Merge Type').setValue(4); /* intersect */
            var left = w.xs[0] - 2, h = w.y1 - w.y0, my = (w.y0 + w.y1) / 2, sk = [], pk = [], k;
            for (k = 0; k < w.times.length; k++) {
                var wd = k === 0 ? 0 : w.xs[k] - left;
                sk.push([w.times[k], [wd, h]]); pk.push([w.times[k], [left + wd / 2, my]]);
            }
            setKeys(item(l, g, 'Wipe').property('ADBE Vector Rect Size'), sk, null);
            setKeys(item(l, g, 'Wipe').property('ADBE Vector Rect Position'), pk, null);
        }
        if (rs) {
            var T = gt(l, g), c = [el.pts[0][0], rs.baseY];
            T.property('ADBE Vector Anchor').setValue(c);
            T.property('ADBE Vector Position').setValue(c);
            animKeys(T.property('ADBE Vector Scale'), rs, [100, 0], [100, 100]);
        }
        groupAnims(l, g, el, el.pts[0]);
        return l;
    }

    function circle(el) {
        var fol = findA(el, 'follow');
        var l = fol ? newShapeLayer(el.name) : shapeLayerFor(el), g = newGroup(l, el);
        addTo(l, g, 'ADBE Vector Shape - Ellipse', 'Ellipse');
        if (el.fill) { addTo(l, g, 'ADBE Vector Graphic - Fill', 'Fill'); }
        if (el.stroke) { addTo(l, g, 'ADBE Vector Graphic - Stroke', 'Stroke'); }
        var c = fol ? [0, 0] : [el.cx, el.cy];
        item(l, g, 'Ellipse').property('ADBE Vector Ellipse Size').setValue([el.r * 2, el.r * 2]);
        item(l, g, 'Ellipse').property('ADBE Vector Ellipse Position').setValue(c);
        if (el.fill) { setFill(l, g, el.fill); }
        if (el.stroke) { setStroke(l, g, el, el.stroke, el.sw, 'butt'); }
        groupAnims(l, g, el, c);
        /* moving bubbles: position + size keyframes (linear between periods) */
        var kcx = findKeys(el, 'cx'), kcy = findKeys(el, 'cy'), kr = findKeys(el, 'r');
        if (kcx && kcy) {
            var pk = [];
            for (var q = 0; q < kcx.times.length; q++) { pk.push([kcx.times[q], [kcx.vals[q], kcy.vals[q]]]); }
            setKeys(item(l, g, 'Ellipse').property('ADBE Vector Ellipse Position'), pk, DG.easeDef(kcx.ease));
            if (findA(el, 'pop')) {
                /* pop around where the bubble starts */
                gt(l, g).property('ADBE Vector Anchor').setValue([kcx.vals[0], kcy.vals[0]]);
                gt(l, g).property('ADBE Vector Position').setValue([kcx.vals[0], kcy.vals[0]]);
            }
        }
        if (kr) { multiKeys(item(l, g, 'Ellipse').property('ADBE Vector Ellipse Size'), kr, function (v) { return [v * 2, v * 2]; }); }
        if (el.live && el.live.kind === 'point' && LIVE) {
            var lp = el.live, pexp = liveHead() + maxCode(lp.max) + '[' + lp.x + ', ' + lp.base + ' - ' + vref(lp.cell) + ' / MX * ' + lp.len + '];';
            item(l, g, 'Ellipse').property('ADBE Vector Ellipse Position').expression = pexp;
            if (findA(el, 'pop')) {
                gt(l, g).property('ADBE Vector Anchor').expression = pexp;
                gt(l, g).property('ADBE Vector Position').expression = pexp;
            }
        }
        if (fol && el.live && el.live.kind === 'follow' && LIVE && BYID[el.live.line] && BYID[el.live.line].aeLayerName) {
            /* live: sit on the end of the trimmed path, wherever the data moved it */
            var ln = BYID[el.live.line];
            l.transform.position.expression = '// DocuGraph: rides the end of the line\n' +
                'var L = thisComp.layer(' + DG.quote(ln.aeLayerName) + ');\nvar g = L.content(' + DG.quote(ln.aeGroup) + ');\n' +
                'var e = clamp(g.content("Trim").end / 100, 0.0001, 1);\n' +
                'thisLayer.parent.fromComp(L.toComp(g.content("Path").path.pointOnPath(e)));';
            el.aeLayerName = l.name;
            fol = null;
        }
        if (fol) {
            /* The dot rides the line: one position key per vertex, at the
             * moment the (linear) trim reaches it, with the path's own bezier
             * tangents as spatial tangents. */
            var pos = l.transform.position, k, keys = [];
            for (k = 0; k < fol.pts.length; k++) { keys.push([fol.times[k], P(fol.pts[k][0], fol.pts[k][1])]); }
            setKeys(pos, keys, null);
            for (k = 0; k < fol.pts.length; k++) {
                var ki = pos.nearestKeyIndex(fol.times[k]);
                try {
                    pos.setSpatialAutoBezierAtKey(ki, false);
                    pos.setSpatialTangentsAtKey(ki, [fol.inT[k][0], fol.inT[k][1], 0], [fol.outT[k][0], fol.outT[k][1], 0]);
                } catch (e) { /* straight segments are fine too */ }
            }
            el.aeLayerName = l.name;
        }
        return l;
    }

    function ring(el) {
        var l = shapeLayerFor(el), g = newGroup(l, el), a = findA(el, 'sweep');
        addTo(l, g, 'ADBE Vector Shape - Group', 'Path');
        addTo(l, g, 'ADBE Vector Filter - Trim', 'Trim');
        addTo(l, g, 'ADBE Vector Graphic - Stroke', 'Stroke');
        var rm = (el.r + el.inner) / 2, sw = el.r - el.inner;
        item(l, g, 'Path').property('ADBE Vector Shape').setValue(circleShape(el.cx, el.cy, rm));
        setStroke(l, g, el, el.fill, sw, el.cap === 'round' ? 'round' : 'butt');
        var tr = item(l, g, 'Trim'), ext = (el.a1 - el.a0) / 360 * 100;
        tr.property('ADBE Vector Trim Start').setValue(0);
        tr.property('ADBE Vector Trim Offset').setValue(el.a0);
        tr.property('ADBE Vector Trim End').setValue(ext);
        if (el.live && LIVE) {
            var lv = el.live;
            addProgress(l, a ? DG.extend({}, a, { over: 0 }) : null);
            if (lv.kind === 'slice') {
                var sc = liveHead() + sliceCode(lv) + 'var a0 = ' + lv.start + ' + ' + lv.span + ' * cum / tot + ' + (lv.gap / 2) + ';\n' +
                    'var ext = Math.max(0, ' + lv.span + ' * vI / tot - ' + lv.gap + ');\n';
                item(l, g, 'Trim').property('ADBE Vector Trim Offset').expression = sc + 'a0;';
                item(l, g, 'Trim').property('ADBE Vector Trim End').expression = sc + PROG01 + 'ext / 360 * 100 * p;';
            } else if (lv.kind === 'ringPct') {
                item(l, g, 'Trim').property('ADBE Vector Trim End').expression = liveHead() + PROG01 + 'clamp(' + vref(lv.cell) + ', 0, 100) * p;';
            }
            a = null;
        }
        if (a) { animKeys(item(l, g, 'Trim').property('ADBE Vector Trim End'), DG.extend({}, a, { over: 0 }), 0, ext); }
        groupAnims(l, g, el, [el.cx, el.cy]);
        return l;
    }

    /* ----------------------------------------------------------------- text */

    function exprFmt(v, fmtObj) { return '(' + DG.FMT_SRC + ')(' + v + ',' + DG.toJSON(fmtObj) + ')'; }

    function text(el, byId) {
        var l = comp.layers.addText(el.text === '' ? ' ' : el.text);
        l.name = uniqueName(el.name);
        l.parent = ctrl;
        var tp = l.property('ADBE Text Properties').property('ADBE Text Document');
        var td = tp.value;
        try { td.resetCharStyle(); td.resetParagraphStyle(); } catch (e0) { /* older AE */ }
        td.fontSize = el.size;
        td.applyFill = true;
        td.fillColor = rgb(el.color);
        td.applyStroke = false;
        try { td.font = el.fontAE; } catch (e1) { /* missing font: AE substitutes */ }
        td.justification = el.align === 'center' ? ParagraphJustification.CENTER_JUSTIFY : el.align === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.LEFT_JUSTIFY;
        td.tracking = el.track || 0;
        tp.setValue(td);

        fillEffect(l, el.color);
        if (el.name === 'Title' || el.name === 'Subtitle' || el.name === 'Source' || el.name === 'Credit') { EGP_TEXT[el.name] = l; }
        var base = P(el.x, el.y), a;
        l.transform.position.setValue(base);
        var op = (el.opacity === undefined ? 1 : el.opacity) * 100;
        l.transform.opacity.setValue(op);
        if ((a = findA(el, 'fade'))) {
            animKeys(l.transform.opacity, a, 0, op);
            if (a.dy && !findA(el, 'followLabel')) { animKeys(l.transform.position, a, [base[0], base[1] + a.dy], base); }
        }
        if ((a = findA(el, 'pop'))) { animKeys(l.transform.scale, a, [0, 0], [100, 100]); }

        var ko = findKeys(el, 'op'), kxs = findKeys(el, 'x'), kys = findKeys(el, 'y'), ktx = findKeys(el, 'tx'), kty = findKeys(el, 'ty');
        if (ko) { multiKeys(l.transform.opacity, ko, function (v) { return v * op; }); }
        if (kxs || kys || ktx || kty) {
            /* separate X / Y so each axis keeps its own easing */
            l.transform.position.dimensionsSeparated = true;
            var px = l.transform.property('ADBE Position_0'), py = l.transform.property('ADBE Position_1');
            px.setValue(base[0]); py.setValue(base[1]);
            if (kxs) { multiKeys(px, kxs, function (v) { return v - W / 2; }); }
            if (ktx) { multiKeys(px, ktx, function (v) { return base[0] + v; }); }
            if (kys) { multiKeys(py, kys, function (v) { return v - H / 2; }); }
            if (kty) { multiKeys(py, kty, function (v) { return base[1] + v; }); }
        }
        var lv = findA(el, 'live');
        if (lv) {
            if (lv.labels) {
                tp.expression = '// DocuGraph period label\n' +
                    'var T = ' + DG.toJSON(lv.times) + ', V = ' + DG.toJSON(lv.vals) + ', L = ' + DG.toJSON(lv.labels) + ';\n' +
                    'var v = V[0]; for (var k = 0; k < T.length; k++) { if (time >= T[k]) { v = V[k]; } }\n' +
                    'L[Math.max(0, Math.min(L.length - 1, Math.floor(v + 1e-6)))];';
            } else {
                tp.expression = '// DocuGraph live value (linear between keys)\n' +
                    'var T = ' + DG.toJSON(lv.times) + ', V = ' + DG.toJSON(lv.vals) + ';\n' +
                    'var v = V[0];\n' +
                    'if (time >= T[T.length - 1]) { v = V[V.length - 1]; } else { for (var k = 0; k < T.length - 1; k++) { if (time < T[k + 1]) { v = time <= T[k] ? V[k] : V[k] + (V[k + 1] - V[k]) * (time - T[k]) / (T[k + 1] - T[k]); break; } } }\n' +
                    exprFmt('v', lv.fmt) + ';';
            }
        }
        var cnt = findA(el, 'count'), ty = findA(el, 'type'), fl = findA(el, 'followLabel');
        if (el.live && LIVE) {
            if (cnt) { addProgress(l, cnt); }
            tp.expression = liveTextExpr(el);
            var pe = el.live.pos ? livePosExpr(DG.extend({ cell: el.live.cell }, el.live.pos)) : null;
            if (pe) { l.transform.position.expression = pe; }
            cnt = null; ty = null;
        }
        if (cnt || ty) {
            var sl = l.property('ADBE Effect Parade').addProperty('ADBE Slider Control');
            sl.name = 'Progress';
            var spAnim = cnt || ty;
            animKeys(l.property('ADBE Effect Parade').property('Progress').property(1), spAnim, 0, 100);
            if (cnt) {
                tp.expression = '// DocuGraph count-up. Edit FROM / TO, retime the Progress keys.\n' +
                    'var FROM = ' + el.count.from + ', TO = ' + el.count.to + ';\n' +
                    'var p = effect("Progress")(1) / 100;\n' +
                    exprFmt('FROM + (TO - FROM) * p', el.count.fmt) + ';';
            } else {
                tp.expression = '// DocuGraph typewriter (edit the text normally)\nvar s = value.toString();\n' +
                    's.substr(0, Math.round(s.length * clamp(effect("Progress")(1) / 100, 0, 1)));';
            }
        }
        if (fl) {
            var dot = byId[fl.target];
            if (dot && dot.aeLayerName) {
                l.transform.position.expression = '// follows the line tip\nthisComp.layer(' + DG.quote(dot.aeLayerName) + ').transform.position + [' + fl.dx + ', ' + fl.dy + '];';
                if (fl.vals && !(el.live && LIVE)) {
                    tp.expression = '// DocuGraph live value: value of the line at the tip\n' +
                        'var T = ' + DG.toJSON(fl.times) + ', V = ' + DG.toJSON(fl.vals) + ';\n' +
                        'var v = V[0];\n' +
                        'if (time >= T[T.length - 1]) { v = V[V.length - 1]; } else { for (var k = 0; k < T.length - 1; k++) { if (time < T[k + 1]) { v = time <= T[k] ? V[k] : V[k] + (V[k + 1] - V[k]) * (time - T[k]) / (T[k + 1] - T[k]); break; } } }\n' +
                        exprFmt('v', fl.fmt) + ';';
                }
            }
        }
        return l;
    }

    /* --------------------------------------------------------------- render */

    /* Essential Graphics: expose title texts, colours and data sliders, so the
     * chart is edited from the precomp layer's Essential Properties in the
     * parent comp (the Motion Bro workflow). Needs AE 2019+; skipped quietly
     * on older versions. */
    function addEGP(scene) {
        var added = 0, i, fx;
        function egp(prop, name) {
            try {
                if (prop.canAddToMotionGraphicsTemplate && !prop.canAddToMotionGraphicsTemplate(comp)) { return; }
                prop.addToMotionGraphicsTemplateAs(comp, name); added++;
            } catch (e) { /* unsupported property / version */ }
        }
        try { comp.motionGraphicsTemplateName = comp.name; } catch (e0) { return 0; }
        var order = ['Title', 'Subtitle', 'Source', 'Credit'];
        for (i = 0; i < order.length; i++) {
            if (EGP_TEXT[order[i]]) { egp(EGP_TEXT[order[i]].property('ADBE Text Properties').property('ADBE Text Document'), order[i]); }
        }
        fx = ctrl.property('ADBE Effect Parade');
        if (COLORS) { for (i = 0; i < COLORS.order.length; i++) { egp(fx.property(COLORS.byHex[COLORS.order[i]]).property(1), COLORS.byHex[COLORS.order[i]]); } }
        if (LIVE) {
            for (i = 0; i < LIVE.cells.length; i++) { egp(ctrl.property('ADBE Effect Parade').property(LIVE.cells[i].name).property(1), LIVE.cells[i].name); }
            if (ctrl.property('ADBE Effect Parade').property(AXIS_MAX)) { egp(ctrl.property('ADBE Effect Parade').property(AXIS_MAX).property(1), AXIS_MAX); }
        }
        egp(ctrl.transform.scale, 'Chart Scale');
        egp(ctrl.transform.position, 'Chart Position');
        return added;
    }

    /* Drop the chart comp into the user's comp at the playhead (like Motion Bro). */
    function insertInto(host) {
        if (!host || host === comp) { return null; }
        var L = host.layers.add(comp);
        L.startTime = host.time;
        var sc = Math.min(host.width / W, host.height / H) * 100;
        if (Math.abs(sc - 100) > 0.01) { L.transform.scale.setValue([sc, sc]); }
        L.transform.position.setValue([host.width / 2, host.height / 2]);
        try { for (var i = 1; i <= host.numLayers; i++) { host.layer(i).selected = false; } L.selected = true; } catch (e) { /* ignore */ }
        return L;
    }

    function findFolder(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === name) { return it; }
        }
        return app.project.items.addFolder(name);
    }

    function render(scene, specJson, target, hostComp) {
        W = scene.width; H = scene.height; layerMap = {}; nameCount = {}; glowDone = {}; LIVE = scene.live; COLORS = null; EGP_TEXT = {};
        var inserted = null, egpCount = 0;
        if (!app.project) { app.newProject(); }
        app.beginUndoGroup('DocuGraph: create chart');
        var made = 0, i, byId = {};
        try {
            if (target) {
                /* Update in place: remove only the layers DocuGraph made */
                comp = target;
                for (i = comp.numLayers; i >= 1; i--) {
                    var old = comp.layer(i);
                    if (old.comment === 'DocuGraph') { old.locked = false; old.remove(); }
                }
                comp.width = W; comp.height = H; comp.duration = scene.duration; comp.frameRate = scene.fps;
            } else {
                comp = app.project.items.addComp(scene.name, W, H, 1, scene.duration, scene.fps);
                try { comp.parentFolder = findFolder('DocuGraph'); } catch (ef) { /* ignore */ }
            }
            var before = comp.numLayers;
            try { comp.comment = 'DocuGraph ' + DG.version + '\n' + specJson; } catch (ec) { /* ignore */ }
            comp.bgColor = rgb(scene.bg);

            var bg = null;
            if (!scene.transparent) {
                bg = comp.layers.addSolid(rgb(scene.bg), 'Background', W, H, 1);
                if (scene.bg2) {
                    try {
                        var ramp = bg.property('ADBE Effect Parade').addProperty('ADBE Ramp');
                        ramp.property('ADBE Ramp-0001').setValue([W / 2, H * 0.45]);
                        ramp.property('ADBE Ramp-0002').setValue(rgba(scene.bg2));
                        ramp.property('ADBE Ramp-0003').setValue([W / 2, H * 0.45 + Math.max(W, H) * 0.75]);
                        ramp.property('ADBE Ramp-0004').setValue(rgba(scene.bg));
                        ramp.property('ADBE Ramp-0005').setValue(2);
                    } catch (er) { /* gradient is optional */ }
                }
            }
            ctrl = comp.layers.addNull(scene.duration);
            ctrl.name = 'DG Controller';
            ctrl.transform.anchorPoint.setValue([0, 0]);
            ctrl.transform.position.setValue([W / 2, H / 2]);
            setupColors(scene);
            if (bg) {
                fillEffect(bg, scene.bg);
                if (scene.bg2) {
                    try {
                        linkColor(bg.property('ADBE Effect Parade').property('ADBE Ramp').property('ADBE Ramp-0002'), scene.bg2);
                        linkColor(bg.property('ADBE Effect Parade').property('ADBE Ramp').property('ADBE Ramp-0004'), scene.bg);
                    } catch (el2) { /* optional */ }
                }
                bg.locked = true;
            }

            if (LIVE) { liveSliders(scene); }
            for (i = 0; i < scene.els.length; i++) { byId[scene.els[i].id] = scene.els[i]; }
            BYID = byId;
            for (i = 0; i < scene.els.length; i++) {
                var el = scene.els[i], l = null;
                if (el.type === 'rect') { l = rect(el); } else if (el.type === 'line') { l = line(el); } else if (el.type === 'path') { l = path(el); } else if (el.type === 'circle') { l = circle(el); } else if (el.type === 'ring') { l = ring(el); } else if (el.type === 'text') { l = text(el, byId); }
                if (l && el.glow && scene.glow && !glowDone.hasOwnProperty(l.name)) {
                    glowDone[l.name] = true;
                    try { l.property('ADBE Effect Parade').addProperty('ADBE Glo2'); } catch (eg) { /* optional */ }
                }
                made++;
            }
            ctrl.moveToBeginning();
            /* tag our layers so "Update" can replace them later */
            for (i = 1; i <= comp.numLayers - before; i++) { try { comp.layer(i).comment = 'DocuGraph'; } catch (em) { /* ignore */ } }
            egpCount = addEGP(scene);
            if (hostComp && !target) { inserted = insertInto(hostComp); }
            if (inserted) { hostComp.openInViewer(); } else { comp.openInViewer(); }
        } finally {
            app.endUndoGroup();
        }
        return 'OK|' + comp.name + '|' + made + '|' + comp.numLayers + '|' + (inserted ? hostComp.name : '') + '|' + egpCount;
    }

    return { render: render };
}());
