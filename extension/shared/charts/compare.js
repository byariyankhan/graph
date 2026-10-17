/*
 * Comparison charts — "before vs after", gains vs losses.
 * Variants:
 *   slope      data: label, value A, value B   (headers = the two periods)
 *   dumbbell   data: label, value A, value B
 *   waterfall  data: label, value — first row = starting total, the rest
 *              are changes (+/−); the final total is added automatically
 *   diverging  data: label, change (positive → right, negative → left)
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.compare = [
    { id: 'slope', label: 'Slope (then → now)' },
    { id: 'dumbbell', label: 'Dumbbell' },
    { id: 'waterfall', label: 'Waterfall' },
    { id: 'diverging', label: 'Gains & losses (+/−)' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.compare = {
    label: 'Compare', order: 9,
    icon: '<line x1="8" y1="24" x2="36" y2="8" stroke-width="2.5"/><line x1="8" y1="10" x2="36" y2="20" stroke-width="2.5" opacity=".5"/><circle cx="8" cy="24" r="3"/><circle cx="36" cy="8" r="3"/><circle cx="8" cy="10" r="3" opacity=".5"/><circle cx="36" cy="20" r="3" opacity=".5"/>',
    live: [],
    columns: {"_": "label, then, now", "waterfall": "label, value (first row = start total, then +/\u2212 changes)", "diverging": "label, change (+/\u2212)"},
    ai: {"_": "Columns: label, value then, value now. Put the two periods (e.g. 1990, 2020) as the header names.", "waterfall": "Columns: step, value. First row = the starting total, then one row per change (+ or \u2212). Do not add the final total.", "diverging": "Columns: label, change. Changes can be positive or negative."}
};

DG.charts.compare = function (ctx) {
    var variant = ctx.spec.variant || 'slope';
    var data = DG.seriesData(ctx.table);
    if (!data.cats.length || !data.series.length) { return ctx.empty(); }
    if (variant === 'waterfall') { return DG.cmpWaterfall(ctx, data); }
    if (variant === 'diverging') { return DG.cmpDiverging(ctx, data); }
    if (data.series.length < 2) { return ctx.empty('Needs: label, value A, value B'); }
    return variant === 'dumbbell' ? DG.cmpDumbbell(ctx, data) : DG.cmpSlope(ctx, data);
};

/* Up / down colours: palette green & red where the theme has them. */
DG.upDown = function (th) { return { up: th.up || '#3DAA6E', down: th.down || '#E0533D' }; };

