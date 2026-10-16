/*
 * DocuGraph — scene builder.
 *
 * DG.build(spec) turns a chart spec (type, variant, data, theme, options) into
 * a renderer-neutral SCENE: a flat list of primitive elements, each with its
 * animations. Two renderers consume the same scene:
 *   client/js/preview.js  → SVG preview in the panel (any time t)
 *   host/render.jsx       → native After Effects shape/text layers + keyframes
 *
 * Element types: rect, line, path, circle, ring, text.
 * Animation kinds: grow, draw, sweep, wipe, rise, fade, pop, count, type,
 *                  follow, followLabel. (see docs/ARCHITECTURE.md)
 */
var DG = (typeof DG !== 'undefined') ? DG : {};

DG.DEFAULTS = {
    type: 'bar', variant: 'column', theme: 'docDark',
    width: 1920, height: 1080, fps: 30, duration: 10,
    title: '', subtitle: '', source: '', credit: '',
    data: '', options: {}, format: {}, style: {},
    anim: { speed: 1, ease: 'out', stagger: 0.12, overshoot: true, titleAnim: 'fade' },
    background: 'solid'
};

DG.build = function (specIn) {
    var spec = DG.extend({}, DG.DEFAULTS, specIn || {});
    spec.anim = DG.extend({}, DG.DEFAULTS.anim, (specIn && specIn.anim) || {});
    spec.options = spec.options || {};
    spec.format = spec.format || {};
    var W = Number(spec.width) || 1920, H = Number(spec.height) || 1080;
    var th = DG.theme(spec.theme, spec.style);
    var sp = Math.max(0.2, Number(spec.anim.speed) || 1);
    var ctx = {
        spec: spec, W: W, H: H, u: Math.min(W, H) / 1080, theme: th, els: [],
        opts: spec.options, fmt: spec.format, table: DG.parseTable(spec.data),
        ease: spec.anim.ease, over: spec.anim.overshoot ? 1.12 : 0, portrait: H > W * 1.15
    };
    /* Base timings (seconds) — all divided by the speed factor. */
    /* Live data: charts register each data value as a "cell"; the AE
     * renderer turns cells into sliders on the DG Controller and drives the
     * chart with expressions (preview stays static). */
    ctx.live = spec.options.live !== false;
    ctx.cells = [];
    ctx.cell = function (label, value) { ctx.cells.push({ label: String(label), value: value }); return ctx.cells.length - 1; };
    ctx.T = {
        title: 0.2 / sp, sub: 0.45 / sp, source: 1.0 / sp, axes: 0.55 / sp, data: 1.15 / sp,
        grow: 1.0 / sp, pop: 0.55 / sp, fade: 0.6 / sp, draw: 3.6 / sp,
        stagger: (spec.anim.stagger === undefined ? 0.12 : Number(spec.anim.stagger)) / sp
    };
    DG.ctxApi(ctx);
    ctx.plot = DG.frame(ctx);
    var fn = DG.charts[spec.type] || DG.charts.bar;
    fn(ctx);
    DG.finalize(ctx);

    var end = 0, i, j;
    for (i = 0; i < ctx.els.length; i++) {
        for (j = 0; j < ctx.els[i].anims.length; j++) { end = Math.max(end, ctx.els[i].anims[j].t1); }
    }
    var dur = Math.max(Number(spec.duration) || 10, end + 1.5);
    return {
        name: spec.name || DG.compName(spec), width: W, height: H, fps: Number(spec.fps) || 30, duration: dur,
        bg: th.bg, bg2: th.bg2, transparent: spec.background === 'transparent', glow: th.glow,
        theme: spec.theme, els: ctx.els, dataEnd: end, live: DG.liveInfo(ctx.cells), colorRoles: DG.colorRoles(th)
    };
};

