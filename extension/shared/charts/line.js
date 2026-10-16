/*
 * Line / Area charts.
 * Variants: line, smooth, stepped, area, stacked (stacked area).
 * Data: first column = x (years or labels), other columns = series.
 * Signature documentary move: a dot travels on the tip of each line while a
 * label shows the live value at that point in time.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.line = [
    { id: 'line', label: 'Line' },
    { id: 'smooth', label: 'Smooth curve' },
    { id: 'stepped', label: 'Stepped' },
    { id: 'area', label: 'Area' },
    { id: 'stacked', label: 'Stacked area' }
];

DG.charts.line = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T;
    var variant = ctx.spec.variant || 'line';
    var data = DG.seriesData(ctx.table);
    var n = data.cats.length, S = data.series, nS = S.length, i, s, k;
    if (n < 2 || !nS) { return ctx.empty('Line charts need at least 2 rows'); }
    var stacked = variant === 'stacked', area = variant === 'area' || stacked;
    var smooth = variant === 'smooth' || (o.smooth === true && variant !== 'stepped');
    var stepped = variant === 'stepped';
    var F = ctx.F();

    /* x positions: proportional if every label is a number (years) */
    var numericX = true, xv = [];
    for (i = 0; i < n; i++) { var xn = DG.num(data.cats[i]); if (isNaN(xn)) { numericX = false; } xv.push(xn); }
    if (numericX) { for (i = 1; i < n; i++) { if (xv[i] <= xv[i - 1]) { numericX = false; } } }

    /* stacked cumulative values */
    var cum = [];
    for (s = 0; s < nS; s++) {
        var row = [];
        for (i = 0; i < n; i++) {
            var v = S[s].values[i];
            row.push(stacked ? (s > 0 ? cum[s - 1][i] : 0) + Math.max(0, v || 0) : v);
        }
        cum.push(row);
    }
    var lo = Infinity, hi = -Infinity;
    for (s = 0; s < nS; s++) { for (i = 0; i < n; i++) { if (cum[s][i] !== null) { lo = Math.min(lo, cum[s][i]); hi = Math.max(hi, cum[s][i]); } } }
    var zero = area || o.zero === true || (o.zero !== false && lo >= 0 && lo < hi * 0.45);
    var tk = DG.ticks(zero ? Math.min(0, lo) : lo, hi, Number(o.ticks) || 5);

    var endLabels = o.endLabels !== false && !stacked && nS <= 6;
    var hlOn = !!o.highlight;
    var colorOf = function (si) {
        if (hlOn) { return DG.inList(S[si].name, o.highlight) ? th.hi : th.dim; }
        return ctx.color(si);
    };
    if (nS > 1 && !endLabels) {
        var items = [];
        for (s = 0; s < nS; s++) { items.push({ name: S[s].name, color: colorOf(s) }); }
        DG.legend(ctx, items, T.axes);
    }

    var P = ctx.plot;
    var axW = DG.tickLabelW(ctx, tk, F);
    var endW = 0;
    if (endLabels || stacked) {
        for (s = 0; s < nS; s++) {
            endW = Math.max(endW, DG.textW(S[s].name, 24 * u), DG.textW(DG.fmt(DG.maxOf(S[s].values), DG.extend({}, F, { ref: hi })), 30 * u));
        }
        endW += 40 * u;
    }
    var px = P.x + axW, pw = P.w - axW - Math.max(endW, 20 * u), py = P.y + 20 * u, ph = P.h - 20 * u - 54 * u;
    var X = function (ix) { return numericX ? px + (xv[ix] - xv[0]) / (xv[n - 1] - xv[0]) * pw : px + ix / (n - 1) * pw; };
    var Y = function (v2) { return py + ph - (v2 - tk.min) / (tk.max - tk.min) * ph; };

    DG.yGrid(ctx, tk, px, px + pw, Y, F);

    /* x labels — thinned so they never collide */
    var xls = 24 * u, maxLW = 0;
    for (i = 0; i < n; i++) { maxLW = Math.max(maxLW, DG.textW(data.cats[i], xls)); }
    var every = Math.max(1, Math.ceil((maxLW + 24 * u) / (pw / Math.max(1, n - 1))));
    for (i = 0; i < n; i++) {
        if (i % every !== 0 && i !== n - 1) { continue; }
        if (i === n - 1 && i % every !== 0 && (n - 1) % every < every * 0.6) { continue; }
        ctx.add({ type: 'line', name: 'X Tick ' + i, layer: 'X Ticks', x1: X(i), y1: py + ph, x2: X(i), y2: py + ph + 10 * u, stroke: th.axis, sw: 2 * u, cap: 'butt', anim: ctx.A('fade', T.axes, 0.4, { ease: 'easy' }) });
        ctx.text('X ' + data.cats[i], data.cats[i], X(i), py + ph + 42 * u, xls, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + i * 0.01, 0) });
    }

    var t0 = T.data, t1 = T.data + T.draw;
    var tips = [];

    /* Build a path (+ per-vertex values) for one series */
    function seriesPath(arr, src) {
        var pts = [], vals = [];
        for (var q = 0; q < n; q++) {
            if (arr[q] === null || arr[q] === undefined) { continue; }
            var p = [X(q), Y(arr[q])];
            if (stepped && pts.length) {
                pts.push([p[0], pts[pts.length - 1][1]]); vals.push(vals[vals.length - 1]);
            }
            pts.push(p); vals.push(src[q] === null ? 0 : src[q]);
        }
        var path = smooth ? DG.smooth(pts) : DG.straight(pts);
        path.vals = vals;
        return path;
    }

    for (s = 0; s < nS; s++) {
        var col = colorOf(s);
        var isHl = !hlOn || DG.inList(S[s].name, o.highlight);
        var lp = seriesPath(cum[s], S[s].values);
        if (lp.pts.length < 2) { continue; }
        var times = DG.vertexTimes(lp, t0, t1);

        if (area) {
            var lower;
            if (stacked && s > 0) { lower = seriesPath(cum[s - 1], S[s].values); } else {
                var base = [];
                for (k = 0; k < lp.pts.length; k++) { base.push([lp.pts[k][0], Y(Math.max(tk.min, 0))]); }
                lower = DG.straight(base);
            }
            var ap = { pts: [], inT: [], outT: [] };
            for (k = 0; k < lp.pts.length; k++) { ap.pts.push(lp.pts[k]); ap.inT.push(lp.inT[k]); ap.outT.push(lp.outT[k]); }
            for (k = lower.pts.length - 1; k >= 0; k--) { ap.pts.push(lower.pts[k]); ap.inT.push(lower.outT[k]); ap.outT.push(lower.inT[k]); }
            var xs = [];
            for (k = 0; k < lp.pts.length; k++) { xs.push(lp.pts[k][0]); }
            ctx.add({
                type: 'path', name: 'Area ' + S[s].name, pts: ap.pts, inT: ap.inT, outT: ap.outT, closed: true,
                fill: col, fillOpacity: stacked ? 0.88 : 0.22,
                anim: ctx.A('wipe', t0, T.draw, { ease: null, times: times, xs: xs, y0: py - 10 * u, y1: py + ph + 2 * u })
            });
        }
        ctx.add({
            type: 'path', name: 'Line ' + S[s].name, pts: lp.pts, inT: lp.inT, outT: lp.outT, closed: false,
            stroke: stacked ? DG.mix(col, th.bg, 0.0) : col, sw: (stacked ? 3 : (isHl ? th.lineW : th.lineW * 0.6)) * u,
            cap: 'round', join: 'round', glow: th.glow && isHl,
            anim: ctx.A('draw', t0, T.draw, { ease: null })
        });

        /* point markers, popping as the line reaches them */
        var dots = o.dots === true || (o.dots !== false && n <= 14 && !stacked && !stepped);
        if (dots) {
            for (k = 0; k < lp.pts.length; k++) {
                ctx.add({
                    type: 'circle', name: 'Point ' + S[s].name + ' ' + (k + 1), layer: 'Points ' + S[s].name, cx: lp.pts[k][0], cy: lp.pts[k][1],
                    r: 6 * u, fill: th.bg, stroke: col, sw: 3 * u, anim: ctx.A('pop', times[k], T.pop * 0.7, { over: ctx.over })
                });
            }
        }

        if (stacked) {
            var lastI = n - 1, midV = (cum[s][lastI] + (s > 0 ? cum[s - 1][lastI] : 0)) / 2;
            ctx.text('End ' + S[s].name, S[s].name, px + pw + 16 * u, Y(midV) + 8 * u, 24 * u, { color: col, font: 'title', anim: ctx.fadeIn(t1 - 0.3, 0) });
        } else if (endLabels) {
            var dot = ctx.add({
                type: 'circle', name: 'Tip ' + S[s].name, cx: lp.pts[0][0], cy: lp.pts[0][1], r: 10 * u, fill: col, stroke: th.bg, sw: 4 * u,
                anim: [ctx.A('follow', t0, T.draw, { ease: null, pts: lp.pts, inT: lp.inT, outT: lp.outT, times: times }),
                    ctx.A('pop', t0 - 0.2, T.pop, { over: ctx.over })]
            });
            tips.push({ dot: dot, s: s, col: col, path: lp, times: times, endY: lp.pts[lp.pts.length - 1][1] });
        }
    }

    /* End labels follow the tip; spread them so they do not overlap at the end */
    tips.sort(function (a, b) { return a.endY - b.endY; });
    var minGap = 62 * u, prevY = -Infinity, k2;
    for (k2 = 0; k2 < tips.length; k2++) {
        var want = tips[k2].endY, put = Math.max(want, prevY + minGap);
        tips[k2].shift = put - want; prevY = put;
    }
    for (k2 = 0; k2 < tips.length; k2++) {
        var tp = tips[k2], dy = tp.shift, vf = DG.extend({}, F, { ref: hi });
        var lastV = tp.path.vals[tp.path.vals.length - 1];
        ctx.text('Tip Name ' + S[tp.s].name, S[tp.s].name, 0, 0, 22 * u, {
            color: tp.col, font: 'title', anim: [
                ctx.A('followLabel', t0, T.draw, { target: tp.dot.id, targetName: tp.dot.name, dx: 22 * u, dy: dy - 10 * u, ease: null }),
                ctx.A('fade', t0, 0.4, { dy: 0, ease: 'easy' })]
        });
        var vt = ctx.text('Tip Value ' + S[tp.s].name, DG.fmt(lastV, vf), 0, 0, 30 * u, {
            color: th.text, font: 'num', anim: [
                ctx.A('followLabel', t0, T.draw, { target: tp.dot.id, targetName: tp.dot.name, dx: 22 * u, dy: dy + 24 * u, ease: null, times: tp.times, vals: tp.path.vals, fmt: vf }),
                ctx.A('fade', t0, 0.4, { dy: 0, ease: 'easy' })]
        });
        vt.liveFmt = vf;
    }
};
