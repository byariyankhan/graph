/* Loads the ES3 shared engine + preview renderer into one sandbox (like CEP does). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT = path.join(__dirname, '..', 'extension');
const SHARED = (() => {
    const sb = {}; vm.createContext(sb);
    vm.runInContext(fs.readFileSync(path.join(EXT, 'shared/manifest.js'), 'utf8'), sb);
    return Array.from(sb.DG.FILES);
})();

function load(extra) {
    const sandbox = { console, globalThis: null };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const f of SHARED.concat(extra || [])) {
        vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), sandbox, { filename: f });
    }
    return sandbox;
}

module.exports = { load, EXT, SHARED };
