/*
 * DocuGraph — core engine.
 *
 * IMPORTANT: everything in /shared must stay ES3-compatible, because the very
 * same files are loaded by the CEP panel (Chromium, for the live preview) and
 * by After Effects' ExtendScript engine (for the real render). That means:
 * no let/const/arrow functions, no Array.map/forEach/indexOf, no JSON object,
 * no String.trim, no Object.keys. `npm test` lints for this.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.version = '0.1.0';
DG.charts = DG.charts || {};
DG.VARIANTS = DG.VARIANTS || {};

/* ------------------------------------------------------------------ utils */

DG.isArr = function (a) { return Object.prototype.toString.call(a) === '[object Array]'; };
DG.trim = function (s) { return String(s).replace(/^[\s ﻿]+|[\s ﻿]+$/g, ''); };
DG.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
DG.lerp = function (a, b, t) { return a + (b - a) * t; };
DG.round = function (v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; };
DG.extend = function (dst) {
    for (var i = 1; i < arguments.length; i++) {
        var s = arguments[i];
        if (s) { for (var k in s) { if (s.hasOwnProperty(k)) { dst[k] = s[k]; } } }
    }
    return dst;
};
DG.range = function (n) { var a = []; for (var i = 0; i < n; i++) { a.push(i); } return a; };
DG.maxOf = function (a, f) {
    var m = -Infinity;
    for (var i = 0; i < a.length; i++) { var v = f ? f(a[i], i) : a[i]; if (v !== null && v > m) { m = v; } }
    return m;
};
DG.minOf = function (a, f) {
    var m = Infinity;
    for (var i = 0; i < a.length; i++) { var v = f ? f(a[i], i) : a[i]; if (v !== null && v < m) { m = v; } }
    return m;
};
DG.sum = function (a) { var s = 0; for (var i = 0; i < a.length; i++) { if (a[i] !== null) { s += a[i]; } } return s; };
DG.norm = function (s) { return DG.trim(String(s === null || s === undefined ? '' : s)).toLowerCase(); };
/* Is `label` one of the comma separated names in `list`? (used for highlight) */
DG.inList = function (label, list) {
    if (!list) { return false; }
    var parts = String(list).split(','), l = DG.norm(label);
    for (var i = 0; i < parts.length; i++) { if (DG.norm(parts[i]) === l && l !== '') { return true; } }
    return false;
};

/* ----------------------------------------------------------------- colors */

