/*
 * DocuGraph — ExtendScript entry point (loaded by the CEP manifest).
 * The panel calls DGHost.init(extensionPath) once, then DGHost.build(json).
 */
var DGHost = (typeof DGHost !== 'undefined') ? DGHost : {};

DGHost.FILES = [
    'shared/core.js', 'shared/themes.js', 'shared/build.js',
    'shared/charts/bar.js', 'shared/charts/line.js', 'shared/charts/pie.js',
    'shared/charts/counter.js', 'shared/charts/timeline.js', 'shared/charts/pyramid.js',
    'shared/charts/race.js', 'shared/charts/scatter.js', 'shared/charts/waffle.js', 'shared/charts/compare.js',
    'shared/samples.js', 'host/render.jsx'
];

DGHost.init = function (extPath) {
    try {
        var rootPath = extPath;
        if (!rootPath) { rootPath = File($.fileName).parent.parent.fsName; }
        for (var i = 0; i < DGHost.FILES.length; i++) {
            var f = new File(rootPath + '/' + DGHost.FILES[i]);
            if (!f.exists) { return 'ERR|Missing file: ' + f.fsName; }
            $.evalFile(f);
        }
        /* $.evalFile runs files in THIS function's scope, so the engine
         * objects would vanish after init returns. Publish them globally. */
        $.global.DG = DG;
        $.global.DGAE = DGAE;
        DGHost.ready = true;
        return 'OK|' + DG.version + '|' + app.version;
    } catch (e) {
        return 'ERR|' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '');
    }
};

/* The DocuGraph comp to edit: the open comp itself, or the comp behind the
 * selected layer (when the chart sits as a precomp inside your edit). */
DGHost.isDG = function (c) { return c && (c instanceof CompItem) && String(c.comment).indexOf('DocuGraph') === 0; };
DGHost.target = function () {
    var c = app.project.activeItem;
    if (DGHost.isDG(c)) { return c; }
    if (c && (c instanceof CompItem)) {
        var sel = c.selectedLayers;
        for (var i = 0; i < sel.length; i++) { if (sel[i].source && DGHost.isDG(sel[i].source)) { return sel[i].source; } }
    }
    return null;
};

DGHost.build = function (specJson) {
    try {
        if (!DGHost.ready) { var r = DGHost.init(); if (r.indexOf('OK') !== 0) { return r; } }
        var spec = DG.parseJSON(specJson);
        var scene = DG.build(spec);
        var host = app.project.activeItem;
        if (!spec.insert || !host || !(host instanceof CompItem) || DGHost.isDG(host)) { host = null; }
        return DGAE.render(scene, specJson, null, host);
    } catch (e) {
        return 'ERR|' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '');
    }
};

/* Re-build the chart inside the active DocuGraph comp (keeps the comp, its
 * name and its uses in other comps; the user's own extra layers survive). */
DGHost.update = function (specJson) {
    try {
        if (!DGHost.ready) { var r = DGHost.init(); if (r.indexOf('OK') !== 0) { return r; } }
        var c = DGHost.target();
        if (!c) { return 'ERR|Open a DocuGraph comp, or select its layer in your comp'; }
        return DGAE.render(DG.build(DG.parseJSON(specJson)), specJson, c);
    } catch (e) {
        return 'ERR|' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '');
    }
};

/* Read the spec back from a DocuGraph comp (to re-edit a chart). */
DGHost.readActive = function () {
    try {
        var c = DGHost.target();
        if (!c) { return 'NONE|'; }
        var body = String(c.comment).substring(String(c.comment).indexOf('\n') + 1), out = '', i, ch, h;
        /* escape non-ASCII so Bangla survives the trip back to the panel */
        for (i = 0; i < body.length; i++) {
            ch = body.charCodeAt(i);
            if (ch > 126) { h = ch.toString(16); while (h.length < 4) { h = '0' + h; } out += '\\u' + h; } else { out += body.charAt(i); }
        }
        return 'OK|' + out;
    } catch (e) {
        return 'ERR|' + e.toString();
    }
};
