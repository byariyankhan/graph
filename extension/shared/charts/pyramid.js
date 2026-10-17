/*
 * Population pyramid / butterfly comparison.
 * Variants: classic, butterfly.
 * Data: age group, left series (e.g. Male), right series (e.g. Female).
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.pyramid = [
    { id: 'classic', label: 'Population pyramid' },
    { id: 'butterfly', label: 'Butterfly (two-sided)' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.pyramid = {
    label: 'Pyramid', order: 11,
    icon: '<rect x="8" y="22" width="13" height="5"/><rect x="23" y="22" width="13" height="5"/><rect x="11" y="15" width="10" height="5"/><rect x="23" y="15" width="10" height="5"/><rect x="15" y="8" width="6" height="5"/><rect x="23" y="8" width="6" height="5"/>',
    live: [],
    columns: {"_": "group, left, right"},
    ai: {"_": "Columns: age group (youngest first, e.g. 0-4, 5-9 \u2026), male, female. Values as % of total population or in people."}
};

DG.charts.pyramid = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'classic';
    var data = DG.seriesData(ctx.table);
    if (data.series.length < 2) { return ctx.empty('Pyramid needs: label, left value, right value'); }
    var L = data.series[0], R = data.series[1], n = data.cats.length, i;
    var order = DG.range(n);
    if (variant === 'classic' && o.reverse !== false) { order.reverse(); }
    var max = 0;
    for (i = 0; i < n; i++) { max = Math.max(max, Math.abs(L.values[i] || 0), Math.abs(R.values[i] || 0)); }
    var tk = DG.ticks(0, max, 4), F = ctx.F(), tf = DG.tickFmt(F, tk);
    var cL = ctx.color(1), cR = ctx.color(0);
    var butter = variant === 'butterfly';

    var hs = 30 * u, headY = P.y + hs;
    var labW = 0;
    for (i = 0; i < n; i++) { labW = Math.max(labW, DG.textW(data.cats[i], 24 * u)); }
    labW += 40 * u;
    var valW = butter ? 110 * u : 0;
    var cx = P.x + P.w / 2, half = (P.w - labW) / 2 - valW;
    var top = headY + 30 * u, bot = P.y + P.h - (o.axis !== false ? 46 * u : 0);
    var band = (bot - top) / n, bh = band * (butter ? 0.62 : 0.84);
    var xl0 = cx - labW / 2, xr0 = cx + labW / 2;
    var S = function (v) { return Math.abs(v) / tk.max * half; };

    ctx.text('Left Head', L.name, xl0, headY, hs, { align: 'right', color: cL, font: 'title', anim: ctx.fadeIn(T.axes) });
    ctx.text('Right Head', R.name, xr0, headY, hs, { color: cR, font: 'title', anim: ctx.fadeIn(T.axes) });

    if (o.axis !== false || o.grid !== false) {
        for (i = 0; i < tk.ticks.length; i++) {
            var tv = tk.ticks[i];
            var side = [xl0 - S(tv), xr0 + S(tv)];
            for (var sd = 0; sd < 2; sd++) {
                if (tv === 0 && sd === 1) { continue; }
                var gx = tv === 0 ? (sd === 0 ? xl0 : xr0) : side[sd];
                ctx.add({ type: 'line', name: 'Grid ' + i + '-' + sd, layer: 'Grid', x1: gx, y1: top, x2: gx, y2: bot, stroke: th.grid, sw: th.gridW * u, dash: th.gridDash, cap: 'butt', anim: ctx.A('draw', T.axes + i * 0.05, 0.7) });
                if (o.axis !== false) {
                    ctx.text('Tick ' + i + '-' + sd, DG.fmt(tv, tf), gx, bot + 36 * u, 22 * u, { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + i * 0.05, 0) });
                }
            }
        }
    }
    var stag = Math.min(T.stagger, 1.6 / n);
    for (var k = 0; k < n; k++) {
        i = order[k];
        var y = top + band * k + (band - bh) / 2, cy = y + bh / 2;
        var ts = T.data + (n - 1 - k) * stag;
        var lv = Math.abs(L.values[i] || 0), rv = Math.abs(R.values[i] || 0);
        var hl = o.highlight && DG.inList(data.cats[i], o.highlight);
        ctx.text('Age ' + data.cats[i], data.cats[i], cx, cy + Math.min(24 * u, bh) * 0.36, Math.min(24 * u, band * 0.8), { align: 'center', color: hl ? th.hi : th.muted, font: hl ? 'title' : 'body', anim: ctx.fadeIn(ts, 0) });
        var rad = butter ? Math.min(th.radius * u * 2, bh / 2) : 0;
        ctx.add({ type: 'rect', name: L.name + ' ' + data.cats[i], x: xl0 - S(lv), y: y, w: S(lv), h: bh, fill: o.highlight && !hl ? th.dim : cL, r: rad, glow: th.glow, anim: ctx.A('grow', ts, T.grow, { dir: 'left' }) });
        ctx.add({ type: 'rect', name: R.name + ' ' + data.cats[i], x: xr0, y: y, w: S(rv), h: bh, fill: o.highlight && !hl ? th.dim : cR, r: rad, glow: th.glow, anim: ctx.A('grow', ts, T.grow, { dir: 'right' }) });
        if (butter && o.values !== false) {
            var vs = Math.min(24 * u, bh * 0.8);
            ctx.countText('Value L ' + data.cats[i], 0, lv, DG.extend({}, F, { ref: lv }), xl0 - S(lv) - 12 * u, cy + vs * 0.36, vs, { align: 'right', color: th.text }, ts, T.grow);
            ctx.countText('Value R ' + data.cats[i], 0, rv, DG.extend({}, F, { ref: rv }), xr0 + S(rv) + 12 * u, cy + vs * 0.36, vs, { align: 'left', color: th.text }, ts, T.grow);
        }
    }
};