DG.cmpSlope = function (ctx, data) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i;
    var A = data.series[0], B = data.series[1], n = data.cats.length, F = ctx.F();
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < n; i++) {
        if (A.values[i] !== null) { lo = Math.min(lo, A.values[i]); hi = Math.max(hi, A.values[i]); }
        if (B.values[i] !== null) { lo = Math.min(lo, B.values[i]); hi = Math.max(hi, B.values[i]); }
    }
    var labS = Math.min(28 * u, P.h / n * 0.5), labW = 0;
    for (i = 0; i < n; i++) { labW = Math.max(labW, DG.textW(data.cats[i] + '  ' + DG.fmt(Math.max(A.values[i] || 0, B.values[i] || 0), F), labS)); }
    labW = Math.min(labW + 30 * u, P.w * 0.32);
    var xA = P.x + labW, xB = P.x + P.w - labW, top = P.y + 70 * u, bot = P.y + P.h - 10 * u;
    var Y = function (v) { return hi === lo ? (top + bot) / 2 : bot - (v - lo) / (hi - lo) * (bot - top); };
    /* period headers + axis lines */
    ctx.text('Period A', A.name, xA, P.y + 30 * u, 34 * u, { align: 'center', font: 'title', color: th.muted, anim: ctx.fadeIn(T.axes) });
    ctx.text('Period B', B.name, xB, P.y + 30 * u, 34 * u, { align: 'center', font: 'title', color: th.text, anim: ctx.fadeIn(T.axes + 0.1) });
    ctx.add({ type: 'line', name: 'Axis A', layer: 'Axes', x1: xA, y1: top - 10 * u, x2: xA, y2: bot + 10 * u, stroke: th.grid, sw: 3 * u, cap: 'butt', anim: ctx.A('draw', T.axes, 0.6) });
    ctx.add({ type: 'line', name: 'Axis B', layer: 'Axes', x1: xB, y1: top - 10 * u, x2: xB, y2: bot + 10 * u, stroke: th.grid, sw: 3 * u, cap: 'butt', anim: ctx.A('draw', T.axes + 0.1, 0.6) });
    var ud = DG.upDown(th), stag = Math.min(T.stagger * 2, 1.2 / n);
    /* push labels apart on each side so they never overlap */
    var spread = function (ys) {
        var idx = DG.range(ys.length), out = ys.slice(0), k, gap = labS * 1.25;
        idx.sort(function (a, b) { return ys[a] - ys[b]; });
        for (k = 1; k < idx.length; k++) { if (out[idx[k]] - out[idx[k - 1]] < gap) { out[idx[k]] = out[idx[k - 1]] + gap; } }
        return out;
    };
    var ya = [], yb = [];
    for (i = 0; i < n; i++) { ya.push(Y(A.values[i] || 0)); yb.push(Y(B.values[i] || 0)); }
    var la = spread(ya), lb = spread(yb);
    for (i = 0; i < n; i++) {
        if (A.values[i] === null || B.values[i] === null) { continue; }
        var hl = o.highlight ? DG.inList(data.cats[i], o.highlight) : true;
        var col = o.highlight ? (hl ? th.hi : th.dim) : (B.values[i] >= A.values[i] ? ud.up : ud.down);
        var t0 = T.data + i * stag;
        ctx.add({ type: 'line', name: 'Slope ' + data.cats[i], x1: xA, y1: ya[i], x2: xB, y2: yb[i], stroke: col, sw: (hl ? 5 : 3) * u, cap: 'round', glow: th.glow && hl, anim: ctx.A('draw', t0 + 0.2, T.grow) });
        ctx.add({ type: 'circle', name: 'Dot A ' + data.cats[i], layer: 'Dots', cx: xA, cy: ya[i], r: 9 * u, fill: col, anim: ctx.A('pop', t0, T.pop, { over: ctx.over }) });
        ctx.add({ type: 'circle', name: 'Dot B ' + data.cats[i], layer: 'Dots', cx: xB, cy: yb[i], r: 9 * u, fill: col, anim: ctx.A('pop', t0 + 0.2 + T.grow * 0.9, T.pop, { over: ctx.over }) });
        var aVal = '  ' + DG.fmt(A.values[i], DG.extend({}, F, { ref: A.values[i] }));
        ctx.text('Label A ' + data.cats[i], DG.ellipsis(data.cats[i], labS, labW - 30 * u - DG.textW(aVal, labS)) + aVal, xA - 18 * u, la[i] + labS * 0.36, labS,
            { align: 'right', color: hl ? th.text : th.muted, font: hl && o.highlight ? 'title' : 'body', anim: ctx.fadeIn(t0, 0) });
        ctx.countText('Label B ' + data.cats[i], A.values[i], B.values[i], DG.extend({}, F, { ref: B.values[i] }), xB + 18 * u, lb[i] + labS * 0.36, labS,
            { color: hl ? col : th.muted }, t0 + 0.2, T.grow);
    }
};

