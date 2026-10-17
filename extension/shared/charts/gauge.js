/*
 * Gauges / meters.
 * Variants:
 *   speedometer  half-circle dial with a swinging needle
 *   thermometer  tube filling up from the bulb
 *   progress     horizontal progress bars towards a maximum / target
 * Data: label, value, [max = 100], [target]. Several rows → several gauges.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.gauge = [
    { id: 'speedometer', label: 'Speedometer' },
    { id: 'thermometer', label: 'Thermometer' },
    { id: 'progress', label: 'Progress bars' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.gauge = {
    label: 'Gauge', order: 10,
    icon: '<path d="M6 25 A16 16 0 0 1 38 25" fill="none" stroke-width="5"/><line x1="22" y1="25" x2="31" y2="13" stroke-width="2.5"/><circle cx="22" cy="25" r="2.5"/>',
    live: [],
    columns: {"_": "label, value[, max = 100][, target]"},
    ai: {"_": "Columns: label, value, maximum of the scale, target (optional)."}
};

DG.charts.gauge = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, i;
    var variant = ctx.spec.variant || 'speedometer';
    var rows = [];
    for (i = 0; i < ctx.table.rows.length; i++) {
        var r = ctx.table.rows[i], v = DG.num(r[1]);
        if (isNaN(v)) { continue; }
        var mx = DG.num(r[2]), tg = DG.num(r[3]);
        rows.push({ name: r[0], v: v, max: isNaN(mx) || mx <= 0 ? 100 : mx, target: isNaN(tg) ? null : tg });
    }
    if (!rows.length) { return ctx.empty('Data: label, value, [max], [target]'); }
    var F = ctx.F(), n = rows.length;
    for (i = 0; i < n; i++) {
        rows[i].hl = o.highlight ? DG.inList(rows[i].name, o.highlight) : false;
        rows[i].color = o.highlight ? (rows[i].hl ? th.hi : th.dim) : (n === 1 ? th.accent : ctx.color(i));
        rows[i].f = DG.clamp(rows[i].v / rows[i].max, 0, 1);
    }
    if (variant === 'progress') { return DG.gaugeBars(ctx, rows, F); }

    /* grid of cells for several gauges */
    var cols = ctx.portrait ? Math.min(n, 2) : Math.min(n, 3), rr = Math.ceil(n / cols);
    var cw = P.w / cols, ch = P.h / rr;
    for (i = 0; i < n; i++) {
        var cx0 = P.x + (i % cols) * cw, cy0 = P.y + Math.floor(i / cols) * ch, t0 = T.data + i * T.stagger * 3;
        if (variant === 'thermometer') { DG.thermo(ctx, rows[i], cx0, cy0, cw, ch, t0, F); } else { DG.speedo(ctx, rows[i], cx0, cy0, cw, ch, t0, F, n); }
    }
};

