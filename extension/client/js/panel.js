/* DocuGraph panel UI: state ↔ form, live preview, create-in-AE. */
(function () {
    var DG = window.DG, PV = window.DGPreview, Host = window.DGHostBridge;
    var $ = function (id) { return document.getElementById(id); };
    var STORE = 'docugraph.state.v1';

    var TYPES = [
        { id: 'bar', label: 'Bar', icon: '<rect x="4" y="16" width="8" height="12"/><rect x="16" y="6" width="8" height="22"/><rect x="28" y="11" width="8" height="17"/>' },
        { id: 'line', label: 'Line', icon: '<polyline points="3,26 13,18 22,21 33,7 41,10" fill="none" stroke-width="3"/>' },
        { id: 'pie', label: 'Pie / Donut', icon: '<circle cx="22" cy="15" r="10" fill="none" stroke-width="6" stroke-dasharray="40 100"/><circle cx="22" cy="15" r="10" fill="none" stroke-width="6" opacity=".4"/>' },
        { id: 'counter', label: 'Big number', icon: '<text x="22" y="22" text-anchor="middle" font-size="17" font-weight="700" stroke="none">123</text>' },
        { id: 'timeline', label: 'Timeline', icon: '<line x1="3" y1="15" x2="41" y2="15" stroke-width="2"/><circle cx="10" cy="15" r="3"/><circle cx="22" cy="15" r="3"/><circle cx="34" cy="15" r="3"/>' },
        { id: 'race', label: 'Bar race', icon: '<rect x="4" y="3" width="34" height="6"/><rect x="4" y="12" width="25" height="6" opacity=".7"/><rect x="4" y="21" width="16" height="6" opacity=".45"/>' },
        { id: 'pyramid', label: 'Pyramid', icon: '<rect x="8" y="22" width="13" height="5"/><rect x="23" y="22" width="13" height="5"/><rect x="11" y="15" width="10" height="5"/><rect x="23" y="15" width="10" height="5"/><rect x="15" y="8" width="6" height="5"/><rect x="23" y="8" width="6" height="5"/>' }
    ];

    var DEFAULT = {
        type: 'bar', variant: 'column', theme: 'docDark', size: '1920x1080', fps: 30, duration: 10,
        title: '', subtitle: '', source: '', credit: '', data: '',
        options: { highlight: '', sort: 'none', colorBy: 'single', values: true, grid: true, axis: true, endLabels: true, live: true },
        dataMode: 'table',
        format: { prefix: '', suffix: '', decimals: '', grouping: 'intl', digits: 'latin', compact: 'none' },
        style: { hiOn: false, hi: '#E8B04B', fTitle: '', fBody: '', fBnBold: '', fBnBody: '' },
        anim: { speed: 1, stagger: 0.12, ease: 'out', titleAnim: 'fade', overshoot: true },
        background: 'solid'
    };

    var state;
    try { state = JSON.parse(localStorage.getItem(STORE)); } catch (e) { state = null; }
    if (!state || !state.type) { state = JSON.parse(JSON.stringify(DEFAULT)); applySample(); }

    function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ } }

    function applySample() {
        var s = DG.sample(state.type, state.variant);
        if (!s) { return; }
        state.title = s.title || ''; state.subtitle = s.subtitle || ''; state.source = s.source || '';
        state.data = s.data;
        state.options.highlight = (s.options && s.options.highlight) || '';
        state.options.sort = (s.options && s.options.sort) || 'none';
        state.options.periodSec = (s.options && s.options.periodSec) || 1;
        /* keep the user's language choices (digits) across samples */
        var digits = state.format && state.format.digits;
        state.format = Object.assign({}, DEFAULT.format, s.format || {});
        if (digits) { state.format.digits = digits; }
    }

    /* ------------------------------------------------------------ spec */
    function spec() {
        var wh = state.size.split('x').map(Number), st = state.style, fonts = {};
        if (st.fTitle) { fonts.title = st.fTitle; fonts.num = st.fTitle; }
        if (st.fBody) { fonts.body = st.fBody; }
        if (st.fBnBold) { fonts.bnBold = st.fBnBold; }
        if (st.fBnBody) { fonts.bnBody = st.fBnBody; }
        var f = Object.assign({}, state.format);
        if (f.decimals === '' || f.decimals === null) { delete f.decimals; } else { f.decimals = Number(f.decimals); }
        return {
            type: state.type, variant: state.variant, theme: state.theme,
            width: wh[0], height: wh[1], fps: Number(state.fps), duration: Number(state.duration) || 10,
            title: state.title, subtitle: state.subtitle, source: state.source, credit: state.credit,
            data: state.data, background: state.background,
            options: {
                highlight: state.options.highlight, sort: state.options.sort, colorBy: state.options.colorBy,
                values: state.options.values, grid: state.options.grid, axis: state.options.axis, endLabels: state.options.endLabels,
                live: state.options.live !== false, periodSec: Number(state.options.periodSec) || 1
            },
            format: f,
            style: { hi: st.hiOn ? st.hi : '', fonts: fonts },
            panel: state,
            anim: {
                speed: Number(state.anim.speed), stagger: Number(state.anim.stagger), ease: state.anim.ease,
                titleAnim: state.anim.titleAnim, overshoot: !!state.anim.overshoot
            }
        };
    }

    /* --------------------------------------------------------- preview */
    var scene = null, t = 0, playing = false, last = 0;
    function rebuild() {
        try {
            scene = DG.build(spec());
            sizeStage();
            if (!playing) { t = scene.duration; }
            draw();
        } catch (e) { setStatus('Preview error: ' + e.message, 'err'); }
        save();
    }
    /* explicit sizing (older CEP Chromium has no CSS aspect-ratio) */
    function sizeStage() {
        if (!scene) { return; }
        var st = $('stage'), maxW = st.parentNode.clientWidth - 24, maxH = window.innerHeight * 0.38;
        var w = Math.min(maxW, maxH * scene.width / scene.height);
        st.style.width = w + 'px'; st.style.height = (w * scene.height / scene.width) + 'px';
    }
    window.addEventListener('resize', sizeStage);
    function draw() {
        if (!scene) { return; }
        $('stage').innerHTML = PV.render(scene, t);
        $('scrub').value = Math.round(t / scene.duration * 1000);
        $('time').textContent = t.toFixed(1) + 's';
    }
    function tick(now) {
        if (!playing) { return; }
        t += (now - last) / 1000; last = now;
        if (t >= scene.duration) { t = scene.duration; playing = false; $('play').textContent = '▶'; }
        draw();
        if (playing) { requestAnimationFrame(tick); }
    }
    function play() {
        if (!scene) { return; }
        playing = !playing;
        $('play').textContent = playing ? '❚❚' : '▶';
        if (playing) { if (t >= scene.duration - 0.01) { t = 0; } last = performance.now(); requestAnimationFrame(tick); }
    }

    /* --------------------------------------------------------------- UI */
    function renderTypes() {
        $('types').innerHTML = TYPES.map(function (ty) {
            return '<div class="type' + (ty.id === state.type ? ' on' : '') + '" data-id="' + ty.id + '"><svg viewBox="0 0 44 30" fill="currentColor" stroke="currentColor">' + ty.icon + '</svg>' + ty.label + '</div>';
        }).join('');
        $('variants').innerHTML = (DG.VARIANTS[state.type] || []).map(function (v) {
            return '<span class="pill' + (v.id === state.variant ? ' on' : '') + '" data-id="' + v.id + '">' + v.label + '</span>';
        }).join('');
        var hints = {
            bar: 'label, value[, value…]', line: 'x (year), series…', pie: 'label, value',
            counter: 'label, value[, start value]', timeline: state.variant === 'eras' ? 'start, end, label' : 'date, title[, note]', pyramid: 'group, left, right',
            race: 'year, entity 1, entity 2, … (or entities × years)'
        };
        $('dataHint').textContent = '— columns: ' + hints[state.type];
    }
    function renderThemes() {
        $('themes').innerHTML = DG.THEME_ORDER.map(function (id) {
            var th = DG.THEMES[id];
            return '<div class="theme' + (id === state.theme ? ' on' : '') + '" data-id="' + id + '" style="background:' + th.bg + ';color:' + th.text + '">' +
                '<div class="nm" style="font-family:' + th.fonts.title.css.replace(/"/g, "'") + '">' + th.label + '</div><div class="sw">' +
                th.palette.slice(0, 6).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</div></div>';
        }).join('');
    }

    /* form field ↔ state path bindings */
    var BIND = {
        size: 'size', fps: 'fps', data: 'data', highlight: 'options.highlight', sort: 'options.sort', colorBy: 'options.colorBy',
        values: 'options.values', grid: 'options.grid', axis: 'options.axis', endLabels: 'options.endLabels', live: 'options.live', periodSec: 'options.periodSec',
        hi: 'style.hi', hiOn: 'style.hiOn', background: 'background', fTitle: 'style.fTitle', fBody: 'style.fBody',
        fBnBold: 'style.fBnBold', fBnBody: 'style.fBnBody', title: 'title', subtitle: 'subtitle', source: 'source', credit: 'credit',
        prefix: 'format.prefix', suffix: 'format.suffix', decimals: 'format.decimals', grouping: 'format.grouping',
        digits: 'format.digits', compact: 'format.compact', speed: 'anim.speed', stagger: 'anim.stagger', ease: 'anim.ease',
        titleAnim: 'anim.titleAnim', duration: 'duration', overshoot: 'anim.overshoot'
    };
    function getPath(p) { return p.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, state); }
    function setPath(p, v) {
        var ks = p.split('.'), o = state;
        for (var i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
        o[ks[ks.length - 1]] = v;
    }
    function fillForm() {
        Object.keys(BIND).forEach(function (id) {
            var el = $(id), v = getPath(BIND[id]);
            if (!el) { return; }
            if (el.type === 'checkbox') { el.checked = !!v; } else { el.value = v === undefined || v === null ? '' : v; }
        });
        $('speedV').textContent = '×' + Number(state.anim.speed).toFixed(1);
        renderTypes(); renderThemes(); renderGrid(); info();
    }

    /* ------------------------------------------------- table data editor */
    function toRows() {
        var rows;
        if (state.data.indexOf('\t') >= 0 || /^\s*$/.test(state.data)) {
            /* tab data: split directly so empty rows being typed survive */
            rows = state.data.replace(/\r/g, '').split('\n').map(function (l) { return l.split('\t'); });
            while (rows.length > 1 && rows[rows.length - 1].join('') === '' && rows[rows.length - 1].length === 1) { rows.pop(); }
        } else {
            var tb = DG.parseTable(state.data);
            rows = [tb.headers.slice()].concat(tb.rows.map(function (r) { return r.slice(); }));
        }
        if (!rows.length || !rows[0].length || rows[0].join('') === '') { rows = [['Label', 'Value'], ['', '']]; }
        var w = Math.max.apply(null, rows.map(function (r) { return r.length; }));
        rows.forEach(function (r) { while (r.length < w) { r.push(''); } });
        return rows;
    }
    function fromRows(rows) {
        state.data = rows.map(function (r) { return r.map(function (c) { return String(c).replace(/[\t\n]/g, ' '); }).join('\t'); }).join('\n');
        $('data').value = state.data;
    }
    function renderGrid() {
        var tableMode = state.dataMode !== 'text';
        $('gridWrap').style.display = tableMode ? '' : 'none';
        $('gridBtns').style.display = tableMode ? '' : 'none';
        $('data').style.display = tableMode ? 'none' : '';
        [].forEach.call(document.querySelectorAll('#dataMode button'), function (b) { b.classList.toggle('on', (b.dataset.m === 'table') === tableMode); });
        if (!tableMode) { return; }
        var rows = toRows(), esc = function (v) { return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); };
        $('grid').innerHTML = rows.map(function (r, i) {
            return '<tr>' + r.map(function (c, j) { return '<td><input data-r="' + i + '" data-c="' + j + '" value="' + esc(c) + '"></td>'; }).join('') +
                '<td class="x">' + (i > 0 ? '<button data-del="' + i + '" title="Delete row">×</button>' : '') + '</td></tr>';
        }).join('');
    }
    $('grid').addEventListener('input', function (e) {
        var inp = e.target;
        if (!inp.dataset || inp.dataset.r === undefined) { return; }
        var rows = [].map.call($('grid').rows, function (tr) { return [].map.call(tr.querySelectorAll('input'), function (x) { return x.value; }); });
        fromRows(rows); changed();
    });
    $('grid').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' || !e.target.dataset) { return; }
        var r = Number(e.target.dataset.r) + 1, c = e.target.dataset.c;
        var next = $('grid').querySelector('input[data-r="' + r + '"][data-c="' + c + '"]');
        if (!next) { $('addRow').click(); next = $('grid').querySelector('input[data-r="' + r + '"][data-c="' + c + '"]'); }
        if (next) { next.focus(); next.select(); }
    });
    /* pasting a block from Excel into any cell replaces the table */
    $('grid').addEventListener('paste', function (e) {
        var txt = (e.clipboardData || window.clipboardData).getData('text');
        if (txt && /[\t\n]/.test(txt)) { e.preventDefault(); state.data = txt; $('data').value = txt; renderGrid(); changed(); }
    });
    $('grid').addEventListener('click', function (e) {
        var d = e.target.dataset && e.target.dataset.del;
        if (!d) { return; }
        var rows = toRows(); rows.splice(Number(d), 1); fromRows(rows); renderGrid(); changed();
    });
    $('addRow').addEventListener('click', function () { var rows = toRows(); rows.push(rows[0].map(function () { return ''; })); fromRows(rows); renderGrid(); changed(); });
    $('addCol').addEventListener('click', function () {
        var rows = toRows();
        rows.forEach(function (r, i) { r.push(i === 0 ? 'Series ' + r.length : ''); });
        fromRows(rows); renderGrid(); changed();
    });
    $('delCol').addEventListener('click', function () {
        var rows = toRows();
        if (rows[0].length <= 2) { return; }
        rows.forEach(function (r) { r.pop(); });
        fromRows(rows); renderGrid(); changed();
    });
    $('dataMode').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) { return; }
        state.dataMode = b.dataset.m; renderGrid(); save();
    });
    function info() {
        var tb = DG.parseTable(state.data), sd = DG.seriesData(tb);
        $('parseInfo').textContent = tb.rows.length + ' rows · ' + sd.series.length + ' numeric column' + (sd.series.length === 1 ? '' : 's');
        var f = spec().format;
        $('fmtDemo').textContent = 'Example: ' + DG.fmt(1234567.891, f) + '   ·   ' + DG.fmt(173000000, Object.assign({}, f, { ref: 173000000 }));
    }

    var timer = null;
    function changed() { info(); clearTimeout(timer); timer = setTimeout(rebuild, 120); }

    Object.keys(BIND).forEach(function (id) {
        var el = $(id);
        if (!el) { return; }
        var ev = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color') ? 'change' : 'input';
        el.addEventListener(ev, function () {
            setPath(BIND[id], el.type === 'checkbox' ? el.checked : el.value);
            if (id === 'speed') { $('speedV').textContent = '×' + Number(el.value).toFixed(1); }
            if (id === 'hi') { state.style.hiOn = true; $('hiOn').checked = true; }
            changed();
        });
    });

    $('types').addEventListener('click', function (e) {
        var c = e.target.closest('.type');
        if (!c || c.dataset.id === state.type) { return; }
        state.type = c.dataset.id; state.variant = DG.VARIANTS[state.type][0].id;
        applySample(); fillForm(); rebuild();
    });
    $('variants').addEventListener('click', function (e) {
        var c = e.target.closest('.pill');
        if (!c) { return; }
        var before = DG.sample(state.type, state.variant);
        state.variant = c.dataset.id;
        /* switch to the variant's own sample only if the user hasn't edited the data */
        var after = DG.sample(state.type, state.variant);
        if (before && after && before !== after && state.data === before.data) { applySample(); }
        fillForm(); rebuild();
    });
    $('themes').addEventListener('click', function (e) {
        var c = e.target.closest('.theme');
        if (!c) { return; }
        state.theme = c.dataset.id;
        if (!state.style.hiOn) { state.style.hi = DG.THEMES[state.theme].hi; }
        fillForm(); rebuild();
    });
    $('tabs').addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) { return; }
        [].forEach.call(document.querySelectorAll('.tabs button'), function (x) { x.classList.toggle('on', x === b); });
        [].forEach.call(document.querySelectorAll('.page'), function (p) { p.classList.toggle('on', p.id === 'page-' + b.dataset.tab); });
    });
    $('loadSample').addEventListener('click', function () { applySample(); fillForm(); rebuild(); });
    $('play').addEventListener('click', play);
    $('scrub').addEventListener('input', function () { playing = false; $('play').textContent = '▶'; t = $('scrub').value / 1000 * scene.duration; draw(); });
    document.addEventListener('keydown', function (e) {
        if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); play(); }
    });

    function setStatus(msg, cls) { var s = $('status'); s.textContent = msg; s.className = 'status' + (cls ? ' ' + cls : ''); s.title = msg; }

    function run(btnId, call, verb) {
        if (!Host.available) { setStatus('Open this panel inside After Effects to do this', 'err'); return; }
        var btn = $(btnId);
        btn.disabled = true; setStatus(verb + '…');
        call().then(function (res) {
            btn.disabled = false;
            var p = res.split('|');
            if (p[0] === 'OK') { setStatus('✓ ' + verb + ' "' + p[1] + '" (' + p[3] + ' layers)', 'ok'); } else { setStatus(p.slice(1).join('|') || res, 'err'); }
        });
    }
    $('create').addEventListener('click', function () { run('create', function () { return Host.build(spec()); }, 'Created'); });
    $('update').addEventListener('click', function () { run('update', function () { return Host.update(spec()); }, 'Updated'); });
    $('loadComp').addEventListener('click', function () {
        if (!Host.available) { setStatus('Open this panel inside After Effects to do this', 'err'); return; }
        Host.readActive().then(function (res) {
            var i = res.indexOf('|'), tag = res.substring(0, i), body = res.substring(i + 1);
            if (tag !== 'OK') { setStatus(tag === 'NONE' ? 'Open a DocuGraph comp in the timeline first' : body, 'err'); return; }
            try {
                var sp = JSON.parse(body);
                if (!sp.panel) { setStatus('This comp was made by an older version — settings could not be loaded', 'err'); return; }
                state = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), sp.panel);
                fillForm(); rebuild();
                setStatus('✓ Loaded settings from the comp — edit, then “Update open comp”', 'ok');
            } catch (e) { setStatus('Could not read comp settings: ' + e.message, 'err'); }
        });
    });

    $('ver').textContent = 'v' + DG.version;
    if (Host.available) {
        Host.init().then(function (res) {
            var p = res.split('|');
            if (p[0] === 'OK') { setStatus('Connected · After Effects ' + p[2], 'ok'); } else { setStatus('Host error: ' + p.slice(1).join('|'), 'err'); }
        });
    } else {
        setStatus('Preview mode (browser) — open in AE to create comps');
    }
    fillForm();
    rebuild();
}());