DG.cmpDumbbell = function (ctx, data) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i, k;
    var A = data.series[0], B = data.series[1], n = data.cats.length, F = ctx.F();
    var order = DG.range(n);
    if (o.sort !== 'none') { order.sort(function (a, b) { return (B.values[b] || 0) - (B.values[a] || 0); }); }
    var lo = Infinity, hi = -Infinity;
    for (i = 0; i < n; i++) { lo = Math.min(lo, A.values[i] || 0, B.values[i] || 0); hi = Math.max(hi, A.values[i] || 0, B.values[i] || 0); }
    var tk = DG.ticks(lo >= 0 && lo < hi * 0.4 ? 0 : lo, hi, 5);
    /* legend: A muted, B accent */
    var cA = th.muted, cB = o.highlight ? th.dim : th.accent;
    DG.legend(ctx, [{ name: A.name, color: cA, round: true }, { name: B.name, color: th.accent, round: true }], T.axes);
    P = ctx.plot;
    var labS = Math.min(28 * u, P.h / n * 0.45), labW = 0;
    for (i = 0; i < n; i++) { labW = Math.max(labW, DG.textW(data.cats[i], labS)); }
    labW = Math.min(labW + 26 * u, P.w * 0.3);
    var px = P.x + labW, pw = P.w - labW - 120 * u, py = P.y, ph = P.h - 46 * u, rowH = ph / n;
    var X = function (v) { return px + (v - tk.min) / (tk.max - tk.min) * pw; };
    var tf = DG.tickFmt(F, tk);
    for (k = 0; k < tk.ticks.length; k++) {
        var gx = X(tk.ticks[k]);
        ctx.add({ type: 'line', name: 'Grid ' + k, layer: 'Grid', x1: gx, y1: py, x2: gx, y2: py + ph, stroke: th.grid, sw: th.gridW * u, dash: th.gridDash, cap: 'butt', anim: ctx.A('draw', T.axes + k * 0.04, 0.7) });
        ctx.text('Tick ' + k, DG.fmt(tk.ticks[k], tf), gx, py + ph + 34 * u, 22 * u, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + k * 0.04, 0) });
    }
    var stag = Math.min(T.stagger * 1.5, 1.4 / n), r = Math.min(13 * u, rowH * 0.3);
    for (k = 0; k < n; k++) {
        i = order[k];
        if (A.values[i] === null || B.values[i] === null) { continue; }
        var cy = py + rowH * (k + 0.5), xa = X(A.values[i]), xb = X(B.values[i]), t0 = T.data + k * stag;
        var hl = o.highlight && DG.inList(data.cats[i], o.highlight), colB = hl ? th.hi : cB;
        ctx.text('Label ' + data.cats[i], data.cats[i], px - 18 * u, cy + labS * 0.36, labS, { align: 'right', font: hl ? 'title' : 'body', color: hl || !o.highlight ? th.text : th.muted, anim: ctx.fadeIn(t0, 0) });
        ctx.add({ type: 'line', name: 'Gap ' + data.cats[i], x1: xa, y1: cy, x2: xb, y2: cy, stroke: hl ? th.hi : th.grid, sw: r * 0.7, cap: 'butt', anim: ctx.A('draw', t0 + T.pop * 0.6, T.grow) });
        ctx.add({ type: 'circle', name: 'A ' + data.cats[i], layer: 'Dots A', cx: xa, cy: cy, r: r, fill: cA, anim: ctx.A('pop', t0, T.pop, { over: ctx.over }) });
        ctx.add({ type: 'circle', name: 'B ' + data.cats[i], cx: xb, cy: cy, r: r * 1.15, fill: colB, glow: th.glow, anim: ctx.A('pop', t0 + T.pop * 0.6 + T.grow * 0.85, T.pop, { over: ctx.over }) });
        var d = B.values[i] - A.values[i], dfmt = DG.extend({}, F, { prefix: (d >= 0 ? '+' : '') + (F.prefix || ''), ref: Math.abs(d) });
        ctx.countText('Change ' + data.cats[i], 0, d, dfmt, px + pw + 110 * u, cy + labS * 0.36, labS * 0.9,
            { align: 'right', color: d >= 0 ? DG.upDown(th).up : DG.upDown(th).down }, t0 + T.pop * 0.6, T.grow);
    }
};

DG.cmpWaterfall = function (ctx, data) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i;
    var V = data.series[0].values, n = data.cats.length, F = ctx.F(), ud = DG.upDown(th);
    /* steps: start total, deltas, end total */
    var steps = [], run = 0;
    for (i = 0; i < n; i++) {
        var v = V[i] || 0;
        if (i === 0) { steps.push({ name: data.cats[i], from: 0, to: v, total: true }); run = v; } else { steps.push({ name: data.cats[i], from: run, to: run + v, delta: v }); run += v; }
    }
    if (o.endTotal !== false) { steps.push({ name: o.totalLabel || 'Total', from: 0, to: run, total: true }); }
    var lo = 0, hi = 0;
    for (i = 0; i < steps.length; i++) { lo = Math.min(lo, steps[i].from, steps[i].to); hi = Math.max(hi, steps[i].from, steps[i].to); }
    var tk = DG.ticks(lo, hi, 5), axW = DG.tickLabelW(ctx, tk, F);
    var px = P.x + axW, pw = P.w - axW, py = P.y + 44 * u, ph = P.h - 44 * u - 58 * u;
    var Y = function (vv) { return py + ph - (vv - tk.min) / (tk.max - tk.min) * ph; };
    DG.yGrid(ctx, tk, px, px + pw, Y, F);
    var m = steps.length, band = pw / m, bw = band * 0.62, stag = T.grow * 0.75;
    for (i = 0; i < m; i++) {
        var s = steps[i], x = px + band * i + (band - bw) / 2, ya = Y(s.from), yb = Y(s.to), t0 = T.data + i * stag;
        var up = s.to >= s.from, col = s.total ? th.accent : (up ? ud.up : ud.down);
        if (o.highlight && DG.inList(s.name, o.highlight)) { col = th.hi; }
        ctx.add({
            type: 'rect', name: 'Step ' + s.name, x: x, y: Math.min(ya, yb), w: bw, h: Math.max(1, Math.abs(yb - ya)), fill: col, r: Math.min(th.radius * u, bw / 4),
            glow: th.glow, anim: ctx.A('grow', t0, T.grow * 0.9, { dir: up ? 'up' : 'down' })
        });
        var lab = s.total ? s.to : s.delta, lf = DG.extend({}, F, { ref: Math.abs(lab), prefix: (!s.total && lab > 0 ? '+' : '') + (F.prefix || '') });
        ctx.countText('Value ' + s.name, 0, lab, lf, x + bw / 2, Math.min(ya, yb) - 14 * u, Math.min(26 * u, DG.fit(DG.fmt(lab, lf), 26 * u, band, 12 * u)),
            { align: 'center', color: s.total ? th.text : col }, t0, T.grow * 0.9);
        ctx.text('Label ' + s.name, s.name, x + bw / 2, py + ph + 40 * u, DG.fit(s.name, 24 * u, band * 0.96, 12 * u),
            { align: 'center', color: s.total ? th.text : th.muted, font: s.total ? 'title' : 'body', anim: ctx.fadeIn(t0, 0) });
        if (i < m - 1) {
            var yc = Y(s.to);
            ctx.add({ type: 'line', name: 'Link ' + i, layer: 'Links', x1: x + bw, y1: yc, x2: x + band + bw, y2: yc, stroke: th.axis, sw: 2 * u, dash: [6, 6], cap: 'butt', anim: ctx.A('draw', t0 + T.grow * 0.8, 0.35, { ease: 'out' }) });
        }
    }
};

