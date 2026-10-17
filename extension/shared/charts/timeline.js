/*
 * Timelines — the history-documentary workhorse.
 * Variants: horizontal, vertical, eras (spans such as dynasties / empires).
 * Data (horizontal / vertical): date, title, [description]
 * Data (eras):                  start, end, label
 * Markers pop exactly when the drawing line reaches them.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.timeline = [
    { id: 'horizontal', label: 'Horizontal' },
    { id: 'vertical', label: 'Vertical (Shorts / list)' },
    { id: 'eras', label: 'Eras / spans' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.timeline = {
    label: 'Timeline', order: 5,
    icon: '<line x1="3" y1="15" x2="41" y2="15" stroke-width="2"/><circle cx="10" cy="15" r="3"/><circle cx="22" cy="15" r="3"/><circle cx="34" cy="15" r="3"/>',
    live: [],
    columns: {"_": "date, title[, note]", "eras": "start, end, label"},
    ai: {"_": "Columns: year (or date), event title, short note (max 6 words). One row per event, oldest first.", "eras": "Columns: start year, end year, period name. One row per period, oldest first."}
};

DG.charts.timeline = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'horizontal', i;
    var rows = ctx.table.rows, ev = [];
    for (i = 0; i < rows.length; i++) {
        if (!rows[i][0] && !rows[i][1]) { continue; }
        ev.push({ date: rows[i][0], d: DG.num(rows[i][0]), title: rows[i][1] || '', desc: rows[i][2] || '' });
    }
    if (!ev.length) { return ctx.empty(); }
    var dur = T.draw * 1.1, t0 = T.axes + 0.2;

    if (variant === 'eras') { return DG.timelineEras(ctx, ev); }

    var n = ev.length, numeric = true;
    for (i = 0; i < n; i++) { if (isNaN(ev[i].d)) { numeric = false; } }
    if (numeric) { ev.sort(function (a, b) { return a.d - b.d; }); }

    if (variant === 'vertical') {
        var lineX = ctx.portrait ? P.x + 40 * u : P.x + P.w * 0.28;
        var top = P.y + 10 * u, bot = P.y + P.h - 10 * u, rowH = (bot - top) / n;
        ctx.add({ type: 'line', name: 'Timeline Axis', x1: lineX, y1: top, x2: lineX, y2: bot, stroke: th.axis, sw: 4 * u, cap: 'round', anim: ctx.A('draw', t0, dur, { ease: null }) });
        var tsz = Math.min(34 * u, rowH * 0.36), ysz = Math.min(40 * u, rowH * 0.42);
        for (i = 0; i < n; i++) {
            var cy = top + rowH * (i + 0.5), tm = t0 + dur * (cy - top) / (bot - top);
            var hl = o.highlight && DG.inList(ev[i].title, o.highlight), col = hl ? th.hi : th.accent;
            ctx.add({ type: 'circle', name: 'Marker ' + ev[i].date, cx: lineX, cy: cy, r: (hl ? 15 : 11) * u, fill: col, stroke: th.bg, sw: 4 * u, glow: th.glow, anim: ctx.A('pop', tm - 0.1, T.pop, { over: ctx.over ? 1.3 : 0 }) });
            if (ctx.portrait) {
                ctx.text('Date ' + ev[i].date, ev[i].date, lineX + 36 * u, cy - 4 * u, ysz, { color: col, font: 'num', anim: ctx.fadeIn(tm, 0) });
                ctx.text('Event ' + ev[i].date, ev[i].title, lineX + 36 * u, cy + tsz * 1.1, DG.fit(ev[i].title, tsz * 0.85, P.w - 90 * u, 12 * u), { anim: ctx.fadeIn(tm + 0.08, 0) });
            } else {
                ctx.text('Date ' + ev[i].date, ev[i].date, lineX - 36 * u, cy + ysz * 0.36, ysz, { color: col, font: 'num', align: 'right', anim: ctx.fadeIn(tm, 0) });
                ctx.text('Event ' + ev[i].date, ev[i].title, lineX + 36 * u, cy + (ev[i].desc ? -2 * u : tsz * 0.36), DG.fit(ev[i].title, tsz, P.x + P.w - lineX - 40 * u, 12 * u), { font: hl ? 'title' : 'body', anim: ctx.fadeIn(tm + 0.08, 0) });
                if (ev[i].desc) {
                    ctx.text('Desc ' + ev[i].date, ev[i].desc, lineX + 36 * u, cy + tsz * 1.05, DG.fit(ev[i].desc, tsz * 0.7, P.x + P.w - lineX - 40 * u, 11 * u), { color: th.muted, anim: ctx.fadeIn(tm + 0.15, 0) });
                }
            }
        }
        return;
    }

    /* horizontal */
    var ax = P.y + P.h * 0.52, x0 = P.x + 20 * u, x1 = P.x + P.w - 20 * u;
    var pad = (x1 - x0) * 0.05;
    /* proportional spacing by date, unless events get too crowded */
    var prop = numeric && n > 1 && ev[n - 1].d > ev[0].d && o.spacing !== 'even';
    if (prop && o.spacing !== 'time') {
        var span = ev[n - 1].d - ev[0].d, usable = x1 - x0 - 2 * pad;
        for (i = 1; i < n; i++) { if ((ev[i].d - ev[i - 1].d) / span * usable < 150 * u) { prop = false; } }
    }
    var X = function (k) {
        if (prop) { return x0 + pad + (ev[k].d - ev[0].d) / (ev[n - 1].d - ev[0].d) * (x1 - x0 - 2 * pad); }
        return n === 1 ? (x0 + x1) / 2 : x0 + pad + k / (n - 1) * (x1 - x0 - 2 * pad);
    };
    ctx.add({ type: 'line', name: 'Timeline Axis', x1: x0, y1: ax, x2: x1, y2: ax, stroke: th.axis, sw: 4 * u, cap: 'round', anim: ctx.A('draw', t0, dur, { ease: null }) });
    var minSp = Infinity;
    for (i = 1; i < n; i++) { minSp = Math.min(minSp, X(i) - X(i - 1)); }
    if (n === 1) { minSp = P.w; }
    var lanes = minSp < 260 * u ? 2 : 1, space = Math.min(P.w * 0.3, minSp * lanes * 2 * 0.9);
    var avail = P.h * 0.48 - 30 * u;
    for (i = 0; i < n; i++) {
        var x = X(i), tmh = t0 + dur * (x - x0) / (x1 - x0), up = i % 2 === 0;
        var lane = Math.floor(i / 2) % lanes, stem = (lanes === 2 && lane === 1) ? avail * 0.62 : avail * 0.22;
        var hl2 = o.highlight && DG.inList(ev[i].title, o.highlight), c2 = hl2 ? th.hi : th.accent;
        var ys = up ? ax - stem : ax + stem;
        ctx.add({ type: 'line', name: 'Stem ' + ev[i].date, layer: 'Stems', x1: x, y1: ax, x2: x, y2: ys, stroke: th.grid, sw: 2 * u, cap: 'butt', anim: ctx.A('draw', tmh, 0.4, { ease: 'out' }) });
        ctx.add({ type: 'circle', name: 'Marker ' + ev[i].date, cx: x, cy: ax, r: (hl2 ? 16 : 12) * u, fill: c2, stroke: th.bg, sw: 4 * u, glow: th.glow, anim: ctx.A('pop', tmh - 0.08, T.pop, { over: ctx.over ? 1.3 : 0 }) });
        var al = x - space / 2 < P.x ? 'left' : (x + space / 2 > P.x + P.w ? 'right' : 'center');
        var dsz = DG.fit(ev[i].date, 40 * u, space, 18 * u), tsz2 = DG.fit(ev[i].title, 26 * u, space, 12 * u);
        var yDate = up ? ys - (ev[i].desc ? 74 * u : 46 * u) : ys + 46 * u;
        ctx.text('Date ' + ev[i].date, ev[i].date, x, yDate, dsz, { color: c2, font: 'num', align: al, anim: ctx.fadeIn(tmh + 0.1, up ? 14 * u : -14 * u) });
        ctx.text('Event ' + ev[i].date, ev[i].title, x, yDate + 36 * u, tsz2, { align: al, font: hl2 ? 'title' : 'body', anim: ctx.fadeIn(tmh + 0.18, up ? 14 * u : -14 * u) });
        if (ev[i].desc) {
            ctx.text('Desc ' + ev[i].date, ev[i].desc, x, yDate + 64 * u, DG.fit(ev[i].desc, 20 * u, space, 11 * u), { align: al, color: th.muted, anim: ctx.fadeIn(tmh + 0.25, 0) });
        }
    }
};

