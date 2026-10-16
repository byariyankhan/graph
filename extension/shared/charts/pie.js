/*
 * Pie / Donut family.
 * Variants: pie, donut, semi (half donut), rings (progress rings), rose (Nightingale).
 * Data: label, value. Angles are degrees, clockwise from 12 o'clock.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.pie = [
    { id: 'donut', label: 'Donut' },
    { id: 'pie', label: 'Pie' },
    { id: 'semi', label: 'Half donut' },
    { id: 'rings', label: 'Progress rings' },
    { id: 'rose', label: 'Rose (Nightingale)' }
];

DG.charts.pie = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'donut';
    var data = DG.seriesData(ctx.table);
    if (!data.cats.length || !data.series.length) { return ctx.empty(); }
    var items = [], i;
    for (i = 0; i < data.cats.length; i++) {
        var v = data.series[0].values[i];
        if (v !== null && v > 0) { items.push({ name: data.cats[i], v: v }); }
    }
    if (!items.length) { return ctx.empty('Values must be positive'); }
    var maxItems = variant === 'rings' ? 6 : 10, grouped = false;
    if (items.length > maxItems && variant !== 'rose') {
        if (o.sort !== 'none') { items.sort(function (a, b) { return b.v - a.v; }); }
        var rest = 0;
        for (i = maxItems - 1; i < items.length; i++) { rest += items[i].v; }
        items = items.slice(0, maxItems - 1);
        items.push({ name: o.othersLabel || 'Others', v: rest, others: true });
        grouped = true;
    } else if (o.sort === 'desc') { items.sort(function (a, b) { return b.v - a.v; }); }
    var n = items.length, total = 0;
    for (i = 0; i < n; i++) { total += items[i].v; }
    var F = ctx.F(), PF = ctx.F({ suffix: '%', prefix: '', compact: 'none', decimals: o.pctDecimals === undefined ? 0 : o.pctDecimals });
    for (i = 0; i < n; i++) {
        items[i].pct = items[i].v / total * 100;
        var hl = o.highlight ? DG.inList(items[i].name, o.highlight) : false;
        items[i].hl = hl;
        items[i].color = items[i].others ? th.dim : (o.highlight ? (hl ? th.hi : DG.mix(ctx.color(i + 1), th.bg, 0.55)) : ctx.color(i));
    }
    var showPct = o.values !== false;
    /* live data sliders (not for rose, nor when small slices were merged) */
    var live = ctx.live && !grouped && variant !== 'rose';
    var cells = [];
    if (live) { for (i = 0; i < n; i++) { cells.push(ctx.cell(items[i].name, items[i].v)); } }

    /* Layout: chart left + legend right (landscape) or stacked (portrait) */
    var legendW = ctx.portrait ? 0 : Math.min(P.w * 0.42, 620 * u);
    var region = ctx.portrait ? { x: P.x, y: P.y, w: P.w, h: P.h * 0.58 } : { x: P.x, y: P.y, w: P.w - legendW, h: P.h };
    var semi = variant === 'semi';
    var R = semi ? Math.min(region.w / 2, region.h * 0.95) * 0.95 : Math.min(region.w, region.h) / 2 * 0.94;
    var cx = region.x + region.w / 2, cy = semi ? region.y + region.h / 2 + R / 2 : region.y + region.h / 2;
    var inner = variant === 'pie' ? 0 : variant === 'rose' ? R * 0.14 : R * (o.hole !== undefined && o.hole !== '' ? Number(o.hole) : 0.58);
    var span = semi ? 180 : 360, start = semi ? -90 : 0;
    var tA = T.data, sweepTotal = 1.7 * T.grow;

    if (variant === 'rings') {
        var rw = Math.min(R * 0.2, R * 0.78 / n), gapR = rw * 0.28;
        var maxV = DG.maxOf(items, function (it) { return it.v; });
        if (maxV > 100 || o.ringMax === 'max') { live = false; }
        for (i = 0; i < n; i++) {
            var pc = maxV <= 100 && o.ringMax !== 'max' ? items[i].v : items[i].v / maxV * 100;
            items[i].pct = pc;
            var rOut = R - i * (rw + gapR), rIn = rOut - rw, ts = tA + i * T.stagger * 2;
            ctx.add({ type: 'ring', name: 'Track ' + items[i].name, layer: 'Tracks', cx: cx, cy: cy, r: rOut, inner: rIn, a0: 0, a1: 360, fill: items[i].color, opacity: 0.18, anim: ctx.A('fade', T.axes, 0.5, { ease: 'easy' }) });
            var rg = ctx.add({
                type: 'ring', name: 'Ring ' + items[i].name, cx: cx, cy: cy, r: rOut, inner: rIn, a0: 0, a1: DG.clamp(pc, 0, 100) * 3.6,
                fill: items[i].color, cap: 'round', glow: th.glow, anim: ctx.A('sweep', ts, T.grow * 1.6)
            });
            if (live) { rg.live = { kind: 'ringPct', cell: cells[i] }; }
        }
        if (n === 1) {
            var bigS = Math.min(R * 0.55, 200 * u);
            var rc = ctx.countText('Center Value', 0, items[0].pct, PF, cx, cy + bigS * 0.35, bigS, { align: 'center' }, tA, T.grow * 1.6);
            if (live) { rc.live = { kind: 'value', cell: cells[0] }; }
            ctx.text('Center Label', items[0].name, cx, cy + bigS * 0.35 + 52 * u, DG.fit(items[0].name, 30 * u, R * 1.2, 16 * u), { align: 'center', color: th.muted, anim: ctx.fadeIn(tA + 0.3) });
            return;
        }
    } else if (variant === 'rose') {
        var maxR = DG.maxOf(items, function (it) { return it.v; }), step = 360 / n;
        for (i = 0; i < n; i++) {
            var rr = inner + (R - inner) * Math.sqrt(items[i].v / maxR);
            ctx.add({
                type: 'ring', name: 'Petal ' + items[i].name, cx: cx, cy: cy, r: rr, inner: inner, a0: i * step + 1, a1: (i + 1) * step - 1,
                fill: items[i].color, glow: th.glow, anim: ctx.A('pop', tA + i * T.stagger, T.pop * 1.4, { over: ctx.over ? 1.06 : 0 })
            });
        }
    } else {
        var acc = 0, tt = tA;
        for (i = 0; i < n; i++) {
            var a0 = start + acc / total * span, a1 = start + (acc + items[i].v) / total * span;
            var d = Math.max(0.22, sweepTotal * items[i].v / total);
            var gapDeg = n > 1 && o.gaps !== false && variant !== 'pie' ? 1.2 : 0;
            var sl = ctx.add({
                type: 'ring', name: 'Slice ' + items[i].name, cx: cx, cy: cy, r: items[i].hl ? R * 1.04 : R, inner: inner,
                a0: a0 + gapDeg / 2, a1: a1 - gapDeg / 2, fill: items[i].color, glow: th.glow,
                anim: ctx.A('sweep', tt, d, { ease: n === 1 ? ctx.ease : 'linear' })
            });
            if (live) { sl.live = { kind: 'slice', cells: cells, index: i, start: start, span: span, gap: gapDeg }; }
            if (showPct && items[i].pct >= 4) {
                var mid = (a0 + a1) / 2 * Math.PI / 180, lr = inner > 0 ? (R + inner) / 2 : R * 0.64;
                var ls = Math.min(30 * u, (R - inner) * 0.3);
                if (inner === 0) { ls = Math.min(34 * u, R * 0.12); }
                var pl = ctx.countText('Pct ' + items[i].name, 0, items[i].pct, PF, cx + Math.sin(mid) * lr, cy - Math.cos(mid) * lr + ls * 0.36, ls,
                    { align: 'center', color: DG.luma(items[i].color) > 0.6 ? '#111111' : '#FFFFFF' }, tt + d * 0.5, T.grow);
                if (live) { pl.live = { kind: 'pct', cells: cells, index: i, pos: { kind: 'sliceMid', cells: cells, index: i, start: start, span: span, cx: cx, cy: cy, r: lr, dy: ls * 0.36 } }; }
            }
            acc += items[i].v; tt += d;
        }
        if (inner > 0 && o.center !== false) {
            var cs = Math.min(inner * 0.5, 120 * u), hlItem = null;
            for (i = 0; i < n; i++) { if (items[i].hl) { hlItem = items[i]; } }
            var cVal = hlItem ? hlItem.pct : total, cF = hlItem ? PF : DG.extend({}, F, { ref: total });
            var ccy = semi ? cy - 24 * u : cy + cs * 0.3;
            var cv = ctx.countText('Center Value', 0, cVal, cF, cx, ccy, DG.fit(DG.fmt(cVal, cF), cs, inner * 1.6, 20 * u), { align: 'center' }, tA, sweepTotal);
            if (live) {
                var hix = -1;
                for (i = 0; i < n; i++) { if (items[i] === hlItem) { hix = i; } }
                cv.live = hlItem ? { kind: 'pct', cells: cells, index: hix } : { kind: 'sum', cells: cells };
            }
            var cl = hlItem ? hlItem.name : (o.centerLabel || 'Total');
            ctx.text('Center Label', cl, cx, ccy + 46 * u, DG.fit(cl, 28 * u, inner * 1.5, 14 * u), { align: 'center', color: th.muted, anim: ctx.fadeIn(tA + 0.2) });
        }
    }

    /* Legend list with live values */
    var lx, ly, lw, rowH = Math.min(70 * u, (ctx.portrait ? P.h * 0.4 : P.h) / n), ts2 = Math.min(30 * u, rowH * 0.48);
    if (ctx.portrait) { lx = P.x; lw = P.w; ly = region.y + region.h + 40 * u; } else { lx = P.x + P.w - legendW + 40 * u; lw = legendW - 40 * u; ly = cy - n * rowH / 2; }
    if (semi && !ctx.portrait) { ly = Math.max(P.y, cy - R * 0.6 - n * rowH / 2); }
    for (i = 0; i < n; i++) {
        var yy = ly + rowH * (i + 0.5), tl = tA + i * 0.1;
        ctx.add({ type: 'circle', name: 'Key ' + items[i].name, layer: 'Legend Keys', cx: lx + 12 * u, cy: yy, r: 12 * u, fill: items[i].color, anim: ctx.A('pop', tl, T.pop, { over: ctx.over }) });
        ctx.text('Name ' + items[i].name, items[i].name, lx + 40 * u, yy + ts2 * 0.36, DG.fit(items[i].name, ts2, lw * 0.6, 12 * u),
            { color: items[i].hl ? th.hi : th.text, font: items[i].hl ? 'title' : 'body', anim: ctx.fadeIn(tl, 0) });
        var showV = variant === 'rings' ? items[i].pct : (o.legendValue === 'value' ? items[i].v : items[i].pct);
        var vf = (variant !== 'rings' && o.legendValue === 'value') ? DG.extend({}, F, { ref: items[i].v }) : PF;
        var lvt = ctx.countText('Legend Value ' + items[i].name, 0, showV, vf, lx + lw, yy + ts2 * 0.36, ts2, { align: 'right', color: th.text }, tl, T.grow * 1.4);
        if (live && variant !== 'rose') {
            lvt.live = (variant === 'rings' || o.legendValue === 'value') ? { kind: 'value', cell: cells[i] } : { kind: 'pct', cells: cells, index: i };
        }
        if (i < n - 1) {
            ctx.add({ type: 'line', name: 'Legend Rule ' + i, layer: 'Legend Rules', x1: lx, y1: yy + rowH / 2, x2: lx + lw, y2: yy + rowH / 2, stroke: th.grid, sw: 1.5 * u, cap: 'butt', anim: ctx.A('draw', tl, 0.6, { ease: 'out' }) });
        }
    }
};
