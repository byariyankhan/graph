/*
 * Scatter / Bubble / Gapminder.
 * Variants:
 *   scatter    data: label, x, y, [group]
 *   bubble     data: label, x, y, size, [group]
 *   gapminder  data: entity, time, x, y, size, [group]   (long format)
 * Column headers become the axis titles. The x axis switches to a log scale
 * automatically when the values span more than ~25×, like GDP per person.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.scatter = [
    { id: 'bubble', label: 'Bubble' },
    { id: 'scatter', label: 'Scatter' },
    { id: 'gapminder', label: 'Moving bubbles (Gapminder)' }
];

/* Log-scale ticks: 1-2-5 steps that fall inside [lo, hi]. */
DG.logTicks = function (lo, hi) {
    var t = [], e, k, m = [1, 2, 5];
    for (e = Math.floor(Math.log(lo) / Math.LN10); e <= Math.ceil(Math.log(hi) / Math.LN10); e++) {
        for (k = 0; k < 3; k++) {
            var v = m[k] * Math.pow(10, e);
            if (v >= lo * 0.999 && v <= hi * 1.001) { t.push(DG.round(v, 6)); }
        }
    }
    return t;
};

DG.charts.scatter = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var variant = ctx.spec.variant || 'bubble', tb = ctx.table, rows = tb.rows, i, k;
    var moving = variant === 'gapminder';
    var hasSize = variant !== 'scatter';
    var F = ctx.F();

    /* ---- parse into entities with per-time values ---- */
    var ents = [], byName = {}, times = [], tset = {};
    var cX = moving ? 2 : 1, cY = cX + 1, cS = cY + 1, cG = hasSize ? cS + 1 : cS;
    for (i = 0; i < rows.length; i++) {
        var r = rows[i], name = r[0], tm = moving ? r[1] : '', x = DG.num(r[cX]), y = DG.num(r[cY]);
        var sz = hasSize ? DG.num(r[cS]) : 1;
        if (!name || isNaN(x) || isNaN(y)) { continue; }
        if (isNaN(sz) || sz <= 0) { sz = 1; }
        if (!byName.hasOwnProperty(name)) {
            byName[name] = ents.length;
            ents.push({ name: name, group: r[cG] || '', at: {} });
        }
        ents[byName[name]].at[tm] = { x: x, y: y, s: sz };
        if (!tset.hasOwnProperty(tm)) { tset[tm] = true; times.push(tm); }
    }
    if (!ents.length) { return ctx.empty(moving ? 'Data: entity, year, x, y, size' : 'Data: label, x, y' + (hasSize ? ', size' : '')); }
    if (moving) { times.sort(function (a, b) { var na = DG.num(a), nb = DG.num(b); return (isNaN(na) || isNaN(nb)) ? 0 : na - nb; }); }
    var nT = times.length;

    /* fill gaps: carry the nearest known value so every entity has every time */
    for (i = 0; i < ents.length; i++) {
        var last = null;
        for (k = 0; k < nT; k++) { if (ents[i].at[times[k]]) { last = ents[i].at[times[k]]; } else if (last) { ents[i].at[times[k]] = last; } }
        last = null;
        for (k = nT - 1; k >= 0; k--) { if (ents[i].at[times[k]]) { last = ents[i].at[times[k]]; } else { ents[i].at[times[k]] = last; } }
    }

    /* ---- scales ---- */
    var xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, smax = 0;
    for (i = 0; i < ents.length; i++) {
        for (k = 0; k < nT; k++) {
            var p = ents[i].at[times[k]];
            xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y); smax = Math.max(smax, p.s);
        }
    }
    var logX = o.logX === true || (o.logX !== false && xmin > 0 && xmax / xmin > 25);
    var xt, xlo, xhi;
    if (logX) {
        xlo = Math.pow(10, Math.floor(Math.log(xmin) / Math.LN10 * 2) / 2);
        xhi = Math.pow(10, Math.ceil(Math.log(xmax) / Math.LN10 * 2) / 2);
        xt = DG.logTicks(xlo, xhi);
    } else {
        var tkx = DG.ticks(Math.min(xmin, xmin > 0 && xmin < xmax * 0.3 ? 0 : xmin), xmax, 6);
        xlo = tkx.min; xhi = tkx.max; xt = tkx.ticks;
    }
    var tky = DG.ticks(ymin > 0 && ymin < ymax * 0.3 ? 0 : ymin, ymax, 5);

    /* groups → colours (legend), else highlight / palette per entity */
    var groups = [], gIdx = {};
    for (i = 0; i < ents.length; i++) {
        var gname = ents[i].group;
        if (gname && !gIdx.hasOwnProperty(gname)) { gIdx[gname] = groups.length; groups.push(gname); }
    }
    var colorOf = function (en, ix) {
        if (o.highlight) { return DG.inList(en.name, o.highlight) ? th.hi : th.dim; }
        if (groups.length) { return ctx.color(gIdx[en.group]); }
        return ctx.color(ix);
    };
    if (groups.length > 1) {
        var items = [];
        for (i = 0; i < groups.length; i++) { items.push({ name: groups[i], color: ctx.color(i), round: true }); }
        DG.legend(ctx, items, T.axes);
        P = ctx.plot;
    }

    var tfy = DG.tickFmt(F, tky), tfx = DG.extend({}, F, { decimals: 0, ref: xhi });
    var axW = 0;
    for (k = 0; k < tky.ticks.length; k++) { axW = Math.max(axW, DG.textW(DG.fmt(tky.ticks[k], tfy), 24 * u)); }
    axW += 30 * u;
    var px = P.x + axW, pw = P.w - axW - 30 * u, py = P.y + 40 * u, ph = P.h - 40 * u - 70 * u;
    var X = function (v) {
        if (logX) { return px + (Math.log(v) - Math.log(xlo)) / (Math.log(xhi) - Math.log(xlo)) * pw; }
        return px + (v - xlo) / (xhi - xlo) * pw;
    };
    var Y = function (v) { return py + ph - (v - tky.min) / (tky.max - tky.min) * ph; };
    var maxR = Math.min(70 * u, pw * 0.07), minR = 6 * u;
    var R = function (s) { return hasSize ? Math.max(minR, maxR * Math.sqrt(s / smax)) : 12 * u; };

    /* ---- grid + axes ---- */
    for (k = 0; k < tky.ticks.length; k++) {
        var gy = Y(tky.ticks[k]);
        ctx.add({ type: 'line', name: 'Grid Y ' + k, layer: 'Grid', x1: px, y1: gy, x2: px + pw, y2: gy, stroke: k === 0 ? th.axis : th.grid, sw: th.gridW * u, dash: k === 0 ? null : th.gridDash, cap: 'butt', anim: ctx.A('draw', T.axes + k * 0.04, 0.7) });
        ctx.text('Tick Y ' + k, DG.fmt(tky.ticks[k], tfy), px - 16 * u, gy + 8 * u, 24 * u, { align: 'right', color: th.muted, anim: ctx.fadeIn(T.axes + k * 0.04, 0) });
    }
    for (k = 0; k < xt.length; k++) {
        var gx = X(xt[k]);
        ctx.add({ type: 'line', name: 'Grid X ' + k, layer: 'Grid', x1: gx, y1: py, x2: gx, y2: py + ph, stroke: th.grid, sw: th.gridW * u, dash: th.gridDash, cap: 'butt', anim: ctx.A('draw', T.axes + k * 0.04, 0.7) });
        ctx.text('Tick X ' + k, DG.fmt(xt[k], DG.extend({}, tfx, { compact: tfx.compact && tfx.compact !== 'none' ? tfx.compact : 'en', ref: xt[k], decimals: 0 })), gx, py + ph + 34 * u, 22 * u,
            { align: 'center', color: th.muted, anim: ctx.fadeIn(T.axes + k * 0.04, 0) });
    }
    var xTitle = tb.headers[cX] || 'X', yTitle = tb.headers[cY] || 'Y';
    ctx.text('X Title', xTitle + (logX ? ' (log scale) →' : ' →'), px + pw, py + ph + 66 * u, 24 * u, { align: 'right', color: th.text, font: 'title', anim: ctx.fadeIn(T.axes + 0.2, 0) });
    ctx.text('Y Title', '↑ ' + yTitle, px, py - 18 * u, 24 * u, { color: th.text, font: 'title', anim: ctx.fadeIn(T.axes + 0.2, 0) });

    /* ---- draw big bubbles first so small ones stay visible ---- */
    var lastT = times[nT - 1];
    var order = DG.range(ents.length);
    order.sort(function (a, b) { return ents[b].at[lastT].s - ents[a].at[lastT].s; });
    var labelAll = ents.length <= (moving ? 8 : 14);

    if (!moving) {
        var byX = DG.range(ents.length);
        byX.sort(function (a, b) { return ents[a].at[lastT].x - ents[b].at[lastT].x; });
        var rank = {};
        for (k = 0; k < byX.length; k++) { rank[byX[k]] = k; }
        var stag = Math.min(T.stagger, 1.4 / ents.length);
        for (k = 0; k < order.length; k++) {
            i = order[k];
            var en = ents[i], pt = en.at[lastT], cx = X(pt.x), cy = Y(pt.y), rr = R(pt.s), t0 = T.data + rank[i] * stag;
            var hl = o.highlight && DG.inList(en.name, o.highlight);
            ctx.add({
                type: 'circle', name: 'Bubble ' + en.name, cx: cx, cy: cy, r: rr, fill: colorOf(en, i), stroke: th.bg, sw: 2 * u,
                opacity: hl || !o.highlight ? 0.9 : 0.6, glow: th.glow, anim: ctx.A('pop', t0, T.pop, { over: ctx.over })
            });
            if (labelAll || hl) {
                ctx.text('Label ' + en.name, en.name, cx + rr + 8 * u, cy + 8 * u, (hl ? 26 : 22) * u,
                    { color: hl ? th.hi : th.text, font: hl ? 'title' : 'body', anim: ctx.fadeIn(t0 + 0.2, 0) });
            }
        }
        return;
    }

    /* ---- gapminder: bubbles travel through time ---- */
    var D = (Number(o.periodSec) || 1.5) / Math.max(0.2, Number(ctx.spec.anim.speed) || 1);
    var tStart = T.data + T.pop + 0.3, kt = [];
    for (k = 0; k < nT; k++) { kt.push(tStart + k * D); }
    var span = kt[nT - 1] - kt[0] || 0.1;
    var yearNumeric = true;
    for (k = 0; k < nT; k++) { if (isNaN(DG.num(times[k]))) { yearNumeric = false; } }
    var plabels = [];
    for (k = 0; k < nT; k++) { plabels.push(yearNumeric ? DG.fmt(DG.num(times[k]), { grouping: 'none', decimals: 0, digits: ctx.fmt.digits }) : times[k]); }
    ctx.text('Period', plabels[nT - 1], px + pw - 20 * u, py + ph - 30 * u, 200 * u, {
        align: 'right', font: 'num', color: th.grid, anim: [
            ctx.A('live', kt[0], span, { times: kt.concat([kt[nT - 1] + 0.001]), vals: DG.range(nT).concat([nT - 1]), labels: plabels }),
            ctx.fadeIn(T.axes, 0)]
    });
    for (k = 0; k < order.length; k++) {
        i = order[k];
        var e2 = ents[i], cxs = [], cys = [], rs = [];
        for (var q = 0; q < nT; q++) { var pq = e2.at[times[q]]; cxs.push(X(pq.x)); cys.push(Y(pq.y)); rs.push(R(pq.s)); }
        var hl2 = o.highlight && DG.inList(e2.name, o.highlight);
        var mk = function (prop, vals) { return ctx.A('keys', kt[0], span, { prop: prop, times: kt, vals: vals, ease: null }); };
        ctx.add({
            type: 'circle', name: 'Bubble ' + e2.name, cx: cxs[nT - 1], cy: cys[nT - 1], r: rs[nT - 1], fill: colorOf(e2, i), stroke: th.bg, sw: 2 * u,
            opacity: hl2 || !o.highlight ? 0.9 : 0.55, glow: th.glow,
            anim: [ctx.A('pop', T.data + k * 0.05, T.pop, { over: ctx.over }), mk('cx', cxs), mk('cy', cys), mk('r', rs)]
        });
        if (labelAll || hl2) {
            var lx = [], ly = [];
            for (q = 0; q < nT; q++) { lx.push(cxs[q] + rs[q] + 8 * u); ly.push(cys[q] + 8 * u); }
            ctx.text('Label ' + e2.name, e2.name, lx[nT - 1], ly[nT - 1], (hl2 ? 26 : 22) * u, {
                color: hl2 ? th.hi : th.text, font: hl2 ? 'title' : 'body',
                anim: [ctx.fadeIn(T.data + 0.3, 0), mk('x', lx), mk('y', ly)]
            });
        }
    }
};