DG.cmpDiverging = function (ctx, data) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i, k;
    var V = data.series[0].values, n = data.cats.length, F = ctx.F(), ud = DG.upDown(th);
    var order = DG.range(n);
    if (o.sort !== 'none') { order.sort(function (a, b) { return (V[b] || 0) - (V[a] || 0); }); }
    var m = 0;
    for (i = 0; i < n; i++) { m = Math.max(m, Math.abs(V[i] || 0)); }
    var tk = DG.ticks(-m, m, 5);
    var labS = Math.min(28 * u, P.h / n * 0.45), labW = 0;
    for (i = 0; i < n; i++) { labW = Math.max(labW, DG.textW(data.cats[i], labS)); }
    labW = Math.min(labW + 30 * u, P.w * 0.28);
    var px = P.x + labW, pw = P.w - labW - 20 * u, py = P.y, ph = P.h - 46 * u, rowH = ph / n;
    var lim = Math.max(Math.abs(tk.min), Math.abs(tk.max));
    var X = function (v) { return px + pw / 2 + v / lim * (pw / 2 - 90 * u); };
    ctx.add({ type: 'line', name: 'Zero', x1: X(0), y1: py - 10 * u, x2: X(0), y2: py + ph, stroke: th.axis, sw: 3 * u, cap: 'butt', anim: ctx.A('draw', T.axes, 0.6) });
    var stag = Math.min(T.stagger, 1.4 / n), bh = rowH * 0.66;
    for (k = 0; k < n; k++) {
        i = order[k];
        var v = V[i] || 0, cy = py + rowH * (k + 0.5), x0 = X(0), x1 = X(v), t0 = T.data + k * stag;
        var hl = o.highlight && DG.inList(data.cats[i], o.highlight);
        var col = hl ? th.hi : (o.highlight ? th.dim : (v >= 0 ? ud.up : ud.down));
        ctx.text('Label ' + data.cats[i], data.cats[i], px - 16 * u, cy + labS * 0.36, labS, { align: 'right', font: hl ? 'title' : 'body', color: hl || !o.highlight ? th.text : th.muted, anim: ctx.fadeIn(t0, 0) });
        ctx.add({ type: 'rect', name: 'Bar ' + data.cats[i], x: Math.min(x0, x1), y: cy - bh / 2, w: Math.max(1, Math.abs(x1 - x0)), h: bh, fill: col, r: Math.min(th.radius * u, bh / 2), glow: th.glow, anim: ctx.A('grow', t0, T.grow, { dir: v >= 0 ? 'right' : 'left', over: ctx.over ? 1.03 : 0 }) });
        var vf = DG.extend({}, F, { prefix: (v > 0 ? '+' : '') + (F.prefix || ''), ref: Math.abs(v) });
        ctx.countText('Value ' + data.cats[i], 0, v, vf, v >= 0 ? x1 + 12 * u : x1 - 12 * u, cy + labS * 0.36, labS * 0.9, { align: v >= 0 ? 'left' : 'right', color: col }, t0, T.grow);
    }
};
