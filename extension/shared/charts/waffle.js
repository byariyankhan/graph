/*
 * Waffle / pictogram family — "76 out of 100".
 * Variants:
 *   waffle   10×10 squares, each = 1%
 *   icons    100 people icons (20 × 5), each = 1%
 *   circles  proportional circles (area ∝ value) for comparing sizes
 * Data: label, value. One row ≤ 100 → that share is lit, the rest dimmed.
 * Several rows → shares of 100 (rounded with the largest-remainder rule).
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.waffle = [
    { id: 'waffle', label: 'Waffle 10×10' },
    { id: 'icons', label: 'People icons' },
    { id: 'circles', label: 'Proportional circles' }
];

/* Split 100 units between values (largest remainder, so it sums exactly). */
DG.shares100 = function (vals) {
    var tot = DG.sum(vals), out = [], rem = [], used = 0, i;
    if (tot <= 0) { return vals; }
    var scale = (vals.length === 1 && tot <= 100) || (vals.length > 1 && tot <= 100) ? 1 : 100 / tot;
    for (i = 0; i < vals.length; i++) {
        var x = vals[i] * scale, f = Math.floor(x + 1e-9);
        out.push(f); rem.push({ i: i, r: x - f }); used += f;
    }
    var target = Math.min(100, Math.round(DG.sum(vals) * scale));
    rem.sort(function (a, b) { return b.r - a.r; });
    for (i = 0; used < target && i < rem.length; i++) { out[rem[i].i] += 1; used += 1; }
    return out;
};