DG.timelineEras = function (ctx, ev) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i, j;
    var spans = [];
    for (i = 0; i < ev.length; i++) {
        var a = ev[i].d, b = DG.num(ev[i].title), label = ev[i].desc;
        if (isNaN(a)) { continue; }
        if (isNaN(b)) { b = a; label = ev[i].title; }
        spans.push({ a: Math.min(a, b), b: Math.max(a, b), label: label || '', ra: ev[i].date, rb: ev[i].title });
    }
    if (!spans.length) { return ctx.empty('Eras need: start, end, label'); }
    spans.sort(function (p, q) { return p.a - q.a; });
    var lo = spans[0].a, hi = -Infinity;
    for (i = 0; i < spans.length; i++) { hi = Math.max(hi, spans[i].b); }
    var tk = DG.ticks(lo, hi, Number(o.ticks) || 9);
    var X = function (v) { return P.x + (v - tk.min) / (tk.max - tk.min) * P.w; };
    /* greedy lane packing (label width counts as part of the span) */
    var laneEnd = [];
    for (i = 0; i < spans.length; i++) {
        var bw0 = X(spans[i].b) - X(spans[i].a), lw0 = DG.textW(spans[i].label, 26 * u) + 30 * u;
        var need = X(spans[i].a) + (lw0 < bw0 ? bw0 : bw0 + lw0);
        for (j = 0; j < laneEnd.length; j++) { if (laneEnd[j] + 12 * u <= X(spans[i].a)) { break; } }
        laneEnd[j] = need; spans[i].lane = j;
    }
    var nL = laneEnd.length, axisY = P.y + P.h - 40 * u;
    var lh = Math.min(84 * u, (axisY - P.y - 20 * u) / nL), bh = lh * 0.72;
    var tf = DG.extend({}, ctx.fmt, { decimals: 0, grouping: 'none', compact: 'none', prefix: '', suffix: '' });
    for (i = 0; i < tk.ticks.length; i++) {
        var gx = X(tk.ticks[i]);
        ctx.add({ type: 'line', name: 'Grid ' + i, layer: 'Grid', x1: gx, y1: P.y, x2: gx, y2: axisY, stroke: th.grid, sw: th.gridW * u, dash: th.gridDash, cap: 'butt', anim: ctx.A('draw', T.axes + i * 0.04, 0.7) });
        ctx.text('Year ' + tk.ticks[i], DG.fmt(tk.ticks[i], tf), gx, axisY + 36 * u, 24 * u, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + i * 0.04, 0) });
    }
    ctx.add({ type: 'line', name: 'Axis', x1: P.x, y1: axisY, x2: P.x + P.w, y2: axisY, stroke: th.axis, sw: 3 * u, cap: 'butt', anim: ctx.A('draw', T.axes, 0.8) });
    var totalT = T.draw;
    for (i = 0; i < spans.length; i++) {
        var sp = spans[i], xa = X(sp.a), xb = Math.max(X(sp.b), xa + 6 * u), y = P.y + (axisY - P.y - nL * lh) * 0.45 + sp.lane * lh + (lh - bh) / 2;
        var ts = T.data + totalT * (sp.a - tk.min) / (tk.max - tk.min);
        var hl = o.highlight && DG.inList(sp.label, o.highlight), col = hl ? th.hi : (o.highlight ? th.dim : ctx.color(i));
        var dGrow = Math.max(0.4, totalT * (sp.b - sp.a) / (tk.max - tk.min));
        ctx.add({ type: 'rect', name: 'Era ' + sp.label, x: xa, y: y, w: xb - xa, h: bh, fill: col, r: Math.min(th.radius * u, bh / 2), glow: th.glow, anim: ctx.A('grow', ts, dGrow, { dir: 'right', ease: 'easy' }) });
        var inside = DG.textW(sp.label, 26 * u) + 30 * u < xb - xa;
        var ls = Math.min(26 * u, bh * 0.42);
        ctx.text('Era Label ' + sp.label, sp.label, inside ? xa + 14 * u : xb + 12 * u, y + bh / 2 + (inside ? -2 * u : ls * 0.36), ls, {
            color: inside ? (DG.luma(col) > 0.6 ? '#111111' : '#FFFFFF') : th.text, font: 'title', anim: ctx.fadeIn(ts + 0.2, 0)
        });
        if (inside && bh > 44 * u) {
            ctx.text('Era Years ' + sp.label, sp.ra + '–' + sp.rb, xa + 14 * u, y + bh / 2 + ls * 0.95, ls * 0.72, {
                color: DG.luma(col) > 0.6 ? '#333333' : '#E6E6E6', anim: ctx.fadeIn(ts + 0.3, 0)
            });
        }
    }
};