/* Slider names + a scale factor (AE sliders are limited to ±1,000,000). */
DG.liveInfo = function (cells) {
    if (!cells.length) { return null; }
    var m = 0, i, factor = 1, used = {};
    for (i = 0; i < cells.length; i++) { m = Math.max(m, Math.abs(cells[i].value || 0)); }
    while (m / factor >= 1e6 && factor < 1e15) { factor *= 1000; }
    var suf = factor === 1 ? '' : factor === 1e3 ? ' (x1K)' : factor === 1e6 ? ' (x1M)' : factor === 1e9 ? ' (x1B)' : ' (x1T)';
    var out = [];
    for (i = 0; i < cells.length; i++) {
        var nm = DG.trim(cells[i].label).substring(0, 26) || ('Value ' + (i + 1));
        nm = nm.replace(/"/g, "'");
        var base = nm, k = 2;
        while (used.hasOwnProperty(nm + suf)) { nm = base + ' ' + k; k++; }
        used[nm + suf] = true;
        out.push({ name: nm + suf, value: (cells[i].value || 0) / factor });
    }
    return { cells: out, factor: factor };
};

/* Names for the colour controls in AE (first matching role wins). */
DG.colorRoles = function (th) {
    var r = [['Highlight', th.hi], ['Accent', th.accent], ['Text', th.text], ['Muted Text', th.muted]], i;
    for (i = 0; i < th.palette.length; i++) { r.push(['Color ' + (i + 1), th.palette[i]]); }
    r.push(['Up / Gain', th.up], ['Down / Loss', th.down]);
    r.push(['Dimmed', th.dim], ['Grid', th.grid], ['Axis', th.axis], ['Card', th.card], ['Background', th.bg]);
    if (th.bg2) { r.push(['Background Glow', th.bg2]); }
    r.push(['Light Labels', '#FFFFFF'], ['Dark Labels', '#111111'], ['Year Labels', '#E6E6E6'], ['Year Labels Dark', '#333333']);
    return r;
};

DG.compName = function (spec) {
    var t = spec.title ? String(spec.title).substring(0, 40) : spec.type;
    return 'DG ' + spec.type + ' - ' + t;
};

/* Resolve fonts, apply upper-case, normalise animation lists. */
DG.finalize = function (ctx) {
    var th = ctx.theme;
    for (var i = 0; i < ctx.els.length; i++) {
        var el = ctx.els[i];
        if (el.type !== 'text') { continue; }
        var sample = el.text;
        if (el.count) { sample = DG.fmt(el.count.to, el.count.fmt); }
        var f = th.fonts[el.font || 'body'] || th.fonts.body;
        el.fontAE = f.ae; el.fontCSS = f.css; el.weight = f.w;
        if (el.upper) { el.text = String(el.text).toUpperCase(); }
        if (el.count) { el.text = sample; }
    }
};

/* Helper API attached to the build context, used by all chart modules. */
DG.ctxApi = function (ctx) {
    var th = ctx.theme, u = ctx.u;
    ctx.add = function (el) {
        el.id = ctx.els.length;
        el.name = el.name || (el.type + ' ' + (el.id + 1));
        var a = el.anim;
        el.anims = a ? (DG.isArr(a) ? a : [a]) : [];
        delete el.anim;
        ctx.els.push(el);
        return el;
    };
    ctx.A = function (kind, t0, dur, extra) {
        var a = { kind: kind, t0: t0, t1: t0 + Math.max(dur, 0.04), ease: ctx.ease };
        return DG.extend(a, extra || {});
    };
    /* Fade + small upward slide — the default entrance for text. */
    ctx.fadeIn = function (t0, dy) { return ctx.A('fade', t0, ctx.T.fade, { dy: dy === undefined ? 18 * u : dy }); };
    ctx.text = function (name, str, x, y, size, o) {
        o = o || {};
        return ctx.add({
            type: 'text', name: name, text: String(str), x: x, y: y, size: size,
            font: o.font || 'body', color: o.color || th.text, align: o.align || 'left',
            track: o.track === undefined ? 0 : o.track, upper: !!o.upper, count: o.count || null,
            opacity: o.opacity === undefined ? 1 : o.opacity, anim: o.anim || null
        });
    };
    /* Count-up number label. */
    ctx.countText = function (name, from, to, F, x, y, size, o, t0, dur) {
        o = o || {};
        var fmt = DG.extend({}, F);
        if (fmt.compact && fmt.compact !== 'none' && fmt.ref === undefined) { fmt.ref = to; }
        o.count = { from: from, to: to, fmt: fmt };
        o.font = o.font || 'num';
        var anims = [ctx.A('count', t0, dur, { ease: ctx.ease })];
        if (o.fade !== false) { anims.push(ctx.A('fade', t0, Math.min(0.35, dur), { dy: 0, ease: 'easy' })); }
        o.anim = anims;
        return ctx.text(name, DG.fmt(to, fmt), x, y, size, o);
    };
    ctx.color = function (i) { return th.palette[i % th.palette.length]; };
    ctx.F = function (over) { return DG.extend({}, ctx.fmt, over || {}); };
    ctx.empty = function (msg) {
        var p = ctx.plot;
        ctx.text('Empty', msg || 'Paste data to start', p.x + p.w / 2, p.y + p.h / 2, 36 * u, { align: 'center', color: th.muted });
    };
};

/* Title / subtitle / source / credit. Returns the plot rectangle. */
DG.frame = function (ctx) {
    var u = ctx.u, th = ctx.theme, s = ctx.spec, W = ctx.W, H = ctx.H, T = ctx.T;
    var mx = (ctx.portrait ? 70 : 96) * u, my = (ctx.portrait ? 120 : 80) * u;
    var y = my, x = mx;
    if (th.titleMark === 'bar' && s.title) { x += 26 * u; }
    if (s.title) {
        var ts = th.titleSize * u;
        ts = DG.fit(th.upper ? String(s.title).toUpperCase() : s.title, ts, W - mx * 2 - (x - mx), 34 * u);
        y += ts;
        var ta = s.anim.titleAnim === 'type' ? [ctx.A('type', T.title, 0.9, { ease: 'linear' })] : [ctx.fadeIn(T.title, 26 * u)];
        ctx.text('Title', s.title, x, y, ts, { font: 'title', upper: th.upper, track: th.track, anim: ta });
        if (th.titleMark === 'bar') {
            ctx.add({
                type: 'rect', name: 'Title Mark', x: mx, y: y - ts * 0.82, w: 9 * u, h: ts * 0.95, fill: th.accent, r: 0,
                anim: ctx.A('grow', T.title, 0.5, { dir: 'down' })
            });
        }
        y += ts * 0.32;
    }
    if (s.subtitle) {
        var ss = 32 * u;
        ss = DG.fit(s.subtitle, ss, W - mx * 2, 22 * u);
        y += ss * 1.3;
        ctx.text('Subtitle', s.subtitle, x, y, ss, { color: th.muted, anim: ctx.fadeIn(T.sub) });
        y += ss * 0.3;
    }
    if (s.title && th.titleMark === 'line') {
        y += 26 * u;
        ctx.add({
            type: 'line', name: 'Title Line', x1: mx, y1: y, x2: mx + 110 * u, y2: y, stroke: th.accent, sw: 6 * u, cap: 'butt',
            anim: ctx.A('draw', T.sub, 0.6, { ease: 'out' })
        });
    }
    var top = (s.title || s.subtitle) ? y + 58 * u : my;
    var bottom = H - my * 0.8;
    var fy = H - my * 0.55;
    if (s.source) {
        ctx.text('Source', s.source, mx, fy, 22 * u, { color: th.muted, anim: ctx.fadeIn(T.source, 0) });
        bottom = fy - 52 * u;
    }
    if (s.credit) {
        ctx.text('Credit', s.credit, W - mx, fy, 22 * u, { color: th.muted, align: 'right', font: 'title', anim: ctx.fadeIn(T.source, 0) });
        bottom = fy - 52 * u;
    }
    return { x: mx, y: top, w: W - mx * 2, h: Math.max(100 * u, bottom - top) };
};

/* Horizontal legend at the top of the plot; shrinks the plot. */
DG.legend = function (ctx, items, t0) {
    var u = ctx.u, th = ctx.theme, P = ctx.plot, size = 26 * u, x = P.x, y = P.y + size, gap = 40 * u, i;
    for (i = 0; i < items.length; i++) {
        var w = 22 * u + 12 * u + DG.textW(items[i].name, size);
        if (x + w > P.x + P.w && x > P.x) { x = P.x; y += size * 1.6; }
        ctx.add({
            type: 'rect', name: 'Legend Key ' + (i + 1), layer: 'Legend Keys', x: x, y: y - size * 0.72, w: 22 * u, h: 22 * u,
            fill: items[i].color, r: items[i].round ? 11 * u : 3 * u, anim: ctx.A('pop', t0 + i * 0.08, ctx.T.pop, { over: ctx.over })
        });
        ctx.text('Legend ' + items[i].name, items[i].name, x + 34 * u, y, size, { color: th.text, anim: ctx.fadeIn(t0 + i * 0.08, 0) });
        x += w + gap;
    }
    var used = y - P.y + size * 1.2;
    P.y += used; P.h -= used;
    return used;
};

/* Value gridlines + tick labels (vertical value axis). */
DG.yGrid = function (ctx, tk, X0, X1, Y, F, o) {
    o = o || {};
    var u = ctx.u, th = ctx.theme, tf = DG.tickFmt(F, tk), i;
    for (i = 0; i < tk.ticks.length; i++) {
        var v = tk.ticks[i], y = Y(v), zero = v === 0 && tk.min < 0;
        if (ctx.opts.grid !== false || zero || i === 0) {
            ctx.add({
                type: 'line', name: 'Grid ' + i, layer: 'Grid', x1: X0, y1: y, x2: X1, y2: y,
                stroke: (zero || (i === 0 && tk.min >= 0)) ? th.axis : th.grid, sw: th.gridW * u,
                dash: (zero || i === 0) ? null : th.gridDash, cap: 'butt',
                anim: ctx.A('draw', ctx.T.axes + i * 0.05, 0.7, { ease: 'out' })
            });
        }
        if (ctx.opts.axis !== false && !o.noLabels) {
            var tl = ctx.text('Tick ' + i, DG.fmt(v, tf), X0 - 16 * u, y + 8 * u, 24 * u, {
                color: th.muted, align: 'right', font: 'body', anim: ctx.fadeIn(ctx.T.axes + i * 0.05, 0)
            });
            if (o.liveMax) { tl.live = { kind: 'tick', frac: i / (tk.ticks.length - 1), max: o.liveMax, fmt: tf }; }
        }
    }
};
DG.tickLabelW = function (ctx, tk, F) {
    if (ctx.opts.axis === false) { return 0; }
    var tf = DG.tickFmt(F, tk), w = 0;
    for (var i = 0; i < tk.ticks.length; i++) { w = Math.max(w, DG.textW(DG.fmt(tk.ticks[i], tf), 24 * ctx.u)); }
    return w + 30 * ctx.u;
};

/* Cubic path helpers. Paths use After Effects' representation: vertices plus
 * in/out tangents relative to each vertex. */
DG.straight = function (pts) {
    var inT = [], outT = [];
    for (var i = 0; i < pts.length; i++) { inT.push([0, 0]); outT.push([0, 0]); }
    return { pts: pts, inT: inT, outT: outT };
};
/* Monotone cubic (Fritsch–Carlson) — smooth without overshooting the data.
 * Kept as source text: AE expressions rebuild live line paths with it. */
DG.SMOOTH_SRC = 'function(P){var n=P.length,i,I=[],O=[],d=[],m=[],a,b,s,t,dl,dr;' +
    'if(n<3){for(i=0;i<n;i++){I.push([0,0]);O.push([0,0]);}return{i:I,o:O};}' +
    'for(i=0;i<n-1;i++){a=P[i+1][0]-P[i][0];d.push(a===0?0:(P[i+1][1]-P[i][1])/a);}' +
    'm.push(d[0]);for(i=1;i<n-1;i++){m.push(d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2);}m.push(d[n-2]);' +
    'for(i=0;i<n-1;i++){if(d[i]===0){m[i]=0;m[i+1]=0;continue;}a=m[i]/d[i];b=m[i+1]/d[i];s=a*a+b*b;' +
    'if(s>9){t=3/Math.sqrt(s);m[i]=t*a*d[i];m[i+1]=t*b*d[i];}}' +
    'for(i=0;i<n;i++){dl=i>0?(P[i][0]-P[i-1][0])/3:0;dr=i<n-1?(P[i+1][0]-P[i][0])/3:0;I.push([-dl,-m[i]*dl]);O.push([dr,m[i]*dr]);}' +
    'return{i:I,o:O};}';
DG.smoothTan = eval('(' + DG.SMOOTH_SRC + ')');
DG.smooth = function (pts) {
    var t = DG.smoothTan(pts);
    return { pts: pts, inT: t.i, outT: t.o };
};
DG.bezPt = function (p0, c0, c1, p1, t) {
    var mt = 1 - t;
    return [mt * mt * mt * p0[0] + 3 * mt * mt * t * c0[0] + 3 * mt * t * t * c1[0] + t * t * t * p1[0],
        mt * mt * mt * p0[1] + 3 * mt * mt * t * c0[1] + 3 * mt * t * t * c1[1] + t * t * t * p1[1]];
};
/* Arc length of each segment of a path (sampled). */
DG.segLens = function (P) {
    var out = [], i, k, N = 24;
    for (i = 0; i < P.pts.length - 1; i++) {
        var p0 = P.pts[i], p1 = P.pts[i + 1];
        var c0 = [p0[0] + P.outT[i][0], p0[1] + P.outT[i][1]], c1 = [p1[0] + P.inT[i + 1][0], p1[1] + P.inT[i + 1][1]];
        var L = 0, prev = p0;
        for (k = 1; k <= N; k++) {
            var q = DG.bezPt(p0, c0, c1, p1, k / N);
            L += Math.sqrt((q[0] - prev[0]) * (q[0] - prev[0]) + (q[1] - prev[1]) * (q[1] - prev[1]));
            prev = q;
        }
        out.push(L);
    }
    return out;
};
/* Times at which a linear draw-on of the path reaches each vertex. */
DG.vertexTimes = function (P, t0, t1) {
    var L = DG.segLens(P), tot = DG.sum(L), acc = 0, times = [t0];
    for (var i = 0; i < L.length; i++) { acc += L[i]; times.push(t0 + (t1 - t0) * (tot > 0 ? acc / tot : (i + 1) / L.length)); }
    return times;
};
