/*
 * Bar / Column charts.
 * Variants: column, horizontal, grouped, stacked, percent, lollipop.
 * Data: first column = categories, other columns = series.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.bar = [
    { id: 'column', label: 'Column' },
    { id: 'horizontal', label: 'Horizontal (ranking)' },
    { id: 'grouped', label: 'Grouped' },
    { id: 'stacked', label: 'Stacked' },
    { id: 'percent', label: '100% Stacked' },
    { id: 'lollipop', label: 'Lollipop' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.bar = {
    label: 'Bar', order: 1,
    icon: '<rect x="4" y="16" width="8" height="12"/><rect x="16" y="6" width="8" height="22"/><rect x="28" y="11" width="8" height="17"/>',
    live: ["column", "horizontal", "grouped"],
    columns: {"_": "label, value[, value\u2026]"},
    ai: {"_": "First column = category (e.g. country). One more column per series (e.g. one per year). One row per category."}
};

DG.charts.bar = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T;
    var variant = ctx.spec.variant || 'column';
    var data = DG.seriesData(ctx.table);
    if (!data.cats.length || !data.series.length) { return ctx.empty(); }

    var horiz = variant === 'horizontal' || (o.orientation === 'horizontal' && variant !== 'column');
    var mode = variant === 'stacked' ? 'stack' : variant === 'percent' ? 'percent' : variant === 'lollipop' ? 'lolli' : 'group';
    var S = data.series;
    if (mode === 'lolli' || (mode === 'group' && variant !== 'grouped' && o.allSeries === false)) { S = [S[0]]; }
    var nS = S.length, n = data.cats.length, i, k, s;

    /* Sorting (single series only) */
    var order = DG.range(n);
    if (o.sort === 'desc' || o.sort === 'asc') {
        var key = function (ix) {
            var t = 0;
            for (var q = 0; q < nS; q++) { t += S[q].values[ix] || 0; }
            return t;
        };
        order.sort(function (a, b) { return o.sort === 'desc' ? key(b) - key(a) : key(a) - key(b); });
    }

    /* Values per category (normalised for percent) */
    var vals = [], totals = [];
    for (i = 0; i < n; i++) {
        var row = [], tot = 0;
        for (s = 0; s < nS; s++) {
            var v = S[s].values[i];
            if (v === null) { v = 0; }
            if (mode === 'stack' || mode === 'percent') { v = Math.max(0, v); }
            row.push(v); tot += v;
        }
        if (mode === 'percent') { for (s = 0; s < nS; s++) { row[s] = tot > 0 ? row[s] / tot * 100 : 0; } }
        vals.push(row); totals.push(mode === 'percent' ? 100 : tot);
    }

    var dmin = 0, dmax = 0;
    for (i = 0; i < n; i++) {
        if (mode === 'stack' || mode === 'percent') { dmax = Math.max(dmax, totals[i]); } else {
            for (s = 0; s < nS; s++) { dmax = Math.max(dmax, vals[i][s]); dmin = Math.min(dmin, vals[i][s]); }
        }
    }
    /* live data (AE sliders) for column / horizontal / grouped with values ≥ 0 */
    var live = ctx.live && mode === 'group' && dmin >= 0;
    var tk = mode === 'percent' ? { min: 0, max: 100, step: 25, ticks: [0, 25, 50, 75, 100], decimals: 0 }
        : live ? DG.liveTicks(dmax) : DG.ticks(dmin, dmax, Number(o.ticks) || 5);
    var cellOf = [], liveMax = null;
    if (live) {
        var allCells = [];
        for (i = 0; i < n; i++) {
            cellOf.push([]);
            for (s = 0; s < nS; s++) {
                var c = ctx.cell((nS > 1 ? S[s].name + ' ' : '') + data.cats[i], vals[i][s]);
                cellOf[i].push(c); allCells.push(c);
            }
        }
        liveMax = { cells: allCells, nice: true };
    }
    var F = mode === 'percent' ? ctx.F({ suffix: '%', prefix: '', decimals: 0, compact: 'none' }) : ctx.F();

    /* Colours: multi-series → palette; single → highlight/dim or one colour */
    var colorOf = function (ci, si) {
        if (nS > 1) { return ctx.color(si); }
        if (o.highlight) { return DG.inList(data.cats[ci], o.highlight) ? th.hi : th.dim; }
        if (o.colorBy === 'category') { return ctx.color(ci); }
        return ctx.color(0);
    };
    if (nS > 1) {
        var items = [];
        for (s = 0; s < nS; s++) { items.push({ name: S[s].name, color: ctx.color(s) }); }
        DG.legend(ctx, items, T.axes);
    }

    var showVals = o.values !== false;
    var gap = o.gap !== undefined && o.gap !== '' ? Number(o.gap) : (n > 14 ? 0.18 : 0.3);
    var P = ctx.plot;
    var stag = Math.min(T.stagger, (T.draw * 0.6) / Math.max(1, n));
    var segDur = (mode === 'stack' || mode === 'percent') ? T.grow * 0.7 : T.grow;

    function catStart(k2) { return T.data + k2 * stag; }

    if (!horiz) {
        /* ---------------- vertical columns ---------------- */
        var axW = DG.tickLabelW(ctx, tk, F);
        var catSize = 26 * u;
        var px = P.x + axW, pw = P.w - axW, py = P.y + (showVals ? 46 * u : 10 * u), ph = P.h - (py - P.y) - 58 * u;
        var Y = function (v2) { return py + ph - (v2 - tk.min) / (tk.max - tk.min) * ph; };
        DG.yGrid(ctx, tk, px, px + pw, Y, F, { liveMax: liveMax });
        var band = pw / n, bw = band * (1 - gap);
        var labelSize = catSize;
        /* readable labels: if they would be tiny, show every 2nd/3rd one instead */
        var labEvery = 1, longest = 0;
        for (k = 0; k < n; k++) { longest = Math.max(longest, DG.textW(data.cats[order[k]], 18 * u)); }
        while (labEvery < n && longest > band * labEvery * 0.95) { labEvery++; }
        for (k = 0; k < n; k++) { labelSize = Math.min(labelSize, DG.fit(data.cats[order[k]], catSize, band * labEvery * 0.96, 16 * u)); }

        for (k = 0; k < n; k++) {
            i = order[k];
            var bx = px + band * k + (band - bw) / 2, cx = px + band * (k + 0.5);
            var t0 = catStart(k);
            var isHlCat = o.highlight && DG.inList(data.cats[i], o.highlight);
            if (k % labEvery === 0 || isHlCat) ctx.text('Label ' + data.cats[i], DG.ellipsis(data.cats[i], labelSize, band * labEvery * 0.98), cx, py + ph + 40 * u, labelSize, {
                align: 'center', color: (o.highlight && DG.inList(data.cats[i], o.highlight)) ? th.text : th.muted,
                font: (o.highlight && DG.inList(data.cats[i], o.highlight)) ? 'title' : 'body', anim: ctx.fadeIn(t0, 10 * u)
            });
            if (mode === 'group' || mode === 'lolli') {
                var sub = bw / nS;
                for (s = 0; s < nS; s++) {
                    var v3 = vals[i][s], y0 = Y(Math.max(tk.min, 0)), y1 = Y(v3);
                    var x0 = bx + sub * s, w0 = sub * (nS > 1 ? 0.9 : 1), mid = x0 + w0 / 2;
                    var ts = t0 + s * 0.08;
                    var nm = (nS > 1 ? S[s].name + ' - ' : '') + data.cats[i];
                    if (mode === 'lolli') {
                        var rr = Math.min(18 * u, band * 0.3);
                        ctx.add({
                            type: 'line', name: 'Stem ' + nm, x1: mid, y1: y0, x2: mid, y2: y1, stroke: colorOf(i, s), sw: 4 * u, cap: 'butt',
                            anim: ctx.A('draw', ts, T.grow)
                        });
                        ctx.add({
                            type: 'circle', name: 'Dot ' + nm, cx: mid, cy: y1, r: rr, fill: colorOf(i, s),
                            anim: ctx.A('pop', ts + T.grow * 0.8, T.pop, { over: ctx.over })
                        });
                        y1 = v3 >= 0 ? y1 - rr : y1 + rr;
                    } else {
                        var br = ctx.add({
                            type: 'rect', name: 'Bar ' + nm, x: x0, y: Math.min(y0, y1), w: w0, h: Math.abs(y1 - y0),
                            fill: colorOf(i, s), r: Math.min(th.radius * u, w0 / 2), glow: th.glow,
                            anim: ctx.A('grow', ts, T.grow, { dir: v3 >= 0 ? 'up' : 'down', over: ctx.over ? 1.04 : 0 })
                        });
                        if (live) { br.live = { kind: 'bar', cell: cellOf[i][s], dir: 'up', base: y0, len: ph, max: liveMax }; }
                    }
                    var vs = DG.fmt(v3, DG.extend({}, F, { ref: v3 }));
                    var vSize = Math.min(28 * u, DG.fit(vs, 28 * u, sub * 1.1, 12 * u));
                    /* value labels only where they fit (thin grouped bars would collide) */
                    if (showVals && ((vSize >= 15 * u && sub >= 30 * u) || o.values === true)) {
                        var vl = ctx.countText('Value ' + nm, 0, v3, F, mid, v3 >= 0 ? y1 - 14 * u : y1 + vSize + 10 * u, vSize,
                            { align: 'center', color: th.text }, ts, T.grow);
                        if (live && mode !== 'lolli') { vl.live = { kind: 'value', cell: cellOf[i][s], pos: { kind: 'barEnd', dir: 'up', base: y0, len: ph, max: liveMax, off: 14 * u, at: mid } }; }
                    }
                }
            } else {
                var base = 0;
                for (s = 0; s < nS; s++) {
                    var sv = vals[i][s];
                    var ya = Y(base), yb = Y(base + sv), tss = t0 + s * segDur * 0.75;
                    ctx.add({
                        type: 'rect', name: 'Bar ' + S[s].name + ' - ' + data.cats[i], x: bx, y: yb, w: bw, h: ya - yb,
                        fill: colorOf(i, s), r: 0, glow: th.glow, anim: ctx.A('grow', tss, segDur, { dir: 'up' })
                    });
                    if (showVals && ya - yb > 34 * u && bw > 50 * u) {
                        var inF = mode === 'percent' ? F : DG.extend({}, F, { ref: sv });
                        ctx.countText('Value ' + S[s].name + ' - ' + data.cats[i], 0, sv, inF, bx + bw / 2, (ya + yb) / 2 + 9 * u,
                            Math.min(24 * u, DG.fit(DG.fmt(sv, inF), 24 * u, bw * 0.9, 12 * u)),
                            { align: 'center', color: DG.luma(colorOf(i, s)) > 0.6 ? '#111111' : '#FFFFFF' }, tss, segDur);
                    }
                    base += sv;
                }
                if (showVals && mode === 'stack') {
                    ctx.countText('Total ' + data.cats[i], 0, totals[i], DG.extend({}, F, { ref: totals[i] }), bx + bw / 2, Y(totals[i]) - 14 * u,
                        Math.min(28 * u, DG.fit(DG.fmt(totals[i], F), 28 * u, band, 12 * u)), { align: 'center' }, t0, segDur * (nS * 0.75 + 0.25));
                }
            }
        }
        return;
    }

    /* ---------------- horizontal bars (ranking style) ---------------- */
    var lblSize = Math.min(30 * u, Math.max(16 * u, P.h / n * 0.42));
    var lblW = 0, valW = 0;
    for (i = 0; i < n; i++) {
        lblW = Math.max(lblW, DG.textW(data.cats[i], lblSize));
        if (showVals) { valW = Math.max(valW, DG.textW(DG.fmt(mode === 'stack' ? totals[i] : DG.maxOf(vals[i]), F), lblSize)); }
    }
    lblW = Math.min(lblW + 26 * u, P.w * 0.38);
    valW = (showVals && mode !== 'percent') ? valW + 26 * u : 0;
    var hx = P.x + lblW, hw = P.w - lblW - valW;
    var axisH = (o.axis !== false) ? 44 * u : 0;
    var hy = P.y, hh = P.h - axisH;
    var X = function (v4) { return hx + (v4 - tk.min) / (tk.max - tk.min) * hw; };
    if (o.axis !== false || o.grid !== false) {
        var tf = DG.tickFmt(F, tk);
        for (k = 0; k < tk.ticks.length; k++) {
            var gx = X(tk.ticks[k]);
            ctx.add({
                type: 'line', name: 'Grid ' + k, layer: 'Grid', x1: gx, y1: hy, x2: gx, y2: hy + hh,
                stroke: tk.ticks[k] === 0 ? th.axis : th.grid, sw: th.gridW * u, dash: tk.ticks[k] === 0 ? null : th.gridDash, cap: 'butt',
                anim: ctx.A('draw', T.axes + k * 0.05, 0.7, { ease: 'out' })
            });
            if (o.axis !== false) {
                var htl = ctx.text('Tick ' + k, DG.fmt(tk.ticks[k], tf), gx, hy + hh + 36 * u, 22 * u,
                    { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + k * 0.05, 0) });
                if (live) { htl.live = { kind: 'tick', frac: k / (tk.ticks.length - 1), max: liveMax, fmt: tf }; }
            }
        }
    }
    var hband = hh / n, bh = hband * (1 - gap);
    for (k = 0; k < n; k++) {
        i = order[k];
        var by = hy + hband * k + (hband - bh) / 2, cy = hy + hband * (k + 0.5), t1 = catStart(k);
        var hl = o.highlight && DG.inList(data.cats[i], o.highlight);
        ctx.text('Label ' + data.cats[i], data.cats[i], hx - 18 * u, cy + lblSize * 0.36, DG.fit(data.cats[i], lblSize, lblW - 24 * u, 12 * u), {
            align: 'right', color: hl || !o.highlight ? th.text : th.muted, font: hl ? 'title' : 'body', anim: ctx.fadeIn(t1, 0)
        });
        if (mode === 'group' || mode === 'lolli') {
            var subh = bh / nS;
            for (s = 0; s < nS; s++) {
                var hv = vals[i][s], xa = X(Math.max(tk.min, 0)), xb = X(hv);
                var sy = by + subh * s, sh = subh * (nS > 1 ? 0.88 : 1), my = sy + sh / 2, tsh = t1 + s * 0.08;
                var hn = (nS > 1 ? S[s].name + ' - ' : '') + data.cats[i];
                if (mode === 'lolli') {
                    var hr = Math.min(16 * u, hband * 0.32);
                    ctx.add({ type: 'line', name: 'Stem ' + hn, x1: xa, y1: my, x2: xb, y2: my, stroke: colorOf(i, s), sw: 4 * u, cap: 'butt', anim: ctx.A('draw', tsh, T.grow) });
                    ctx.add({ type: 'circle', name: 'Dot ' + hn, cx: xb, cy: my, r: hr, fill: colorOf(i, s), anim: ctx.A('pop', tsh + T.grow * 0.8, T.pop, { over: ctx.over }) });
                    xb += hv >= 0 ? hr : -hr;
                } else {
                    var hbr = ctx.add({
                        type: 'rect', name: 'Bar ' + hn, x: Math.min(xa, xb), y: sy, w: Math.abs(xb - xa), h: sh, fill: colorOf(i, s),
                        r: Math.min(th.radius * u, sh / 2), glow: th.glow,
                        anim: ctx.A('grow', tsh, T.grow, { dir: hv >= 0 ? 'right' : 'left', over: ctx.over ? 1.03 : 0 })
                    });
                    if (live) { hbr.live = { kind: 'bar', cell: cellOf[i][s], dir: 'right', base: xa, len: hw, max: liveMax }; }
                }
                if (showVals) {
                    var hs = Math.min(lblSize, sh * 0.9 + 6 * u);
                    var hvl = ctx.countText('Value ' + hn, 0, hv, F, hv >= 0 ? xb + 14 * u : xb - 14 * u, my + hs * 0.36, hs,
                        { align: hv >= 0 ? 'left' : 'right', color: hl ? th.hi : th.text }, tsh, T.grow);
                    if (live && mode !== 'lolli') { hvl.live = { kind: 'value', cell: cellOf[i][s], pos: { kind: 'barEnd', dir: 'right', base: xa, len: hw, max: liveMax, off: 14 * u, at: my + hs * 0.36 } }; }
                }
            }
        } else {
            var hbase = 0;
            for (s = 0; s < nS; s++) {
                var hsv = vals[i][s], xl = X(hbase), xr = X(hbase + hsv), tst = t1 + s * segDur * 0.75;
                ctx.add({
                    type: 'rect', name: 'Bar ' + S[s].name + ' - ' + data.cats[i], x: xl, y: by, w: xr - xl, h: bh, fill: ctx.color(s), r: 0,
                    glow: th.glow, anim: ctx.A('grow', tst, segDur, { dir: 'right' })
                });
                if (showVals && xr - xl > 70 * u && bh > 26 * u) {
                    ctx.countText('Value ' + S[s].name + ' - ' + data.cats[i], 0, hsv, mode === 'percent' ? F : DG.extend({}, F, { ref: hsv }),
                        (xl + xr) / 2, by + bh / 2 + 8 * u, Math.min(22 * u, bh * 0.6),
                        { align: 'center', color: DG.luma(ctx.color(s)) > 0.6 ? '#111111' : '#FFFFFF' }, tst, segDur);
                }
                hbase += hsv;
            }
            if (showVals && mode === 'stack') {
                ctx.countText('Total ' + data.cats[i], 0, totals[i], F, X(totals[i]) + 14 * u, cy + lblSize * 0.36, lblSize,
                    { align: 'left' }, t1, segDur * (nS * 0.75 + 0.25));
            }
        }
    }
};
