/* Thin bridge to After Effects (no CSInterface.js dependency).
 * Outside AE (plain browser) `available` is false and the panel runs in
 * preview-only mode. */
(function (root) {
    var cep = root.__adobe_cep__;
    var Host = { available: !!cep };

    Host.eval = function (script) {
        return new Promise(function (resolve) {
            if (!cep) { resolve('ERR|Not running inside After Effects'); return; }
            cep.evalScript(script, function (res) { resolve(res === undefined ? '' : String(res)); });
        });
    };

    /* Extension folder on disk, as a plain path ExtendScript can open. */
    Host.extensionPath = function () {
        if (!cep) { return ''; }
        var p = decodeURI(cep.getSystemPath('extension'));
        if (/^file:\/\/\/[A-Za-z]:/.test(p)) { return p.replace('file:///', ''); }
        return p.replace(/^file:\/\//, '');
    };

    /* JS string literal safe for evalScript: JSON-escaped + non-ASCII as \uXXXX
     * (CEP can mangle raw Unicode on its way into ExtendScript). */
    Host.lit = function (s) {
        return JSON.stringify(String(s)).replace(/[\u007f-￿]/g, function (c) {
            return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
        });
    };

    Host.init = function () { return Host.eval('DGHost.init(' + Host.lit(Host.extensionPath()) + ')'); };
    Host.build = function (spec) { return Host.eval('DGHost.build(' + Host.lit(JSON.stringify(spec)) + ')'); };
    Host.update = function (spec) { return Host.eval('DGHost.update(' + Host.lit(JSON.stringify(spec)) + ')'); };
    Host.readActive = function () { return Host.eval('DGHost.readActive()'); };

    root.DGHostBridge = Host;
}(window));