DG.charts.waffle = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'waffle';
    var data = DG.seriesData(ctx.table), i, k;
    var items = [];
    for (i = 0; i < data.cats.length; i++) {
        var v = data.series.length ? data.series[0].values[i] : null;
        if (v !== null && v > 0) { items.push({ name: data.cats[i], v: v }); }
    }
    if (!items.length) { return ctx.empty('Data: label, value'); }
    var F = ctx.F();
    for (i = 0; i < items.length; i++) {
        var hl = o.highlight ? DG.inList(items[i].name, o.highlight) : false;
        items[i].hl = hl;
        items[i].color = o.highlight ? (hl ? th.hi : DG.mix(ctx.color(i + 1), th.bg, 0.35)) : ctx.color(i);
    }

    if (variant === 'circles') { return DG.propCircles(ctx, items, F); }

    var raw = [];
    for (i = 0; i < items.length; i++) { raw.push(items[i].v); }
    var units = DG.shares100(raw);
    var PF = ctx.F({ suffix: '%', prefix: '', compact: 'none', decimals: 0 });
    var icons = variant === 'icons';
    var cols = icons ? 20 : 10, rowsN = icons ? 5 : 10;

    /* grid on the left, legend + big numbers on the right (stacked in portrait) */
    var legendW = ctx.portrait ? 0 : Math.min(P.w * 0.38, 600 * u);
    var gw = P.w - legendW - (ctx.portrait ? 0 : 40 * u), gh = ctx.portrait ? P.h * 0.55 : P.h;
    var cell = Math.min(gw / cols, gh / rowsN);
    var ox = P.x + (gw - cell * cols) / 2, oy = P.y + (gh - cell * rowsN) / 2;
    var gap = cell * (icons ? 0.18 : 0.14), s = cell - gap;

    /* which item owns each unit (row-major from the top-left) */
    var owner = [], idx = 0;
    for (i = 0; i < items.length; i++) { for (k = 0; k < units[i]; k++) { owner.push(i); } }
    var total = cols * rowsN, perUnit = 100 / total;
    var dur = 1.8 * T.grow;
    for (k = 0; k < total; k++) {
        var unitPct = (k + 0.5) * perUnit, own = -1;
        idx = Math.floor(unitPct);
        if (idx < owner.length) { own = owner[idx]; }
        var c = k % cols, r = Math.floor(k / cols);
        var x = ox + c * cell + gap / 2, y = oy + r * cell + gap / 2;
        var col = own >= 0 ? items[own].color : th.dim;
        var t0 = T.data + dur * k / total;
        var layer = own >= 0 ? 'Units ' + items[own].name : 'Units (rest)';
        var a = ctx.A('pop', t0, T.pop * 0.8, { over: ctx.over });
        var op = own >= 0 ? 1 : 0.45;
        if (icons) {
            /* person: head + rounded body */
            ctx.add({ type: 'circle', name: 'Head ' + (k + 1), layer: layer, cx: x + s / 2, cy: y + s * 0.2, r: s * 0.2, fill: col, opacity: op, anim: a });
            ctx.add({ type: 'rect', name: 'Body ' + (k + 1), layer: layer, x: x + s * 0.18, y: y + s * 0.45, w: s * 0.64, h: s * 0.55, r: s * 0.25, fill: col, opacity: op, anim: a });
        } else {
            ctx.add({ type: 'rect', name: 'Cell ' + (k + 1), layer: layer, x: x, y: y, w: s, h: s, r: Math.min(th.radius * u * 0.6, s * 0.25), fill: col, opacity: op, anim: a });
        }
    }

    /* legend: big share for the first (or highlighted) item, list for the rest */
    var lx = ctx.portrait ? P.x : P.x + P.w - legendW, lw = ctx.portrait ? P.w : legendW;
    var ly = ctx.portrait ? oy + rowsN * cell + 60 * u : P.y + P.h * 0.18;
    var lead = 0;
    for (i = 0; i < items.length; i++) { if (items[i].hl) { lead = i; } }
    var bigS = Math.min(150 * u, lw * 0.4);
    ctx.countText('Big Share', 0, units[lead], PF, lx, ly + bigS * 0.8, bigS, { color: items[lead].color }, T.data, dur);
    ctx.text('Big Label', items[lead].name, lx, ly + bigS * 0.8 + 56 * u, DG.fit(items[lead].name, 38 * u, lw, 16 * u), { color: th.text, font: 'title', anim: ctx.fadeIn(T.data + 0.3) });
    var yy = ly + bigS * 0.8 + 120 * u, rowH = 52 * u, row = 0;
    for (i = 0; i < items.length; i++) {
        if (i === lead) { continue; }
        var ty = yy + rowH * row;
        row++;
        ctx.add({ type: 'rect', name: 'Key ' + items[i].name, layer: 'Legend Keys', x: lx, y: ty - 20 * u, w: 22 * u, h: 22 * u, fill: items[i].color, r: 4 * u, anim: ctx.A('pop', T.data + 0.4 + i * 0.08, T.pop, { over: ctx.over }) });
        ctx.text('Name ' + items[i].name, items[i].name, lx + 36 * u, ty, DG.fit(items[i].name, 28 * u, lw * 0.6, 12 * u), { anim: ctx.fadeIn(T.data + 0.4 + i * 0.08, 0) });
        ctx.countText('Share ' + items[i].name, 0, units[i], PF, lx + lw, ty, 28 * u, { align: 'right' }, T.data + 0.4, dur);
    }
    var used = DG.sum(units);
    if (used < 100 && o.restLabel !== '') {
        var ry = yy + rowH * row;
        ctx.add({ type: 'rect', name: 'Key Rest', layer: 'Legend Keys', x: lx, y: ry - 20 * u, w: 22 * u, h: 22 * u, fill: th.dim, r: 4 * u, opacity: 0.6, anim: ctx.A('pop', T.data + 0.6, T.pop, { over: ctx.over }) });
        ctx.text('Name Rest', o.restLabel || 'Rest', lx + 36 * u, ry, 28 * u, { color: th.muted, anim: ctx.fadeIn(T.data + 0.6, 0) });
        ctx.countText('Share Rest', 0, 100 - used, PF, lx + lw, ry, 28 * u, { align: 'right', color: th.muted }, T.data + 0.6, dur);
    }
    if (icons) {
        ctx.text('Unit Note', o.unitNote || 'Each figure = 1%', ox, oy + rowsN * cell + 40 * u, 22 * u, { color: th.muted, anim: ctx.fadeIn(T.data + dur, 0) });
    }
};

