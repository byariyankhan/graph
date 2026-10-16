/*
 * DocuGraph — ExtendScript entry point (loaded by the CEP manifest).
 * The panel calls DGHost.init(extensionPath) once, then DGHost.build(json).
 */
var DGHost = (typeof DGHost !== 'undefined') ? DGHost : {};

DGHost.FILES = [
    'shared/core.js', 'shared/themes.js', 'shared/build.js',
    'shared/charts/bar.js', 'shared/charts/line.js', 'shared/charts/pie.js',
    'shared/charts/counter.js', 'shared/charts/timeline.js', 'shared/charts/pyramid.js',
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

DGHost.build = function (specJson) {
    try {
        if (!DGHost.ready) { var r = DGHost.init(); if (r.indexOf('OK') !== 0) { return r; } }
        var spec = DG.parseJSON(specJson);
        var scene = DG.build(spec);
        return DGAE.render(scene, specJson);
    } catch (e) {
        return 'ERR|' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '');
    }
};

/* Read the spec back from a DocuGraph comp (to re-edit a chart). */
DGHost.readActive = function () {
    try {
        var c = app.project.activeItem;
        if (!c || !(c instanceof CompItem) || String(c.comment).indexOf('DocuGraph') !== 0) { return 'NONE|'; }
        return 'OK|' + String(c.comment).substring(String(c.comment).indexOf('\n') + 1);
    } catch (e) {
        return 'ERR|' + e.toString();
    }
};