DG.speedo = function (ctx, it, x, y, w, h, t0, F, n) {
    var th = ctx.theme, u = ctx.u, T = ctx.T;
    var labH = (n > 1 ? 130 : 170) * u, R = Math.min(w * 0.42, (h - labH) * 0.92), cx = x + w / 2, cy = y + (h - labH) / 2 + R * 0.5;
    var th2 = R * 0.16, dur = T.grow * 1.8;
    /* track with three soft zones, then the value arc */
    var zones = [th.up || th.accent, th.accent, th.down || th.hi];
    for (var z = 0; z < 3; z++) {
        ctx.add({ type: 'ring', name: 'Zone ' + (z + 1) + ' ' + it.name, layer: 'Dial ' + it.name, cx: cx, cy: cy, r: R, inner: R - th2, a0: -90 + z * 60 + 0.6, a1: -90 + (z + 1) * 60 - 0.6, fill: zones[z], opacity: 0.22, anim: ctx.A('fade', T.axes, 0.5, { ease: 'easy' }) });
    }
    ctx.add({ type: 'ring', name: 'Value Arc ' + it.name, cx: cx, cy: cy, r: R, inner: R - th2, a0: -90, a1: -90 + 180 * it.f, fill: it.color, glow: th.glow, anim: ctx.A('sweep', t0, dur) });
    /* tick marks + min/max labels */
    for (var k = 0; k <= 10; k++) {
        var a = (-90 + k * 18) * Math.PI / 180, r1 = R - th2 - 10 * u, r2 = r1 - (k % 5 === 0 ? 26 : 14) * u;
        ctx.add({ type: 'line', name: 'Tick ' + k + ' ' + it.name, layer: 'Ticks ' + it.name, x1: cx + Math.sin(a) * r1, y1: cy - Math.cos(a) * r1, x2: cx + Math.sin(a) * r2, y2: cy - Math.cos(a) * r2, stroke: th.muted, sw: (k % 5 === 0 ? 3 : 2) * u, cap: 'butt', anim: ctx.A('fade', T.axes + k * 0.02, 0.4, { ease: 'easy' }) });
    }
    var ls = Math.max(14 * u, R * 0.09);
    ctx.text('Min ' + it.name, DG.fmt(0, F), cx - R + th2 / 2, cy + ls * 1.6, ls, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes, 0) });
    ctx.text('Max ' + it.name, DG.fmt(it.max, DG.extend({}, F, { ref: it.max })), cx + R - th2 / 2, cy + ls * 1.6, ls, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes, 0) });
    /* needle: a slim triangle pointing up, rotated into place */
    var nl = R - th2 - 18 * u, nw = Math.max(5 * u, R * 0.045);
    ctx.add({
        type: 'path', name: 'Needle ' + it.name, pts: [[cx - nw, cy], [cx, cy - nl], [cx + nw, cy]], inT: [[0, 0], [0, 0], [0, 0]], outT: [[0, 0], [0, 0], [0, 0]], closed: true,
        fill: th.text, anim: [ctx.A('rotate', t0, dur, { cx: cx, cy: cy, from: -90, to: -90 + 180 * it.f, over: ctx.over ? 1.04 : 0 }), ctx.A('fade', T.axes, 0.3, { ease: 'easy' })]
    });
    ctx.add({ type: 'circle', name: 'Hub ' + it.name, cx: cx, cy: cy, r: nw * 2.2, fill: th.text, stroke: th.bg, sw: 3 * u, anim: ctx.A('pop', T.axes, T.pop, { over: ctx.over }) });
    /* value + label under the dial */
    var vs = Math.min(R * 0.42, (n > 1 ? 70 : 110) * u);
    var vy = cy + nw * 2.2 + 14 * u + vs * 0.8;
    ctx.countText('Value ' + it.name, 0, it.v, DG.extend({}, F, { ref: it.v }), cx, vy, vs, { align: 'center', color: it.color }, t0, dur);
    ctx.text('Label ' + it.name, it.name, cx, vy + 48 * u, DG.fit(it.name, 30 * u, w * 0.9, 14 * u), { align: 'center', color: th.text, font: 'title', anim: ctx.fadeIn(t0 + 0.2) });
};

DG.thermo = function (ctx, it, x, y, w, h, t0, F) {
    var th = ctx.theme, u = ctx.u, T = ctx.T;
    var labH = 90 * u, tubeW = Math.min(w * 0.16, 70 * u), bulbR = tubeW * 1.1;
    var cx = x + w / 2 - 40 * u, top = y + 30 * u, bulbY = y + h - labH - bulbR, tubeTop = top, tubeBot = bulbY - bulbR * 1.15;
    var tubeH = tubeBot - tubeTop, dur = T.grow * 1.8;
    ctx.add({ type: 'rect', name: 'Tube ' + it.name, layer: 'Glass ' + it.name, x: cx - tubeW / 2, y: tubeTop, w: tubeW, h: bulbY - tubeTop, fill: th.dim, r: tubeW / 2, opacity: 0.5, anim: ctx.A('fade', T.axes, 0.5, { ease: 'easy' }) });
    ctx.add({ type: 'circle', name: 'Bulb Glass ' + it.name, layer: 'Glass ' + it.name, cx: cx, cy: bulbY, r: bulbR + 6 * u, fill: th.dim, opacity: 0.5, anim: ctx.A('fade', T.axes, 0.5, { ease: 'easy' }) });
    var fw = tubeW * 0.56, fillH = tubeH * it.f;
    ctx.add({ type: 'circle', name: 'Bulb ' + it.name, cx: cx, cy: bulbY, r: bulbR - 4 * u, fill: it.color, glow: th.glow, anim: ctx.A('pop', t0 - 0.3, T.pop, { over: ctx.over }) });
    ctx.add({ type: 'rect', name: 'Mercury ' + it.name, x: cx - fw / 2, y: tubeBot - fillH, w: fw, h: fillH + (bulbY - tubeBot), fill: it.color, r: fw / 2, glow: th.glow, anim: ctx.A('grow', t0, dur, { dir: 'up' }) });
    /* scale on the right */
    for (var k = 0; k <= 4; k++) {
        var ty = tubeBot - tubeH * k / 4, tv = it.max * k / 4;
        ctx.add({ type: 'line', name: 'Scale ' + k + ' ' + it.name, layer: 'Scale ' + it.name, x1: cx + tubeW / 2 + 8 * u, y1: ty, x2: cx + tubeW / 2 + 26 * u, y2: ty, stroke: th.muted, sw: 2 * u, cap: 'butt', anim: ctx.A('draw', T.axes + k * 0.04, 0.4) });
        ctx.text('Scale ' + k + ' Label ' + it.name, DG.fmt(tv, DG.extend({}, F, { ref: it.max, decimals: tv % 1 ? 1 : (F.decimals || 0) })), cx + tubeW / 2 + 36 * u, ty + 8 * u, 22 * u, { color: th.muted, anim: ctx.fadeIn(T.axes + k * 0.04, 0) });
    }
    if (it.target !== null) {
        var gy = tubeBot - tubeH * DG.clamp(it.target / it.max, 0, 1);
        ctx.add({ type: 'line', name: 'Target ' + it.name, x1: cx - tubeW, y1: gy, x2: cx + tubeW / 2, y2: gy, stroke: th.text, sw: 3 * u, dash: [8, 6], cap: 'butt', anim: ctx.A('draw', T.axes + 0.3, 0.5) });
        ctx.text('Target Label ' + it.name, 'Target', cx - tubeW - 10 * u, gy + 8 * u, 20 * u, { align: 'right', color: th.text, anim: ctx.fadeIn(T.axes + 0.4, 0) });
    }
    ctx.countText('Value ' + it.name, 0, it.v, DG.extend({}, F, { ref: it.v }), cx, y + h - labH + 50 * u, Math.min(56 * u, w * 0.2), { align: 'center', color: it.color }, t0, dur);
    ctx.text('Label ' + it.name, it.name, cx, y + h - 6 * u, DG.fit(it.name, 26 * u, w * 0.95, 12 * u), { align: 'center', font: 'title', anim: ctx.fadeIn(t0 + 0.2, 0) });
};