/* Proportional circles: area ∝ value, standing on a common baseline. */
DG.propCircles = function (ctx, items, F) {
    var th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot, o = ctx.opts, i;
    var n = items.length, maxV = DG.maxOf(items, function (it) { return it.v; });
    var labH = 110 * u, noteH = o.areaNote === '' ? 0 : 50 * u, gap = 30 * u, k;
    var labW = [];
    for (i = 0; i < n; i++) {
        labW.push(Math.max(DG.textW(items[i].name, 30 * u), DG.textW(DG.fmt(items[i].v, DG.extend({}, F, { ref: items[i].v })), 28 * u)) + 16 * u);
    }
    /* choose 1–3 rows: whichever lets the circles be biggest */
    var best = null, rc;
    for (rc = 1; rc <= Math.min(3, n); rc++) {
        var per = Math.ceil(n / rc), R = (P.h - noteH - rc * labH) / rc / 2;
        for (var row = 0; row < rc; row++) {
            var ss = 0, lw = 0, cnt = 0;
            for (k = row * per; k < Math.min(n, (row + 1) * per); k++) { ss += Math.sqrt(items[k].v / maxV); lw += labW[k]; cnt++; }
            if (!cnt) { continue; }
            R = Math.min(R, (P.w - gap * (cnt - 1)) / (2 * ss));
            if (lw + gap * (cnt - 1) > P.w) { R = 0; } /* labels would not fit in this row */
        }
        if (!best || R > best.R * 1.15) { best = { rc: rc, per: per, R: R }; }
    }
    if (best.R <= 0) { best = { rc: Math.min(3, n), per: Math.ceil(n / Math.min(3, n)), R: (P.h - noteH - Math.min(3, n) * labH) / Math.min(3, n) / 2 }; }
    var Rmax = Math.max(4 * u, best.R), rowH = (P.h - noteH) / best.rc;
    for (i = 0; i < n; i++) { items[i].r = Math.max(4 * u, Rmax * Math.sqrt(items[i].v / maxV)); }
    var slotW = function (k2) { return Math.max(items[k2].r * 2, labW[k2]); };
    for (var rw = 0; rw < best.rc; rw++) {
        var from = rw * best.per, to = Math.min(n, (rw + 1) * best.per), rowW = 0;
        for (k = from; k < to; k++) { rowW += slotW(k) + (k > from ? gap : 0); }
        var x = P.x + Math.max(0, (P.w - rowW) / 2), base = P.y + noteH + rowH * (rw + 1) - labH;
        for (i = from; i < to; i++) {
            var it = items[i], sw = slotW(i), cx = x + sw / 2, cy = base - it.r, t0 = T.data + i * T.stagger * 3;
            ctx.add({ type: 'circle', name: 'Circle ' + it.name, cx: cx, cy: cy, r: it.r, fill: it.color, glow: th.glow, anim: ctx.A('pop', t0, T.pop * 1.6, { over: ctx.over ? 1.06 : 0 }) });
            ctx.text('Name ' + it.name, it.name, cx, base + 44 * u, DG.fit(it.name, 30 * u, sw + gap, 12 * u),
                { align: 'center', font: it.hl ? 'title' : 'body', color: it.hl ? th.hi : th.text, anim: ctx.fadeIn(t0 + 0.2, 0) });
            ctx.countText('Value ' + it.name, 0, it.v, DG.extend({}, F, { ref: it.v }), cx, base + 86 * u, 28 * u, { align: 'center', color: th.muted }, t0, T.grow * 1.4);
            x += sw + gap;
        }
    }
    if (o.areaNote !== '') {
        ctx.text('Area Note', o.areaNote || 'Circle area is proportional to value', P.x, P.y + 10 * u, 22 * u, { color: th.muted, anim: ctx.fadeIn(T.axes, 0) });
    }
};
