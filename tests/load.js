/* Loads the ES3 shared engine + preview renderer into one sandbox (like CEP does). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EXT = path.join(__dirname, '..', 'extension');
const SHARED = [
    'shared/core.js', 'shared/themes.js', 'shared/build.js',
    'shared/charts/bar.js', 'shared/charts/line.js', 'shared/charts/pie.js',
    'shared/charts/counter.js', 'shared/charts/timeline.js', 'shared/charts/pyramid.js',
    'shared/charts/race.js', 'shared/charts/scatter.js', 'shared/charts/waffle.js',
    'shared/samples.js'
];

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
