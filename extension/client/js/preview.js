/*
 * DocuGraph — SVG preview renderer.
 * Renders a scene (from DG.build) at any time t, using the exact same
 * animation math (DG.animF / DG.interp / DG.fmt) that the After Effects
 * keyframes and expressions reproduce. Works in the CEP panel and in Node.
 */
(function (root) {
    var DG = root.DG;
    var P = {};

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function r2(v) { return Math.round(v * 100) / 100; }
    function findA(el, kind) {
        for (var i = 0; i < el.anims.length; i++) { if (el.anims[i].kind === kind) { return el.anims[i]; } }
        return null;
    }

    P.pathD = function (pts, inT, outT, closed) {
        if (!pts.length) { return ''; }
        var d = 'M' + r2(pts[0][0]) + ',' + r2(pts[0][1]), n = pts.length, i;
        var seg = function (a, b) {
            return 'C' + r2(pts[a][0] + outT[a][0]) + ',' + r2(pts[a][1] + outT[a][1]) + ' ' +
                r2(pts[b][0] + inT[b][0]) + ',' + r2(pts[b][1] + inT[b][1]) + ' ' + r2(pts[b][0]) + ',' + r2(pts[b][1]);
        };
        for (i = 1; i < n; i++) { d += seg(i - 1, i); }
        if (closed) { d += seg(n - 1, 0) + 'Z'; }
        return d;
    };

    /* Position of a 'follow' animation at time t: arc-length uniform inside
     * each segment, segment boundaries at the given vertex times. */
    P.followPos = function (a, t) {
        var T = a.times, pts = a.pts, n = pts.length, k;
        if (t <= T[0]) { return pts[0]; }
        if (t >= T[n - 1]) { return pts[n - 1]; }
        for (k = 0; k < n - 1; k++) { if (t < T[k + 1]) { break; } }
        var f = (t - T[k]) / (T[k + 1] - T[k] || 1);
        var p0 = pts[k], p1 = pts[k + 1];
        var c0 = [p0[0] + a.outT[k][0], p0[1] + a.outT[k][1]], c1 = [p1[0] + a.inT[k + 1][0], p1[1] + a.inT[k + 1][1]];
        var N = 40, acc = [0], prev = p0, i, q;
        for (i = 1; i <= N; i++) {
            q = DG.bezPt(p0, c0, c1, p1, i / N);
            acc.push(acc[i - 1] + Math.sqrt((q[0] - prev[0]) * (q[0] - prev[0]) + (q[1] - prev[1]) * (q[1] - prev[1])));
            prev = q;
        }
        var want = f * acc[N];
        for (i = 1; i <= N; i++) {
            if (acc[i] >= want) {
                var s = (i - 1 + (want - acc[i - 1]) / ((acc[i] - acc[i - 1]) || 1)) / N;
                return DG.bezPt(p0, c0, c1, p1, s);
            }
        }
        return p1;
    };

    function arcD(cx, cy, r, a0, a1) {
        var pt = function (a) { var rad = a * Math.PI / 180; return r2(cx + r * Math.sin(rad)) + ',' + r2(cy - r * Math.cos(rad)); };
        if (a1 - a0 >= 359.99) {
            return 'M' + pt(a0) + 'A' + r2(r) + ',' + r2(r) + ' 0 1 1 ' + pt(a0 + 180) + 'A' + r2(r) + ',' + r2(r) + ' 0 1 1 ' + pt(a0 + 359.99);
        }
        return 'M' + pt(a0) + 'A' + r2(r) + ',' + r2(r) + ' 0 ' + (a1 - a0 > 180 ? 1 : 0) + ' 1 ' + pt(a1);
    }

    P.render = function (scene, t, opt) {
        opt = opt || {};
        var W = scene.width, H = scene.height, out = [], defs = [], i, byId = {};
        for (i = 0; i < scene.els.length; i++) { byId[scene.els[i].id] = scene.els[i]; }
        var ctx = { t: t, defs: defs, byId: byId, uid: 0, glow: scene.glow };
        if (scene.transparent) {
            defs.push('<pattern id="chk" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#2b2b2b"/><rect width="20" height="20" fill="#363636"/><rect x="20" y="20" width="20" height="20" fill="#363636"/></pattern>');
            out.push('<rect width="' + W + '" height="' + H + '" fill="url(#chk)"/>');
        } else if (scene.bg2) {
            defs.push('<radialGradient id="bgg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="' + scene.bg2 + '"/><stop offset="1" stop-color="' + scene.bg + '"/></radialGradient>');
            out.push('<rect width="' + W + '" height="' + H + '" fill="url(#bgg)"/>');
        } else {
            out.push('<rect width="' + W + '" height="' + H + '" fill="' + scene.bg + '"/>');
        }
        if (scene.glow) {
            defs.push('<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="' + r2(W / 300) + '" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>');
        }
        for (i = 0; i < scene.els.length; i++) {
            var s = P.el(scene.els[i], ctx);
            if (s) { out.push(s); }
        }
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' +
            (opt.size ? ' width="' + W + '" height="' + H + '"' : ' width="100%" height="100%" preserveAspectRatio="xMidYMid meet"') +
            '><defs>' + defs.join('') + '</defs>' + out.join('') + '</svg>';
    };

    P.el = function (el, ctx) {
        var t = ctx.t, op = el.opacity === undefined ? 1 : el.opacity, tr = '', a, f;
        a = findA(el, 'fade');
        var dy = 0;
        if (a) { f = DG.animF(a, t); op *= DG.clamp(f, 0, 1); dy = (a.dy || 0) * (1 - f); }
        if (op <= 0.001) { return ''; }
        if (dy) { tr += 'translate(0 ' + r2(dy) + ')'; }
        var pop = findA(el, 'pop'), ps = pop ? DG.animF(pop, t) : 1;
        if (pop && ps <= 0.001) { return ''; }
        var center = P.center(el, ctx);
        if (pop && ps !== 1) { tr += ' translate(' + r2(center[0]) + ' ' + r2(center[1]) + ') scale(' + r2(ps * 1000) / 1000 + ') translate(' + r2(-center[0]) + ' ' + r2(-center[1]) + ')'; }
        var g = el.glow && ctx.glow ? ' filter="url(#glow)"' : '';
        var body = P[el.type] ? P[el.type](el, ctx) : '';
        if (!body) { return ''; }
        return '<g opacity="' + r2(op) + '"' + (tr ? ' transform="' + tr + '"' : '') + g + '>' + body + '</g>';
    };

    P.center = function (el, ctx) {
        switch (el.type) {
            case 'rect': return [el.x + el.w / 2, el.y + el.h / 2];
            case 'circle': {
                var fa = findA(el, 'follow');
                return fa ? P.followPos(fa, ctx.t) : [el.cx, el.cy];
            }
            case 'ring': return [el.cx, el.cy];
            case 'text': return P.textPos(el, ctx);
            case 'line': return [(el.x1 + el.x2) / 2, (el.y1 + el.y2) / 2];
            default: return [0, 0];
        }
    };

    P.rect = function (el, ctx) {
        var x = el.x, y = el.y, w = el.w, h = el.h, a = findA(el, 'grow');
        if (a) {
            var f = DG.animF(a, ctx.t);
            if (f <= 0) { return ''; }
            if (a.dir === 'up') { y = el.y + el.h - el.h * f; h = el.h * f; } else if (a.dir === 'down') { h = el.h * f; } else if (a.dir === 'right') { w = el.w * f; } else if (a.dir === 'left') { x = el.x + el.w - el.w * f; w = el.w * f; }
        }
        if (w <= 0 || h <= 0) { return ''; }
        var rr = Math.min(el.r || 0, w / 2, h / 2);
        return '<rect x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '"' + (rr ? ' rx="' + r2(rr) + '"' : '') +
            ' fill="' + el.fill + '"' + (el.stroke ? ' stroke="' + el.stroke + '" stroke-width="' + r2(el.sw) + '"' : '') + '/>';
    };

    P.line = function (el, ctx) {
        var a = findA(el, 'draw'), f = a ? DG.clamp(DG.animF(a, ctx.t), 0, 1) : 1;
        if (f <= 0) { return ''; }
        var x2 = el.x1 + (el.x2 - el.x1) * f, y2 = el.y1 + (el.y2 - el.y1) * f;
        return '<line x1="' + r2(el.x1) + '" y1="' + r2(el.y1) + '" x2="' + r2(x2) + '" y2="' + r2(y2) + '" stroke="' + el.stroke + '" stroke-width="' + r2(el.sw) + '"' +
            ' stroke-linecap="' + (el.cap === 'round' ? 'round' : 'butt') + '"' + (el.dash ? ' stroke-dasharray="' + el.dash.join(' ') + '"' : '') + '/>';
    };

    P.path = function (el, ctx) {
        var d = P.pathD(el.pts, el.inT, el.outT, el.closed), extra = '', clip = '';
        var a = findA(el, 'draw');
        if (a) {
            var f = DG.clamp(DG.animF(a, ctx.t), 0, 1);
            if (f <= 0) { return ''; }
            var L = DG.sum(DG.segLens(el));
            if (f < 1) { extra = ' stroke-dasharray="' + r2(L * f) + ' ' + r2(L + 10) + '"'; }
        }
        var w = findA(el, 'wipe');
        if (w) {
            var x = DG.interp(w.times, w.xs, ctx.t);
            if (ctx.t <= w.t0) { return ''; }
            var id = 'clip' + el.id;
            ctx.defs.push('<clipPath id="' + id + '"><rect x="' + r2(w.xs[0] - 2) + '" y="' + r2(w.y0) + '" width="' + r2(Math.max(0, x - w.xs[0] + 2)) + '" height="' + r2(w.y1 - w.y0) + '"/></clipPath>');
            clip = ' clip-path="url(#' + id + ')"';
        }
        var rise = findA(el, 'rise'), tr = '';
        if (rise) {
            var rf = DG.animF(rise, ctx.t);
            tr = ' transform="translate(0 ' + r2(rise.baseY) + ') scale(1 ' + r2(rf * 1000) / 1000 + ') translate(0 ' + r2(-rise.baseY) + ')"';
        }
        return '<path d="' + d + '"' + clip + tr + ' fill="' + (el.fill || 'none') + '"' + (el.fill && el.fillOpacity !== undefined ? ' fill-opacity="' + el.fillOpacity + '"' : '') +
            (el.stroke ? ' stroke="' + el.stroke + '" stroke-width="' + r2(el.sw) + '" stroke-linecap="' + (el.cap || 'round') + '" stroke-linejoin="' + (el.join || 'round') + '"' : '') + extra + '/>';
    };

    P.circle = function (el, ctx) {
        var c = P.center(el, ctx);
        return '<circle cx="' + r2(c[0]) + '" cy="' + r2(c[1]) + '" r="' + r2(el.r) + '" fill="' + (el.fill || 'none') + '"' +
            (el.stroke ? ' stroke="' + el.stroke + '" stroke-width="' + r2(el.sw) + '"' : '') + '/>';
    };

    P.ring = function (el, ctx) {
        var a = findA(el, 'sweep'), f = a ? DG.clamp(DG.animF(a, ctx.t), 0, 1.2) : 1;
        if (f <= 0) { return ''; }
        var a1 = el.a0 + (el.a1 - el.a0) * f;
        var rm = (el.r + el.inner) / 2, sw = el.r - el.inner;
        return '<path d="' + arcD(el.cx, el.cy, rm, el.a0, a1) + '" fill="none" stroke="' + el.fill + '" stroke-width="' + r2(sw) + '" stroke-linecap="' + (el.cap === 'round' ? 'round' : 'butt') + '"/>';
    };

    P.textPos = function (el, ctx) {
        var fl = findA(el, 'followLabel');
        if (fl) {
            var dot = ctx.byId[fl.target], fa = dot ? findA(dot, 'follow') : null;
            var p = fa ? P.followPos(fa, ctx.t) : [0, 0];
            return [p[0] + fl.dx, p[1] + fl.dy];
        }
        return [el.x, el.y];
    };

    P.textString = function (el, t) {
        var a = findA(el, 'count');
        if (a) { return DG.fmt(DG.lerp(el.count.from, el.count.to, DG.animF(a, t)), el.count.fmt); }
        var fl = findA(el, 'followLabel');
        if (fl && fl.vals) { return DG.fmt(DG.interp(fl.times, fl.vals, t), fl.fmt); }
        var ty = findA(el, 'type');
        if (ty) { return String(el.text).substring(0, Math.round(String(el.text).length * DG.clamp(DG.animF(ty, t), 0, 1))); }
        return el.text;
    };

    P.text = function (el, ctx) {
        var p = P.textPos(el, ctx), s = P.textString(el, ctx.t);
        if (s === '') { return ''; }
        var anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
        return '<text x="' + r2(p[0]) + '" y="' + r2(p[1]) + '" font-family="' + esc(el.fontCSS) + '" font-weight="' + (el.weight || 400) + '" font-size="' + r2(el.size) + '"' +
            ' fill="' + el.color + '" text-anchor="' + anchor + '"' + (el.track ? ' letter-spacing="' + r2(el.track / 1000 * el.size) + '"' : '') +
            ' style="white-space:pre">' + esc(s) + '</text>';
    };

    root.DGPreview = P;
    if (typeof module !== 'undefined' && module.exports) { module.exports = P; }
}(typeof window !== 'undefined' ? window : globalThis));
