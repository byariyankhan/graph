/*
 * DocuGraph — ExtendScript entry point (loaded by the CEP manifest).
 * The panel calls DGHost.init(extensionPath) once, then DGHost.build(json).
 */
var DGHost = (typeof DGHost !== 'undefined') ? DGHost : {};


DGHost.init = function (extPath) {
    try {
        var rootPath = extPath;
        if (!rootPath) { rootPath = File($.fileName).parent.parent.fsName; }
        var man = new File(rootPath + '/shared/manifest.js');
        if (!man.exists) { return 'ERR|Missing file: ' + man.fsName; }
        $.evalFile(man);
        var files = DG.FILES.concat(['host/render.jsx']);
        for (var i = 0; i < files.length; i++) {
            var f = new File(rootPath + '/' + files[i]);
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

/* A DocuGraph comp by its project id (null when it was deleted). */
DGHost.byId = function (id) {
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it && it.id === id) { return DGHost.isDG(it) ? it : null; }
    }
    return null;
};

/* Plain ASCII so text survives the trip back to the panel (é, —, ° → \uXXXX). */
DGHost.ascii = function (s) {
    var out = '', i, ch, h;
    for (i = 0; i < s.length; i++) {
        ch = s.charCodeAt(i);
        if (ch > 126) { h = ch.toString(16); while (h.length < 4) { h = '0' + h; } out += '\\u' + h; } else { out += s.charAt(i); }
    }
    return out;
};

/* Edit mode polls this: which chart would the user mean right now?
 * The open chart comp, the selected chart layer, or the only chart in the
 * open comp. Cheap — the spec itself is fetched with DGHost.read(id). */
DGHost.detect = function () {
    try {
        if (!DGHost.ready) { var r = DGHost.init(); if (r.indexOf('OK') !== 0) { return r; } }
        var c = app.project.activeItem, i, found = [], seen = {};
        if (!c || !(c instanceof CompItem)) { return 'NONE|' + DGHost.ascii(DG.toJSON({ hint: 'Open the comp that has your chart' })); }
        var hit = function (chart, host) { return 'OK|' + DGHost.ascii(DG.toJSON({ id: chart.id, name: chart.name, host: host ? host.name : '' })); };
        if (DGHost.isDG(c)) { return hit(c, null); }
        var sel = c.selectedLayers;
        for (i = 0; i < sel.length; i++) { if (sel[i].source && DGHost.isDG(sel[i].source)) { return hit(sel[i].source, c); } }
        for (i = 1; i <= c.numLayers; i++) {
            var src = c.layer(i).source;
            if (src && DGHost.isDG(src) && !seen[src.id]) { seen[src.id] = true; found.push(src); }
        }
        if (found.length === 1) { return hit(found[0], c); }
        return 'NONE|' + DGHost.ascii(DG.toJSON({
            hint: found.length ? found.length + ' charts in "' + c.name + '" - select the one to edit' : 'No DocuGraph chart in "' + c.name + '"',
            many: found.length
        }));
    } catch (e) {
        return 'ERR|' + e.toString();
    }
};

/* Re-build the chart inside a DocuGraph comp — the one with this id, or the
 * active one (keeps the comp, its name and its uses in other comps; the
 * user's own extra layers survive). */
DGHost.update = function (specJson, id) {
    try {
        if (!DGHost.ready) { var r = DGHost.init(); if (r.indexOf('OK') !== 0) { return r; } }
        var c = id ? DGHost.byId(id) : DGHost.target();
        if (!c) { return 'ERR|' + (id ? 'That chart is gone - was its comp deleted?' : 'Open a DocuGraph comp, or select its layer in your comp'); }
        return DGAE.render(DG.build(DG.parseJSON(specJson)), specJson, c);
    } catch (e) {
        return 'ERR|' + e.toString() + (e.line ? ' (line ' + e.line + ')' : '');
    }
};

/* Read the spec back from a DocuGraph comp (to re-edit a chart). */
DGHost.read = function (id) {
    try {
        var c = id ? DGHost.byId(id) : DGHost.target();
        if (!c) { return 'NONE|'; }
        var body = String(c.comment);
        return 'OK|' + DGHost.ascii(body.substring(body.indexOf('\n') + 1));
    } catch (e) {
        return 'ERR|' + e.toString();
    }
};
DGHost.readActive = function () { return DGHost.read(); };