DG.hexToRgb = function (hex) {
    var h = String(hex || '#000000').replace('#', '');
    if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
    var n = parseInt(h.substring(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
DG.rgbToHex = function (c) {
    var s = '#';
    for (var i = 0; i < 3; i++) {
        var v = Math.round(DG.clamp(c[i], 0, 1) * 255).toString(16);
        s += v.length < 2 ? '0' + v : v;
    }
    return s;
};
DG.mix = function (a, b, t) {
    var x = DG.hexToRgb(a), y = DG.hexToRgb(b);
    return DG.rgbToHex([DG.lerp(x[0], y[0], t), DG.lerp(x[1], y[1], t), DG.lerp(x[2], y[2], t)]);
};
DG.luma = function (hex) { var c = DG.hexToRgb(hex); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };

/* --------------------------------------------------------- number format
 * Kept as SOURCE TEXT so the identical function can be embedded inside
 * After Effects expressions (count-up labels) and also eval'd here. One
 * implementation => preview and render always print the same string.
 *   o.prefix / o.suffix   "$", "%", " million" ...
 *   o.decimals            fixed decimals
 *   o.grouping            "intl" 1,234,567 | "none"
 *   o.compact             "none" | "en" (K/M/B/T) | "words" (million/billion)
 *   o.ref                 value used to choose the compact unit (so a
 *                         count-up keeps one unit the whole time)
 */
DG.FMT_SRC = [
    'function(v,o){',
    'o=o||{};',
    'if(v===null||v===undefined||isNaN(v))return "";',
    'var d=(o.decimals===undefined||o.decimals===null||o.decimals==="")?0:Number(o.decimals);',
    'var neg=v<0;v=Math.abs(v);var unit="",i,U=null;',
    'var ref=Math.abs((o.ref===undefined||o.ref===null)?v:o.ref);',
    'if(o.compact==="en")U=[[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];',
    'else if(o.compact==="words")U=[[1e12," trillion"],[1e9," billion"],[1e6," million"]];',
    'if(U){for(i=0;i<U.length;i++){if(ref>=U[i][0]){v=v/U[i][0];unit=U[i][1];break;}}}',
    'var s=v.toFixed(d);var p=s.indexOf(".");var ip=p<0?s:s.substring(0,p);var fp=p<0?"":s.substring(p);',
    'var g=o.grouping||"intl";',
    'if(g==="intl"){ip=ip.replace(/\\B(?=(\\d{3})+(?!\\d))/g,",");}',
    'if(neg&&Number(s)===0)neg=false;',
    'var out=(neg?"-":"")+(o.prefix||"")+ip+fp+unit+(o.suffix||"");',
    'return out;}'
].join('');
DG.fmt = eval('(' + DG.FMT_SRC + ')');

/* Divisor that the compact mode will use for a reference value. */
DG.compactDiv = function (ref, compact) {
    var U = compact === 'en' || compact === 'words' ? [1e12, 1e9, 1e6, compact === 'en' ? 1e3 : 1e99]
        : [];
    ref = Math.abs(ref);
    for (var i = 0; i < U.length; i++) { if (ref >= U[i]) { return U[i]; } }
    return 1;
};

/* ------------------------------------------------------------------ easing */

DG.BEZ_SRC = 'function(p,x1,y1,x2,y2){if(p<=0)return 0;if(p>=1)return 1;var lo=0,hi=1,t=p,x,i;' +
    'for(i=0;i<48;i++){x=3*(1-t)*(1-t)*t*x1+3*(1-t)*t*t*x2+t*t*t;if(Math.abs(x-p)<1e-7)break;if(x<p)lo=t;else hi=t;t=(lo+hi)/2;}' +
    'return 3*(1-t)*(1-t)*t*y1+3*(1-t)*t*t*y2+t*t*t;}';
DG.bez = eval('(' + DG.BEZ_SRC + ')');

/* Ease presets expressed as After Effects keyframe influence (%): `o` is the
 * outgoing influence of the first key, `i` the incoming influence of the
 * second. Both keys get speed 0, so the curve equals cubic-bezier(o,0,1-i,1).
 * `null` means linear keyframes. */
DG.EASES = {
    linear: null,
    easy: { o: 33.33, i: 33.33 },
    smooth: { o: 70, i: 70 },
    out: { o: 0.1, i: 90 },
    snap: { o: 15, i: 85 },
    inout: { o: 50, i: 50 }
};
DG.easeDef = function (name) {
    if (name === null || name === undefined || name === 'linear') { return null; }
    return DG.EASES.hasOwnProperty(name) ? DG.EASES[name] : DG.EASES.out;
};
DG.ease = function (name, p) {
    var e = DG.easeDef(name);
    if (!e) { return DG.clamp(p, 0, 1); }
    return DG.bez(p, e.o / 100, 0, 1 - e.i / 100, 1);
};
DG.OVER_MID = 0.62; /* where the overshoot peak sits inside an animation */

/* Progress factor of one animation at time t (0 → 1, may exceed 1 while it
 * overshoots). The AE renderer creates keyframes that reproduce exactly this. */
DG.animF = function (a, t) {
    if (!a) { return 1; }
    if (t <= a.t0) { return 0; }
    if (t >= a.t1) { return 1; }
    var p = (t - a.t0) / (a.t1 - a.t0);
    if (a.over) {
        var m = DG.OVER_MID, O = a.over;
        if (p < m) { return O * DG.ease(a.ease, p / m); }
        return O + (1 - O) * DG.ease(a.ease, (p - m) / (1 - m));
    }
    return DG.ease(a.ease, p);
};
/* Piecewise-linear lookup used by follow / wipe / follow-label animations. */
DG.interp = function (times, vals, t) {
    var n = times.length;
    if (!n) { return 0; }
    if (t <= times[0]) { return vals[0]; }
    if (t >= times[n - 1]) { return vals[n - 1]; }
    for (var k = 0; k < n - 1; k++) {
        if (t < times[k + 1]) {
            var dt = times[k + 1] - times[k];
            return dt <= 0 ? vals[k + 1] : vals[k] + (vals[k + 1] - vals[k]) * (t - times[k]) / dt;
        }
    }
    return vals[n - 1];
};

/* Multi-key animation ({kind:'keys', prop, times, vals, ease}): each segment
 * between two keys is eased independently — exactly how After Effects
 * interpolates keyframes that all have speed 0 (ease = null → linear). */
DG.keysVal = function (a, t) {
    var T = a.times, V = a.vals, n = T.length;
    if (t <= T[0]) { return V[0]; }
    if (t >= T[n - 1]) { return V[n - 1]; }
    for (var k = 0; k < n - 1; k++) {
        if (t < T[k + 1]) {
            var dt = T[k + 1] - T[k], p = dt <= 0 ? 1 : (t - T[k]) / dt;
            return V[k] + (V[k + 1] - V[k]) * DG.ease(a.ease, p);
        }
    }
    return V[n - 1];
};
/* Text of a 'live' animation: interpolated number, or a label picked by index. */
DG.liveText = function (a, t) {
    var v = DG.interp(a.times, a.vals, t);
    if (a.labels) { return a.labels[Math.max(0, Math.min(a.labels.length - 1, Math.floor(v + 1e-6)))]; }
    return DG.fmt(v, a.fmt);
};

/* -------------------------------------------------------------------- data */

DG.num = function (s) {
    if (s === null || s === undefined) { return NaN; }
    if (typeof s === 'number') { return s; }
    var t = DG.trim(s);
    var neg = /^\(.*\)$/.test(t);
    t = t.replace(/[\s,()$€£৳₹¥%]/g, '').replace(/^−/, '-');
    var mult = 1, m = /([kmbt])$/i.exec(t);
    if (m) {
        mult = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 }[m[1].toLowerCase()];
        t = t.substring(0, t.length - 1);
    }
    if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) { return NaN; }
    var v = parseFloat(t) * mult;
    return neg ? -v : v;
};
DG.isNum = function (s) { return !isNaN(DG.num(s)); };

/* Parse pasted Excel / Google Sheets / CSV text into {headers, rows}. */
DG.parseTable = function (text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n'), raw = [], i, j;
    var first = '';
    for (i = 0; i < lines.length; i++) { if (DG.trim(lines[i]) !== '') { first = lines[i]; break; } }
    var delim = first.indexOf('\t') >= 0 ? '\t'
        : (first.split(';').length > first.split(',').length ? ';' : ',');
    for (i = 0; i < lines.length; i++) {
        if (DG.trim(lines[i]) === '' || /^\s*#/.test(lines[i])) { continue; }
        raw.push(DG.splitRow(lines[i], delim));
    }
    if (!raw.length) { return { headers: [], rows: [] }; }
    var width = 0;
    for (i = 0; i < raw.length; i++) { if (raw[i].length > width) { width = raw[i].length; } }
    for (i = 0; i < raw.length; i++) { while (raw[i].length < width) { raw[i].push(''); } }
    var headerRow = true;
    for (j = 0; j < width; j++) { if (raw[0][j] !== '' && DG.isNum(raw[0][j])) { headerRow = false; } }
    /* "Country, 1990, 2020": a text first cell followed only by years is a
     * header too — unless the data rows are also just years. */
    if (!headerRow && raw.length > 1 && raw[0][0] !== '' && !DG.isNum(raw[0][0]) && DG.isYearRow(raw[0]) && !DG.isYearRow(raw[1])) { headerRow = true; }
    if (raw.length === 1) { headerRow = false; }
    var headers = [];
    if (headerRow) { headers = raw.shift(); } else {
        for (j = 0; j < width; j++) { headers.push(j === 0 ? 'Label' : 'Series ' + j); }
    }
    return { headers: headers, rows: raw };
};
DG.isYearRow = function (row) {
    var n = 0;
    for (var j = 1; j < row.length; j++) {
        if (row[j] === '') { continue; }
        if (!/^(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})$/.test(DG.trim(row[j]))) { return false; }
        n++;
    }
    return n > 0;
};
DG.splitRow = function (line, delim) {
    var out = [], cur = '', q = false, i, ch;
    for (i = 0; i < line.length; i++) {
        ch = line.charAt(i);
        if (q) {
            if (ch === '"') { if (line.charAt(i + 1) === '"') { cur += '"'; i++; } else { q = false; } } else { cur += ch; }
        } else if (ch === '"') { q = true; } else if (ch === delim) { out.push(DG.trim(cur)); cur = ''; } else { cur += ch; }
    }
    out.push(DG.trim(cur));
    return out;
};
/* Table → categories (first column) + numeric series (other columns). */
DG.seriesData = function (tb) {
    var cats = [], series = [], i, c, nc = tb.headers.length;
    if (nc === 1) {
        series.push({ name: tb.headers[0] || 'Value', values: [] });
        for (i = 0; i < tb.rows.length; i++) { cats.push(String(i + 1)); series[0].values.push(DG.numOrNull(tb.rows[i][0])); }
        return { cats: cats, series: series };
    }
    for (c = 1; c < nc; c++) { series.push({ name: tb.headers[c] || ('Series ' + c), values: [], col: c }); }
    for (i = 0; i < tb.rows.length; i++) {
        cats.push(tb.rows[i][0]);
        for (c = 1; c < nc; c++) { series[c - 1].values.push(DG.numOrNull(tb.rows[i][c])); }
    }
    var keep = [];
    for (c = 0; c < series.length; c++) {
        var any = false;
        for (i = 0; i < series[c].values.length; i++) { if (series[c].values[i] !== null) { any = true; } }
        if (any) { keep.push(series[c]); }
    }
    return { cats: cats, series: keep };
};
/* Rows = entities & columns = years? Flip to rows = time (used by races). */
DG.transposeIfWide = function (tb) {
    if (tb.headers.length < 3 || tb.rows.length < 1) { return tb; }
    var c, yearsInHeader = true;
    for (c = 1; c < tb.headers.length; c++) { if (!DG.isNum(tb.headers[c])) { yearsInHeader = false; } }
    if (!yearsInHeader || DG.isNum(tb.rows[0][0])) { return tb; }
    var headers = [tb.headers[0] || 'Time'], rows = [], i;
    for (i = 0; i < tb.rows.length; i++) { headers.push(tb.rows[i][0]); }
    for (c = 1; c < tb.headers.length; c++) {
        var r = [tb.headers[c]];
        for (i = 0; i < tb.rows.length; i++) { r.push(tb.rows[i][c]); }
        rows.push(r);
    }
    return { headers: headers, rows: rows };
};
DG.numOrNull = function (s) { var v = DG.num(s); return isNaN(v) ? null : v; };

/* ------------------------------------------------------------------ scales */

DG.niceNum = function (r, round) {
    if (r <= 0) { return 1; }
    var e = Math.floor(Math.log(r) / Math.LN10), f = r / Math.pow(10, e), nf;
    if (round) { nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10; } else { nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10; }
    return nf * Math.pow(10, e);
};
DG.ticks = function (min, max, n) {
    n = n || 5;
    if (!(max > min)) {
        if (max === 0 || isNaN(max)) { min = 0; max = 1; } else if (max > 0) { min = 0; } else { max = 0; }
    }
    var step = DG.niceNum(DG.niceNum(max - min, false) / (n - 1), true);
    var lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
    var dec = Math.max(0, -Math.floor(Math.log(step) / Math.LN10 + 1e-9));
    var ticks = [];
    for (var k = 0; lo + k * step <= hi + step * 0.5; k++) { ticks.push(DG.round(lo + k * step, dec + 2)); }
    return { min: lo, max: hi, step: step, ticks: ticks, decimals: dec };
};
/* Live-data axis: always 5 ticks (0, ¼, ½, ¾, max) with a "nice" max. Kept
 * as source so AE expressions compute the identical axis when a data slider
 * changes. */
DG.NICEMAX_SRC = 'function(m){if(!(m>0))return 1;var r=m/4,e=Math.floor(Math.log(r)/Math.LN10),b=Math.pow(10,e),f=r/b,' +
    'S=[1,1.25,1.5,2,2.5,3,4,5,6,7.5,8,10],i;for(i=0;i<S.length;i++){if(f<=S[i]*1.000001){return S[i]*b*4;}}return 40*b;}';
DG.niceMax = eval('(' + DG.NICEMAX_SRC + ')');
DG.liveTicks = function (max) {
    var M = DG.niceMax(max), st = M / 4;
    var dec = Math.max(0, -Math.floor(Math.log(st) / Math.LN10 + 1e-9));
    while (dec < 6 && Math.abs(st * Math.pow(10, dec) - Math.round(st * Math.pow(10, dec))) > 1e-9) { dec += 1; }
    return { min: 0, max: M, step: st, ticks: [0, st, st * 2, st * 3, M], decimals: dec };
};

/* Number format for axis ticks: same units as the data, sensible decimals. */
DG.tickFmt = function (F, tk) {
    var div = DG.compactDiv(Math.max(Math.abs(tk.max), Math.abs(tk.min)), F.compact);
    var dec = Math.max(0, -Math.floor(Math.log(tk.step / div) / Math.LN10 + 1e-9));
    return DG.extend({}, F, { decimals: dec, ref: Math.max(Math.abs(tk.max), Math.abs(tk.min)) });
};

/* Rough text width (used only for layout decisions, not rendering). */
DG.textW = function (s, size) {
    s = String(s);
    var w = 0, i, c;
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c >= 0x0981 && c <= 0x09FF) { w += (c >= 0x09BE && c <= 0x09D7) || c === 0x09CD ? 0.12 : 0.62; } else if (c === 32) { w += 0.28; } else if (c >= 48 && c <= 57) { w += 0.57; } else if (c >= 65 && c <= 90) { w += 0.68; } else if (c === 46 || c === 44) { w += 0.28; } else { w += 0.53; }
    }
    return w * size;
};
/* Shrink a font size until the text fits a width. */
DG.fit = function (s, size, maxW, minSize) {
    var w = DG.textW(s, size);
    if (w <= maxW) { return size; }
    return Math.max(minSize || size * 0.5, size * maxW / w);
};

