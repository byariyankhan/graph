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
    var comp, ctrl, W, H, layerMap, nameCount, glowDone;

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
    function setFill(l, g, hex, opacity) {
        var f = item(l, g, 'Fill');
        f.property('ADBE Vector Fill Color').setValue(rgba(hex));
        f.property('ADBE Vector Fill Opacity').setValue(opacity === undefined ? 100 : opacity * 100);
    }
    function setStroke(l, g, el, colorHex, width, cap) {
        var s = item(l, g, 'Stroke');
        s.property('ADBE Vector Stroke Color').setValue(rgba(colorHex));
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
                tp.expression = '// DocuGraph typewriter\nvar s = ' + DG.quote(el.text) + ';\n' +
                    's.substr(0, Math.round(s.length * clamp(effect("Progress")(1) / 100, 0, 1)));';
            }
        }
        if (fl) {
            var dot = byId[fl.target];
            if (dot && dot.aeLayerName) {
                l.transform.position.expression = '// follows the line tip\nthisComp.layer(' + DG.quote(dot.aeLayerName) + ').transform.position + [' + fl.dx + ', ' + fl.dy + '];';
                if (fl.vals) {
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

    function findFolder(name) {
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof FolderItem && it.name === name) { return it; }
        }
        return app.project.items.addFolder(name);
    }

    function render(scene, specJson) {
        W = scene.width; H = scene.height; layerMap = {}; nameCount = {}; glowDone = {};
        if (!app.project) { app.newProject(); }
        app.beginUndoGroup('DocuGraph: create chart');
        var made = 0, i, byId = {};
        try {
            comp = app.project.items.addComp(scene.name, W, H, 1, scene.duration, scene.fps);
            try { comp.parentFolder = findFolder('DocuGraph'); } catch (ef) { /* ignore */ }
            try { comp.comment = 'DocuGraph ' + DG.version + '\n' + specJson; } catch (ec) { /* ignore */ }
            comp.bgColor = rgb(scene.bg);

            if (!scene.transparent) {
                var bg = comp.layers.addSolid(rgb(scene.bg), 'Background', W, H, 1);
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
                bg.locked = true;
            }
            ctrl = comp.layers.addNull(scene.duration);
            ctrl.name = 'DG Controller';
            ctrl.transform.anchorPoint.setValue([0, 0]);
            ctrl.transform.position.setValue([W / 2, H / 2]);

            for (i = 0; i < scene.els.length; i++) { byId[scene.els[i].id] = scene.els[i]; }
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
            comp.openInViewer();
        } finally {
            app.endUndoGroup();
        }
        return 'OK|' + comp.name + '|' + made + '|' + comp.numLayers;
    }

    return { render: render };
}());