DG.gaugeBars = function (ctx, rows, F) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, i, n = rows.length;
    var rowH = Math.min(150 * u, P.h / n), bh = Math.min(34 * u, rowH * 0.3), oy = P.y + (P.h - rowH * n) / 2;
    var nameS = Math.min(32 * u, rowH * 0.28), dur = T.grow * 1.6;
    for (i = 0; i < n; i++) {
        var it = rows[i], y = oy + rowH * i, by = y + rowH * 0.5, t0 = T.data + i * T.stagger * 3;
        ctx.text('Label ' + it.name, it.name, P.x, by - 16 * u, nameS, { font: it.hl ? 'title' : 'title', color: it.hl || !ctx.opts.highlight ? th.text : th.muted, anim: ctx.fadeIn(t0, 0) });
        var vf = DG.extend({}, F, { ref: it.v }), mf = DG.extend({}, F, { ref: it.max });
        ctx.countText('Value ' + it.name, 0, it.v, vf, P.x + P.w - DG.textW(' / ' + DG.fmt(it.max, mf), nameS * 0.8), by - 16 * u, nameS, { align: 'right', color: it.color }, t0, dur);
        ctx.text('Max ' + it.name, ' / ' + DG.fmt(it.max, mf), P.x + P.w, by - 16 * u, nameS * 0.8, { align: 'right', color: th.muted, anim: ctx.fadeIn(t0, 0) });
        ctx.add({ type: 'rect', name: 'Track ' + it.name, layer: 'Tracks', x: P.x, y: by, w: P.w, h: bh, fill: th.dim, r: bh / 2, opacity: 0.45, anim: ctx.A('fade', T.axes, 0.5, { ease: 'easy' }) });
        ctx.add({ type: 'rect', name: 'Fill ' + it.name, x: P.x, y: by, w: Math.max(bh, P.w * it.f), h: bh, fill: it.color, r: bh / 2, glow: th.glow, anim: ctx.A('grow', t0, dur, { dir: 'right' }) });
        if (it.target !== null) {
            var gx = P.x + P.w * DG.clamp(it.target / it.max, 0, 1);
            ctx.add({ type: 'line', name: 'Target ' + it.name, x1: gx, y1: by - 10 * u, x2: gx, y2: by + bh + 10 * u, stroke: th.text, sw: 4 * u, cap: 'butt', anim: ctx.A('draw', t0 + dur * 0.5, 0.4) });
            ctx.text('Target Label ' + it.name, 'Target ' + DG.fmt(it.target, DG.extend({}, F, { ref: it.target })), gx, by + bh + 36 * u, 20 * u, { align: 'center', color: th.muted, anim: ctx.fadeIn(t0 + dur * 0.5, 0) });
        }
    }
};
