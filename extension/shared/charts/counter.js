/*
 * Big numbers (stat callouts).
 * Variants: single, compare (A vs B), cards (grid of up to 6 stats).
 * Data: label, value, [start value]. A third column sets where the count
 * starts — e.g. "Population, 173000000, 75000000" counts 7.5 → 17.3 crore.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.counter = [
    { id: 'single', label: 'Single big number' },
    { id: 'compare', label: 'Compare (A vs B)' },
    { id: 'cards', label: 'Stat cards' }
];

DG.charts.counter = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'single';
    var rows = [], i;
    for (i = 0; i < ctx.table.rows.length; i++) {
        var r = ctx.table.rows[i], v = DG.num(r[1]);
        if (r.length < 2 || isNaN(v)) { v = DG.num(r[0]); if (isNaN(v)) { continue; } r = ['', r[0]]; }
        var from = r.length > 2 && r[2] !== '' && !isNaN(DG.num(r[2])) ? DG.num(r[2]) : 0;
        rows.push({ label: r[0], v: v, from: from });
    }
    if (!rows.length) { return ctx.empty(); }
    var F = ctx.F(), dur = T.grow * 2.2;

    if (variant === 'compare' && rows.length >= 2) {
        var half = P.w / 2, maxV = Math.max(Math.abs(rows[0].v), Math.abs(rows[1].v));
        var ns = 1e9, k;
        for (k = 0; k < 2; k++) { ns = Math.min(ns, DG.fit(DG.fmt(rows[k].v, DG.extend({}, F, { ref: rows[k].v })), 150 * u, half * 0.82, 40 * u)); }
        var cyN = P.y + P.h * 0.48;
        for (k = 0; k < 2; k++) {
            var cx = P.x + half * (k + 0.5), col = ctx.color(k), tk = T.data + k * 0.35;
            ctx.countText('Value ' + (k + 1), rows[k].from, rows[k].v, DG.extend({}, F, { ref: rows[k].v }), cx, cyN, ns, { align: 'center', color: col }, tk, dur);
            ctx.text('Label ' + (k + 1), rows[k].label, cx, cyN + 64 * u, DG.fit(rows[k].label, 40 * u, half * 0.8, 18 * u), { align: 'center', color: th.text, anim: ctx.fadeIn(tk + 0.2) });
            var bw = half * 0.7 * Math.abs(rows[k].v) / (maxV || 1), by = cyN + 110 * u;
            ctx.add({ type: 'rect', name: 'Track ' + (k + 1), layer: 'Tracks', x: cx - half * 0.35, y: by, w: half * 0.7, h: 18 * u, fill: th.dim, r: 9 * u, opacity: 0.5, anim: ctx.A('fade', tk, 0.5, { ease: 'easy' }) });
            ctx.add({ type: 'rect', name: 'Bar ' + (k + 1), x: cx - half * 0.35, y: by, w: Math.max(bw, 1), h: 18 * u, fill: col, r: 9 * u, glow: th.glow, anim: ctx.A('grow', tk, dur, { dir: 'right' }) });
        }
        ctx.text('VS', o.vsText || 'VS', P.x + half, cyN - ns * 0.3, 44 * u, { align: 'center', color: th.muted, font: 'title', anim: ctx.A('pop', T.data + 0.2, T.pop, { over: ctx.over }) });
        ctx.add({ type: 'line', name: 'Divider', x1: P.x + half, y1: P.y + P.h * 0.12, x2: P.x + half, y2: cyN - ns * 0.3 - 60 * u, stroke: th.grid, sw: 2 * u, cap: 'butt', anim: ctx.A('draw', T.axes, 0.6) });
        return;
    }

    if (variant === 'cards' && rows.length > 1) {
        var n = Math.min(rows.length, 6), cols = ctx.portrait ? (n > 3 ? 2 : 1) : (n <= 3 ? n : Math.ceil(n / 2));
        var rowsN = Math.ceil(n / cols), g = 30 * u;
        var cw = (P.w - g * (cols - 1)) / cols, ch = Math.min((P.h - g * (rowsN - 1)) / rowsN, cw * 0.8);
        var oy = P.y + (P.h - (ch * rowsN + g * (rowsN - 1))) / 2;
        for (i = 0; i < n; i++) {
            var c = i % cols, rr = Math.floor(i / cols);
            var x = P.x + c * (cw + g), y = oy + rr * (ch + g), t0 = T.data + i * T.stagger * 2.5;
            var colr = o.highlight ? (DG.inList(rows[i].label, o.highlight) ? th.hi : th.text) : ctx.color(i);
            ctx.add({ type: 'rect', name: 'Card ' + (i + 1), x: x, y: y, w: cw, h: ch, fill: th.card, r: Math.max(th.radius, 4) * 2 * u, anim: ctx.A('pop', t0, T.pop, { over: ctx.over ? 1.04 : 0 }) });
            ctx.add({ type: 'rect', name: 'Card Accent ' + (i + 1), x: x, y: y, w: 8 * u, h: ch, fill: colr, r: 0, anim: ctx.A('grow', t0 + 0.1, 0.5, { dir: 'down' }) });
            var vfmt = DG.extend({}, F, { ref: rows[i].v });
            var vs = DG.fit(DG.fmt(rows[i].v, vfmt), Math.min(110 * u, ch * 0.42), cw * 0.82, 26 * u);
            ctx.countText('Value ' + (i + 1), rows[i].from, rows[i].v, vfmt, x + 44 * u, y + ch * 0.52, vs, { color: colr }, t0 + 0.15, dur);
            ctx.text('Label ' + (i + 1), rows[i].label, x + 44 * u, y + ch * 0.52 + 50 * u, DG.fit(rows[i].label, 30 * u, cw * 0.82, 14 * u), { color: th.muted, anim: ctx.fadeIn(t0 + 0.3) });
        }
        return;
    }

    /* single */
    var it = rows[0], sf = DG.extend({}, F, { ref: it.v });
    var big = DG.fit(DG.fmt(it.v, sf), ctx.portrait ? 200 * u : 240 * u, P.w * 0.9, 60 * u);
    var cy = P.y + P.h * 0.5 + big * 0.3;
    var hc = o.highlight ? th.hi : th.accent;
    ctx.countText('Big Number', it.from, it.v, sf, P.x + P.w / 2, cy, big, { align: 'center', color: o.numberColor === 'text' ? th.text : hc }, T.data, dur * 1.2);
    ctx.add({
        type: 'line', name: 'Underline', x1: P.x + P.w / 2 - 90 * u, y1: cy + 46 * u, x2: P.x + P.w / 2 + 90 * u, y2: cy + 46 * u,
        stroke: th.grid, sw: 4 * u, cap: 'butt', anim: ctx.A('draw', T.data + 0.2, 0.8)
    });
    if (it.label) {
        ctx.text('Label', it.label, P.x + P.w / 2, cy + 110 * u, DG.fit(it.label, 46 * u, P.w * 0.9, 20 * u), { align: 'center', color: th.text, anim: ctx.fadeIn(T.data + 0.35) });
    }
};
