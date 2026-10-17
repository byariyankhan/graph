/*
 * Bar Chart Race — rankings that change over time.
 * Variants: bars (horizontal, classic), columns (vertical).
 * Data: first column = time (year), other columns = entities (countries…).
 * The transposed layout (rows = entities, columns = years) is detected too.
 *
 * Every entity is sampled several times per period: values interpolate
 * linearly, ranks are recomputed at each sample, and position keys between
 * samples are eased so bars glide past each other when the order changes.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};
DG.VARIANTS.race = [
    { id: 'bars', label: 'Bar race (horizontal)' },
    { id: 'columns', label: 'Column race' }
];
DG.TYPES = DG.TYPES || {};
DG.TYPES.race = {
    label: 'Bar race', order: 6,
    icon: '<rect x="4" y="3" width="34" height="6"/><rect x="4" y="12" width="25" height="6" opacity=".7"/><rect x="4" y="21" width="16" height="6" opacity=".45"/>',
    live: [],
    columns: {"_": "year, entity 1, entity 2, \u2026 (or entities \u00d7 years)"},
    ai: {"_": "First column = year, oldest first. One column per entity (e.g. country). One row per year. Include enough entities (8\u201315) and years to make a race."}
};

DG.charts.race = function (ctx) {
    var o = ctx.opts, th = ctx.theme, u = ctx.u, T = ctx.T, P = ctx.plot;
    var cols = ctx.spec.variant === 'columns';
    var data = DG.seriesData(DG.transposeIfWide(ctx.table));
    var m = data.cats.length, E = data.series, nE = E.length, i, e, k;
    if (m < 2 || nE < 2) { return ctx.empty('Race needs: time column + 2 or more entity columns'); }
    var N = Math.min(nE, Number(o.topN) || (cols ? 8 : 10));
    var F = ctx.F();

    /* fill gaps: carry previous value forward, leading gaps = 0 */
    var V = [];
    for (e = 0; e < nE; e++) {
        var row = [], last = 0;
        for (i = 0; i < m; i++) { var v = E[e].values[i]; if (v !== null) { last = v; } row.push(last); }
        V.push(row);
    }

    var D = (Number(o.periodSec) || 1.0) / Math.max(0.2, Number(ctx.spec.anim.speed) || 1);
    var S = 4; /* samples per period */
    var intro = T.grow, t0 = T.data, tRace = t0 + intro + 0.3;
    var times = [t0], sampleVals = [];
    var firstRow = [];
    for (e = 0; e < nE; e++) { firstRow.push(0); }
    sampleVals.push(firstRow);
    for (i = 0; i < m - 1; i++) {
        for (k = 0; k < S; k++) {
            var f = k / S, sv = [];
            for (e = 0; e < nE; e++) { sv.push(DG.lerp(V[e][i], V[e][i + 1], f)); }
            times.push(tRace + (i + f) * D); sampleVals.push(sv);
        }
    }
    var lastRow = [];
    for (e = 0; e < nE; e++) { lastRow.push(V[e][m - 1]); }
    times.push(tRace + (m - 1) * D); sampleVals.push(lastRow);
    /* the intro grows bars to the first period's values */
    times.splice(1, 0, t0 + intro);
    sampleVals.splice(1, 0, sampleVals[1]);

    /* rank + scale per sample (scale = current leader) */
    var nS = times.length, ranks = [], maxes = [];
    for (k = 0; k < nS; k++) {
        var idx = DG.range(nE), vals = sampleVals[k];
        idx.sort(function (a, b) { return vals[b] - vals[a] || a - b; });
        var rk = [];
        for (e = 0; e < nE; e++) { rk[idx[e]] = e; }
        ranks.push(rk);
        maxes.push(Math.max(vals[idx[0]], 1e-9));
    }
    /* intro keeps the first period's ranking */
    ranks[0] = ranks[1];
    maxes[0] = maxes[1];

    var colorOf = function (ei) {
        if (o.highlight) { return DG.inList(E[ei].name, o.highlight) ? th.hi : DG.mix(ctx.color(ei), th.bg, 0.45); }
        return ctx.color(ei);
    };

    /* period label (big year) */
    var yearNumeric = true, yv = [], pt = [];
    for (i = 0; i < m; i++) { yv.push(DG.num(data.cats[i])); if (isNaN(yv[i])) { yearNumeric = false; } pt.push(tRace + i * D); }
    var ys = (cols ? 110 : 150) * u;
    /* the period label steps (1990 → 2000 …) rather than counting */
    var plabels = [];
    for (i = 0; i < m; i++) { plabels.push(yearNumeric ? DG.fmt(yv[i], { grouping: 'none', decimals: 0}) : data.cats[i]); }
    var yearA = ctx.A('live', tRace, (m - 1) * D, { times: pt.concat([pt[m - 1] + 0.001]), vals: DG.range(m).concat([m - 1]), labels: plabels });

    if (!cols) {
        /* ---------------- horizontal bars ---------------- */
        var rowH = P.h / N, bh = rowH * 0.76;
        var nameS = Math.min(30 * u, rowH * 0.42), labW = 0;
        for (e = 0; e < nE; e++) { labW = Math.max(labW, DG.textW(E[e].name, nameS)); }
        labW = Math.min(labW + 24 * u, P.w * 0.3);
        var valW = DG.textW(DG.fmt(DG.maxOf(lastRow), DG.extend({}, F, { ref: DG.maxOf(lastRow) })), nameS) + 40 * u;
        var bx = P.x + labW, bw = P.w - labW - valW;
        var yOf = function (r) { return P.y + (r < N ? r : N + 0.3) * rowH + (rowH - bh) / 2; };
        ctx.text('Period', DG.liveText(yearA, 1e9), P.x + P.w, P.y + P.h - 20 * u, ys, {
            align: 'right', font: 'num', color: th.muted, opacity: 0.85, anim: [yearA, ctx.fadeIn(t0, 0)]
        });
        for (e = 0; e < nE; e++) {
            var wv = [], tyv = [], opv = [], xv = [], live = [];
            for (k = 0; k < nS; k++) {
                var w = sampleVals[k][e] / maxes[k] * bw;
                if (k === 0) { w = 0; }
                wv.push(w);
                tyv.push(yOf(ranks[k][e]) - P.y);
                opv.push(ranks[k][e] < N ? 1 : 0);
                xv.push(bx + w + 14 * u);
                live.push(sampleVals[k][e]);
            }
            var col = colorOf(e), ft = DG.extend({}, F, { ref: DG.maxOf(lastRow) });
            var common = [
                ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'ty', times: times, vals: tyv, ease: 'smooth' }),
                ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'op', times: times, vals: opv, ease: 'smooth' })
            ];
            ctx.add({
                type: 'rect', name: 'Bar ' + E[e].name, x: bx, y: P.y + (rowH - bh) / 2, w: wv[nS - 1], h: bh, fill: col,
                r: Math.min(th.radius * u, bh / 2), glow: th.glow, growDir: 'right',
                anim: common.concat([ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'w', times: times, vals: wv, ease: null })])
            });
            ctx.text('Name ' + E[e].name, E[e].name, bx - 16 * u, P.y + rowH / 2 + nameS * 0.36, DG.fit(E[e].name, nameS, labW - 20 * u, 12 * u), {
                align: 'right', font: o.highlight && DG.inList(E[e].name, o.highlight) ? 'title' : 'body', anim: common
            });
            ctx.text('Value ' + E[e].name, DG.fmt(lastRow[e], ft), xv[nS - 1], P.y + rowH / 2 + nameS * 0.36, nameS, {
                font: 'num', anim: common.concat([
                    ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'x', times: times, vals: xv, ease: null }),
                    ctx.A('live', times[0], times[nS - 1] - times[0], { times: times, vals: live, fmt: ft })])
            });
        }
        return;
    }

    /* ---------------- vertical columns ---------------- */
    var colW = P.w / N, cw = colW * 0.72;
    var nameS2 = Math.min(26 * u, colW * 0.2);
    var baseY = P.y + P.h - 50 * u, maxH = P.h - 50 * u - 60 * u - ys;
    var xOf = function (r) { return P.x + (r < N ? r : N + 0.3) * colW + (colW - cw) / 2; };
    ctx.text('Period', DG.liveText(yearA, 1e9), P.x, P.y + ys * 0.8, ys, { font: 'num', color: th.muted, opacity: 0.85, anim: [yearA, ctx.fadeIn(t0, 0)] });
    ctx.add({ type: 'line', name: 'Baseline', x1: P.x, y1: baseY, x2: P.x + P.w, y2: baseY, stroke: th.axis, sw: 2 * u, cap: 'butt', anim: ctx.A('draw', T.axes, 0.7) });
    for (e = 0; e < nE; e++) {
        var hv = [], txv = [], opv2 = [], yv2 = [], live2 = [];
        for (k = 0; k < nS; k++) {
            var h = k === 0 ? 0 : sampleVals[k][e] / maxes[k] * maxH;
            hv.push(h); txv.push(xOf(ranks[k][e]) - P.x); opv2.push(ranks[k][e] < N ? 1 : 0);
            yv2.push(baseY - h - 14 * u); live2.push(sampleVals[k][e]);
        }
        var col2 = colorOf(e), ft2 = DG.extend({}, F, { ref: DG.maxOf(lastRow) });
        var common2 = [
            ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'tx', times: times, vals: txv, ease: 'smooth' }),
            ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'op', times: times, vals: opv2, ease: 'smooth' })
        ];
        var hEnd = hv[nS - 1];
        ctx.add({
            type: 'rect', name: 'Column ' + E[e].name, x: P.x + (colW - cw) / 2, y: baseY - hEnd, w: cw, h: hEnd, fill: col2,
            r: Math.min(th.radius * u, cw / 2), glow: th.glow, growDir: 'up',
            anim: common2.concat([ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'h', times: times, vals: hv, ease: null })])
        });
        ctx.text('Name ' + E[e].name, E[e].name, P.x + colW / 2, baseY + 36 * u, DG.fit(E[e].name, nameS2, colW * 0.95, 11 * u), {
            align: 'center', anim: common2
        });
        ctx.text('Value ' + E[e].name, DG.fmt(lastRow[e], ft2), P.x + colW / 2, yv2[nS - 1], DG.fit(DG.fmt(lastRow[e], ft2), nameS2, colW * 0.95, 11 * u), {
            align: 'center', font: 'num', anim: common2.concat([
                ctx.A('keys', times[0], times[nS - 1] - times[0], { prop: 'y', times: times, vals: yv2, ease: null }),
                ctx.A('live', times[0], times[nS - 1] - times[0], { times: times, vals: live2, fmt: ft2 })])
        });
    }
};
