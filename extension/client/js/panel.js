/* DocuGraph panel UI: state ↔ form, live preview, create-in-AE. */
(function () {
    var DG = window.DG, PV = window.DGPreview, Host = window.DGHostBridge;
    var $ = function (id) { return document.getElementById(id); };
    var STORE = 'docugraph.state.v1';

    /* chart types come from the registry in shared/charts/*.js */
    var TYPES = DG.typeIds().map(function (id) { return { id: id, label: DG.TYPES[id].label, icon: DG.TYPES[id].icon }; });

    var DEFAULT = {
        type: 'bar', variant: 'column', theme: 'docDark', size: '1920x1080', fps: 30, duration: 10,
        title: '', subtitle: '', source: '', credit: '', data: '',
        options: { highlight: '', sort: 'none', colorBy: 'single', values: true, grid: true, axis: true, endLabels: true, live: true },
        dataMode: 'table', insert: true,
        format: { prefix: '', suffix: '', decimals: '', grouping: 'intl', compact: 'none' },
        style: { hiOn: false, hi: '#E8B04B', fTitle: '', fBody: '' },
        anim: { speed: 1, stagger: 0.12, ease: 'out', titleAnim: 'fade', overshoot: true },
        background: 'solid'
    };

    /* Saved / loaded settings are merged over the defaults so a setting added
     * later never comes back undefined, and values that no longer exist are
     * reset (e.g. old number formats). */
    function migrate(saved) {
        var st = JSON.parse(JSON.stringify(DEFAULT)), k;
        if (!saved || typeof saved !== 'object') { return null; }
        for (k in saved) {
            if (!saved.hasOwnProperty(k)) { continue; }
            if (st[k] && typeof st[k] === 'object' && saved[k] && typeof saved[k] === 'object') { st[k] = Object.assign(st[k], saved[k]); } else { st[k] = saved[k]; }
        }
        if (!DG.VARIANTS[st.type]) { st.type = DEFAULT.type; st.variant = DEFAULT.variant; }
        if (!DG.VARIANTS[st.type].some(function (v) { return v.id === st.variant; })) { st.variant = DG.VARIANTS[st.type][0].id; }
        if (!DG.THEMES[st.theme]) { st.theme = DEFAULT.theme; }
        if (['intl', 'none'].indexOf(st.format.grouping) < 0) { st.format.grouping = 'intl'; }
        if (['none', 'en', 'words'].indexOf(st.format.compact) < 0) { st.format.compact = 'none'; }
        delete st.format.digits;
        return st;
    }
    var state;
    try { state = migrate(JSON.parse(localStorage.getItem(STORE))); } catch (e) { state = null; }
    if (!state) { state = JSON.parse(JSON.stringify(DEFAULT)); applySample(); }

    /* Edit mode works on a chart read from AE; the new-chart draft stays saved
     * in the panel and comes back when you return to New chart. */
    var mode = 'new', draft = null;
    var edit = { found: null, hint: '', loaded: null, busy: false, again: false, timer: null };
    function save() {
        if (edit.loaded) { renderEdit(); return; }
        try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
    }

    function applySample() {
        var s = DG.sample(state.type, state.variant);
        if (!s) { return; }
        state.title = s.title || ''; state.subtitle = s.subtitle || ''; state.source = s.source || '';
        state.data = s.data;
        state.options.highlight = (s.options && s.options.highlight) || '';
        state.options.sort = (s.options && s.options.sort) || 'none';
        state.options.periodSec = (s.options && s.options.periodSec) || (state.type === 'scatter' ? 1.5 : 1);
        state.format = Object.assign({}, DEFAULT.format, s.format || {});
    }

    /* ------------------------------------------------------------ spec */
    function spec() {
        var wh = state.size.split('x').map(Number), st = state.style, fonts = {};
        if (st.fTitle) { fonts.title = st.fTitle; fonts.num = st.fTitle; }
        if (st.fBody) { fonts.body = st.fBody; }
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
            panel: state, insert: state.insert !== false,
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
            sizeStage(); renderMeta();
            if (!playing) { t = scene.duration; }
            draw();
        } catch (e) { setStatus('Preview error: ' + e.message, 'err'); }
        save(); editChanged();
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
    var icon = function (id) { return '<svg viewBox="0 0 44 30" fill="currentColor" stroke="currentColor">' + DG.TYPES[id].icon + '</svg>'; };
    var filter = 'all';
    function renderTypes() {
        $('types').innerHTML = '<span class="chip' + (filter === 'all' ? ' on' : '') + '" data-id="all">All</span>' + TYPES.map(function (ty) {
            return '<span class="chip' + (filter === ty.id ? ' on' : '') + '" data-id="' + ty.id + '">' + icon(ty.id) + ty.label + '</span>';
        }).join('');
        var vLabel = (DG.VARIANTS[state.type].filter(function (v) { return v.id === state.variant; })[0] || {}).label || '';
        $('pickedName').innerHTML = icon(state.type) + '<b>' + DG.TYPES[state.type].label + '</b> · ' + vLabel;
        $('variants').innerHTML = (DG.VARIANTS[state.type] || []).map(function (v) {
            return '<span class="pill' + (v.id === state.variant ? ' on' : '') + '" data-id="' + v.id + '">' + v.label + '</span>';
        }).join('');
        $('dataHint').textContent = '— columns: ' + DG.typeInfo(state.type, state.variant, 'columns');
        applyContext();
    }
    /* Show only the options that do something for the current chart.
     * data-for="bar line:smooth" = shown for those types / type:variant;
     * data-not="…" = hidden for those. */
    function applyContext() {
        var key = state.type, kv = state.type + ':' + state.variant;
        var hit = function (list) { return (' ' + list + ' ').indexOf(' ' + key + ' ') >= 0 || (' ' + list + ' ').indexOf(' ' + kv + ' ') >= 0; };
        [].forEach.call(document.querySelectorAll('[data-for]'), function (el) { el.style.display = hit(el.getAttribute('data-for')) ? '' : 'none'; });
        [].forEach.call(document.querySelectorAll('[data-not]'), function (el) { el.style.display = hit(el.getAttribute('data-not')) ? 'none' : ''; });
        $('liveRow').style.display = DG.isLive(state.type, state.variant) ? '' : 'none';
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
        values: 'options.values', showGrid: 'options.grid', axis: 'options.axis', endLabels: 'options.endLabels', live: 'options.live', periodSec: 'options.periodSec',
        hi: 'style.hi', hiOn: 'style.hiOn', background: 'background', fTitle: 'style.fTitle', fBody: 'style.fBody',
title: 'title', subtitle: 'subtitle', source: 'source', credit: 'credit',
        prefix: 'format.prefix', suffix: 'format.suffix', decimals: 'format.decimals', grouping: 'format.grouping',
        compact: 'format.compact', speed: 'anim.speed', stagger: 'anim.stagger', ease: 'anim.ease',
        titleAnim: 'anim.titleAnim', duration: 'duration', overshoot: 'anim.overshoot', insert: 'insert'
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
        renderTypes(); renderThemes(); renderGrid(); renderGallery(); info();
    }

    /* ------------------------------------------------ gallery (Motion Bro style) */
    var gScenes = {}, gKey = '', gPlay = null;
    function renderGallery() {
        var key = state.theme + '|' + (state.style.hiOn ? state.style.hi : '');
        if (key !== gKey) {
            gKey = key; gScenes = {};
            var html = [];
            TYPES.forEach(function (ty) {
                (DG.VARIANTS[ty.id] || []).forEach(function (v) {
                    var smp = DG.sample(ty.id, v.id);
                    var sc = DG.build(Object.assign({}, smp, { type: ty.id, variant: v.id, theme: state.theme, width: 960, height: 540, style: { hi: state.style.hiOn ? state.style.hi : '' } }));
                    var id = ty.id + ':' + v.id;
                    gScenes[id] = sc;
                    html.push('<div class="gcard" data-id="' + id + '"><div class="th">' + PV.render(sc, sc.duration) + '</div><div class="gl"><b>' + ty.label + '</b> · ' + v.label + '</div></div>');
                });
            });
            $('gallery').innerHTML = html.join('');
        }
        [].forEach.call(document.querySelectorAll('.gcard'), function (c) {
            c.classList.toggle('on', c.dataset.id === state.type + ':' + state.variant);
            c.style.display = filter === 'all' || c.dataset.id.split(':')[0] === filter ? '' : 'none';
        });
    }
    function stopThumb() {
        if (!gPlay) { return; }
        var sc = gScenes[gPlay.id];
        gPlay.el.querySelector('.th').innerHTML = PV.render(sc, sc.duration);
        gPlay = null;
    }
    $('gallery').addEventListener('mouseover', function (e) {
        var c = e.target.closest('.gcard');
        if (!c || (gPlay && gPlay.el === c)) { return; }
        stopThumb();
        gPlay = { el: c, id: c.dataset.id, t0: performance.now() };
        var me = gPlay;
        (function loop(now) {
            if (gPlay !== me) { return; }
            var sc = gScenes[me.id], t = ((now - me.t0) / 1000) % (sc.duration + 0.5);
            c.querySelector('.th').innerHTML = PV.render(sc, Math.min(t, sc.duration));
            requestAnimationFrame(loop);
        }(performance.now()));
    });
    $('gallery').addEventListener('mouseleave', stopThumb);
    $('gallery').addEventListener('click', function (e) {
        var c = e.target.closest('.gcard');
        if (!c) { return; }
        var parts = c.dataset.id.split(':'), before = DG.sample(state.type, state.variant);
        var sameType = parts[0] === state.type;
        state.type = parts[0]; state.variant = parts[1];
        var after = DG.sample(state.type, state.variant);
        /* keep the user's own data when only the style of the same type changes */
        if (!sameType || (before && state.data === before.data && before !== after)) { applySample(); }
        fillForm(); rebuild();
    });

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
        if (txt && /```|^\s*\||(^|\n)\s*\**title\s*\**\s*:/im.test(txt)) { e.preventDefault(); importAI(txt); return; }
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
        $('parseInfo').textContent = tb.rows.length + ' rows · ' + sd.series.length + ' number column' + (sd.series.length === 1 ? '' : 's');
        var probs = window.DGCheck ? DGCheck.check(state.type, state.variant, state.data) : [];
        $('checks').innerHTML = probs.length ? probs.map(function (p) { return '<li class="' + p.level + '">' + escHtml(p.text) + '</li>'; }).join('')
            : '<li class="good">Data looks good for this chart.</li>';
        var errs = probs.filter(function (p) { return p.level === 'error'; }).length;
        var tab = document.querySelector('.tabs button[data-tab="data"]');
        if (tab) { tab.classList.toggle('warn', errs > 0); }
        var f = spec().format;
        $('fmtDemo').textContent = 'Example: ' + DG.fmt(1234567.891, f) + '   ·   ' + DG.fmt(173000000, Object.assign({}, f, { ref: 173000000 }));
    }

    function escHtml(x) { return String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    function renderMeta() {
        if (!scene) { return; }
        var live = DG.isLive(state.type, state.variant) && state.options.live !== false;
        $('meta').innerHTML = '<span>' + scene.width + '×' + scene.height + '</span><span>' + state.fps + ' fps</span><span>' + scene.duration.toFixed(1) + ' s</span>' +
            '<span class="' + (live ? 'yes' : 'no') + '" title="' + (live ? 'Numbers can be changed later with sliders in After Effects' : 'Change data later with Edit chart → Apply changes') + '">' + (live ? '● Live sliders' : '○ Static data') + '</span>';
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
        var c = e.target.closest('.chip');
        if (!c) { return; }
        filter = c.dataset.id;
        renderTypes(); renderGallery();
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

    /* ---------------------------------------------------------- AI data */
    var KEY_STORE = 'docugraph.claudeKey';
    function aiPrompt() {
        var ty = TYPES.filter(function (x) { return x.id === state.type; })[0] || TYPES[0];
        var va = (DG.VARIANTS[state.type] || []).filter(function (x) { return x.id === state.variant; })[0] || { label: state.variant };
        var smp = DG.sample(state.type, state.variant);
        return DGAI.buildPrompt({
            ask: $('aiAsk').value, type: state.type, variant: state.variant, typeLabel: ty.label, variantLabel: va.label,
            example: smp ? smp.data.split('\n').slice(0, 3).join('\n') : ''
        });
    }
    function importAI(text) {
        var r = DGAI.smartParse(text);
        if (!r) { setStatus('No table found in that answer — paste the whole reply', 'err'); return false; }
        state.data = r.data;
        if (r.title) { state.title = r.title; }
        if (r.subtitle) { state.subtitle = r.subtitle; }
        if (r.source) { state.source = r.source; }
        state.dataMode = 'table';
        fillForm(); rebuild();
        setStatus('✓ Imported ' + r.rows + ' rows' + (r.source ? ' · ' + r.source : '') + (r.notes ? ' · Note: ' + r.notes : ''), 'ok');
        return true;
    }
    $('aiCopy').addEventListener('click', function () {
        if (!DG.trim($('aiAsk').value)) { setStatus('First write what data you need', 'err'); $('aiAsk').focus(); return; }
        DGAI.copy(aiPrompt()).then(function (ok) {
            setStatus(ok ? '✓ Prompt copied — paste it into ChatGPT / Claude, then paste the answer in box ②' : 'Copy blocked — select the prompt manually', ok ? 'ok' : 'err');
            if (!ok) { $('aiPaste').value = aiPrompt(); $('aiPaste').select(); }
        });
    });
    $('aiPaste').addEventListener('paste', function () { setTimeout(function () { importAI($('aiPaste').value); }, 0); });
    $('aiPaste').addEventListener('change', function () { if (DG.trim($('aiPaste').value)) { importAI($('aiPaste').value); } });
    try { var savedKey = localStorage.getItem(KEY_STORE); if (savedKey) { $('aiKey').value = savedKey; $('aiRemember').checked = true; } } catch (e) { /* storage off */ }
    $('aiRemember').addEventListener('change', function () {
        try { if ($('aiRemember').checked) { localStorage.setItem(KEY_STORE, $('aiKey').value); } else { localStorage.removeItem(KEY_STORE); } } catch (e) { /* storage off */ }
    });
    $('aiGen').addEventListener('click', function () {
        var key = DG.trim($('aiKey').value);
        if (!DG.trim($('aiAsk').value)) { setStatus('First write what data you need', 'err'); $('aiAsk').focus(); return; }
        if (!key) { setStatus('Paste your Claude API key first (console.anthropic.com)', 'err'); return; }
        try { if ($('aiRemember').checked) { localStorage.setItem(KEY_STORE, key); } } catch (e) { /* storage off */ }
        var btn = $('aiGen');
        btn.disabled = true;
        DGAI.generate(key, aiPrompt(), function (m) { setStatus(m); }).then(function (text) {
            btn.disabled = false;
            $('aiPaste').value = text;
            importAI(text);
        }, function (err) {
            btn.disabled = false;
            setStatus(DGAI.errorText(err), 'err');
        });
    });
    $('aiAsk').value = state.aiAsk || '';
    $('aiAsk').addEventListener('input', function () { state.aiAsk = $('aiAsk').value; save(); });

    var statusTimer = null;
    /* ok / info messages fade after a few seconds; errors stay until clicked */
    function setStatus(msg, cls) {
        var s = $('status');
        clearTimeout(statusTimer);
        s.textContent = msg; s.title = cls === 'err' ? 'Click to dismiss' : msg;
        s.className = 'status show' + (cls ? ' ' + cls : '');
        if (cls !== 'err') { statusTimer = setTimeout(function () { s.className = 'status' + (cls ? ' ' + cls : ''); }, cls === 'ok' ? 6000 : 9000); }
    }
    $('status').addEventListener('click', function () { $('status').className = 'status'; });

    function run(btnId, call, verb) {
        if (!Host.available) { setStatus('This works inside After Effects — open Window → Extensions → DocuGraph there', 'err'); return; }
        var btn = $(btnId);
        btn.disabled = true; setStatus(verb + '…');
        call().then(function (res) {
            btn.disabled = false;
            var p = res.split('|');
            if (p[0] === 'OK') {
                poll();
                setStatus('✓ ' + verb + ' "' + p[1] + '"' + (p[4] ? ' → added to "' + p[4] + '"' : '') + (p[5] && p[5] !== '0' ? ' · ' + p[5] + ' Essential Properties' : ''), 'ok');
            } else { setStatus(p.slice(1).join('|') || res, 'err'); }
        });
    }
    $('create').addEventListener('click', function () {
        run('create', function () { return Host.build(spec()); }, 'Created');
    });

    /* ------------------------------------------------------- edit mode */
    var NOT_AE = 'This works inside After Effects — open Window → Extensions → DocuGraph there';
    /* what counts as a change to the chart (not panel-only things like the table/text view) */
    function snap() { var c = Object.assign({}, state); delete c.dataMode; delete c.aiAsk; delete c.insert; return JSON.stringify(c); }
    function isDirty() { return !!edit.loaded && edit.loaded.base !== '' && snap() !== edit.loaded.base; }
    function parseHost(res) {
        var i = res.indexOf('|');
        return { tag: res.substring(0, i < 0 ? res.length : i), body: i < 0 ? '' : res.substring(i + 1) };
    }
    function setMode(m) {
        if (m === mode) { return; }
        if (m === 'new' && isDirty() && !window.confirm('Leave without applying your changes to “' + edit.loaded.name + '”?')) { return; }
        mode = m;
        document.body.classList.toggle('mode-edit', m === 'edit');
        [].forEach.call(document.querySelectorAll('#modes button'), function (b) { b.classList.toggle('on', b.dataset.mode === m); });
        if (m === 'edit') {
            draft = state;
            if (edit.found) { load(edit.found); }
            poll();
        } else {
            edit.loaded = null;
            edit.loading = false;
            if (draft) { state = draft; draft = null; filter = 'all'; fillForm(); rebuild(); }
        }
        renderEdit();
        sizeStage();
    }
    $('modes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { setMode(b.dataset.mode); } });

    function load(found) {
        edit.loading = true;
        Host.read(found.id).then(function (res) {
            var r = parseHost(res);
            edit.loading = false;
            if (mode !== 'edit') { return; }
            if (r.tag !== 'OK') { setStatus(r.tag === 'NONE' ? 'That chart could not be found any more' : r.body, 'err'); return; }
            try {
                var sp = JSON.parse(r.body);
                if (!sp.panel) { setStatus('“' + found.name + '” was made by an older DocuGraph — create it again to edit it here', 'err'); return; }
                state = migrate(sp.panel);
                edit.loaded = { id: found.id, name: found.name, host: found.host, base: '', applied: false };
                filter = 'all'; fillForm(); rebuild();
                edit.loaded.base = snap();
                renderEdit();
            } catch (e) { setStatus('Could not read the chart settings: ' + e.message, 'err'); }
        });
    }

    /* ask AE every 1.5 s which chart is selected / open */
    var polling = false;
    function poll() {
        if (!Host.available || polling || document.hidden) { return; }
        polling = true;
        Host.detect().then(function (res) {
            polling = false;
            var r = parseHost(res), info = {};
            try { info = JSON.parse(r.body || '{}'); } catch (e) { info = {}; }
            var found = r.tag === 'OK' ? info : null;
            edit.found = found; edit.hint = r.tag === 'ERR' ? r.body : (info.hint || '');
            $('editDot').classList.toggle('on', !!found);
            /* follow the selection — unless that would throw away unapplied edits */
            if (mode === 'edit' && found && !edit.loading && (!edit.loaded || (edit.loaded.id !== found.id && !isDirty() && !edit.busy))) { load(found); }
            if (edit.loaded && found && found.id === edit.loaded.id) { edit.loaded.name = found.name; edit.loaded.host = found.host; }
            renderEdit();
        }, function () { polling = false; });
    }
    if (Host.available) {
        setInterval(poll, 1500);
        window.addEventListener('focus', poll);
    }

    function renderEdit() {
        document.body.classList.toggle('no-chart', mode === 'edit' && !edit.loaded);
        if (mode !== 'edit') { return; }
        var esc = escHtml, L = edit.loaded, html;
        if (!Host.available) {
            html = '<div class="ec empty"><div class="big">✎</div><b>Edit a chart</b><span class="sub">' + NOT_AE + '.</span></div>';
        } else if (!L) {
            html = '<div class="ec empty"><div class="big">✎</div><b>No chart selected</b><span class="sub">' + esc(edit.hint || 'Looking for a chart…') +
                '</span><span class="sub">Click a DocuGraph chart layer in your timeline, or open its comp —<br>it opens here by itself.</span></div>';
        } else {
            var vLabel = (DG.VARIANTS[state.type].filter(function (v) { return v.id === state.variant; })[0] || {}).label || '';
            var st = edit.busy ? '<span class="st busy">Applying…</span>' : isDirty() ? '<span class="st dirty">● Changes not applied yet</span>'
                : '<span class="st clean">✓ ' + (L.applied ? 'Applied — the chart in AE is up to date' : 'Same as in After Effects') + '</span>';
            html = '<div class="ec on"><b>✎ ' + esc(L.name) + '</b><span class="sub">' + esc(DG.TYPES[state.type].label + ' · ' + vLabel) + (L.host ? ' · in “' + esc(L.host) + '”' : '') + '</span>' + st;
            var F = edit.found;
            if (F && F.id !== L.id) { html += '<div class="other">“' + esc(F.name) + '” is selected. <a id="switchTo">Edit that one</a> (your changes here are dropped)</div>'; }
            html += '</div>';
        }
        $('editCard').innerHTML = html;
        $('apply').disabled = !L || edit.busy;
        $('revert').disabled = !L || edit.busy;
    }
    $('editCard').addEventListener('click', function (e) {
        if (e.target.id === 'switchTo' && edit.found) { edit.loaded = null; load(edit.found); }
    });

    function apply(auto) {
        if (!Host.available) { setStatus(NOT_AE, 'err'); return; }
        var L = edit.loaded;
        if (!L) { setStatus('Select a chart in After Effects first', 'err'); return; }
        if (edit.busy) { edit.again = true; return; }
        edit.busy = true; renderEdit();
        var sent = snap();
        Host.update(spec(), L.id).then(function (res) {
            edit.busy = false;
            var p = res.split('|');
            if (p[0] === 'OK') {
                if (edit.loaded === L) { L.base = sent; L.applied = true; }
                if (!auto) { setStatus('✓ Applied to “' + L.name + '”', 'ok'); }
            } else { setStatus(p.slice(1).join('|') || res, 'err'); }
            renderEdit();
            if (edit.again) { edit.again = false; if (isDirty()) { apply(true); } }
        });
    }
    $('apply').addEventListener('click', function () { apply(false); });
    $('revert').addEventListener('click', function () {
        if (edit.loaded && (!isDirty() || window.confirm('Throw away your changes and reload “' + edit.loaded.name + '”?'))) { load(edit.loaded); setStatus('Reloaded from After Effects', 'ok'); }
    });
    var AUTO_STORE = 'docugraph.autoApply', autoTimer = null;
    try { $('autoApply').checked = localStorage.getItem(AUTO_STORE) === '1'; } catch (e) { /* storage off */ }
    $('autoApply').addEventListener('change', function () {
        try { localStorage.setItem(AUTO_STORE, $('autoApply').checked ? '1' : '0'); } catch (e) { /* storage off */ }
        if ($('autoApply').checked && isDirty()) { apply(true); }
    });
    /* called after every rebuild: auto-apply waits until you pause editing */
    function editChanged() {
        if (mode !== 'edit' || !edit.loaded) { return; }
        renderEdit();
        clearTimeout(autoTimer);
        if ($('autoApply').checked && isDirty()) { autoTimer = setTimeout(function () { if (isDirty()) { apply(true); } }, 1200); }
    }

    $('ver').textContent = 'v' + DG.version;
    if (Host.available) {
        Host.init().then(function (res) {
            var p = res.split('|');
            if (p[0] === 'OK') { $('conn').textContent = 'AE ' + String(p[2]).split('x')[0]; $('conn').className = 'pill on'; $('conn').title = 'Connected to After Effects ' + p[2]; } else { $('conn').textContent = 'AE error'; $('conn').className = 'pill err'; setStatus('Could not start in After Effects: ' + p.slice(1).join('|'), 'err'); }
        });
    } else {
        ['create', 'apply', 'revert'].forEach(function (id) { $(id).classList.add('off'); });
        $('conn').title = 'Open this panel inside After Effects (Window → Extensions → DocuGraph) to create charts';
    }
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (mode === 'edit') { apply(false); } else { $('create').click(); } }
    });
    $('reset').addEventListener('click', function () {
        if (!window.confirm('Reset every setting to the defaults? Your data in the panel will be replaced by the example.')) { return; }
        state = JSON.parse(JSON.stringify(DEFAULT)); filter = 'all'; applySample(); fillForm(); rebuild();
        setStatus('Settings reset', 'ok');
    });
    fillForm();
    rebuild();
}());