/* Shorten text with an ellipsis so it fits maxW at the given size. */
DG.ellipsis = function (s, size, maxW) {
    s = String(s);
    if (DG.textW(s, size) <= maxW) { return s; }
    while (s.length > 1 && DG.textW(s + '\u2026', size) > maxW) { s = s.substring(0, s.length - 1); }
    return DG.trim(s) + '\u2026';
};

/* ------------------------------------------------------------- JSON (ES3) */

DG.quote = function (s) {
    var out = '"', i, c, h;
    s = String(s);
    for (i = 0; i < s.length; i++) {
        c = s.charCodeAt(i);
        if (c === 34) { out += '\\"'; } else if (c === 92) { out += '\\\\'; } else if (c === 10) { out += '\\n'; } else if (c === 13) { out += '\\r'; } else if (c === 9) { out += '\\t'; } else if (c < 32 || c > 126) { h = c.toString(16); while (h.length < 4) { h = '0' + h; } out += '\\u' + h; } else { out += s.charAt(i); }
    }
    return out + '"';
};
DG.toJSON = function (v) {
    var i, k, parts;
    if (v === null || v === undefined) { return 'null'; }
    if (typeof v === 'number') { return isFinite(v) ? String(v) : 'null'; }
    if (typeof v === 'boolean') { return v ? 'true' : 'false'; }
    if (typeof v === 'string') { return DG.quote(v); }
    if (DG.isArr(v)) {
        parts = [];
        for (i = 0; i < v.length; i++) { parts.push(DG.toJSON(v[i])); }
        return '[' + parts.join(',') + ']';
    }
    if (typeof v === 'object') {
        parts = [];
        for (k in v) {
            if (v.hasOwnProperty(k) && v[k] !== undefined && typeof v[k] !== 'function') { parts.push(DG.quote(k) + ':' + DG.toJSON(v[k])); }
        }
        return '{' + parts.join(',') + '}';
    }
    return 'null';
};
DG.parseJSON = function (s) { return eval('(' + s + ')'); };
