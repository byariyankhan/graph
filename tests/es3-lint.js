/* ExtendScript is ES3: parse shared + host code as ES3 and ban ES5+ library calls. */
const fs = require('fs');
const path = require('path');
const { EXT, SHARED } = require('./load');

let acorn;
for (const p of ['acorn', '/opt/node22/lib/node_modules/eslint/node_modules/acorn', '/opt/node-tools/node_modules/acorn']) {
    try { acorn = require(p); break; } catch (e) { /* next */ }
}
const files = ['shared/manifest.js'].concat(SHARED, ['host/main.jsx', 'host/render.jsx']);
const BANNED = [/\.forEach\(/, /\.map\(/, /\.filter\(/, /\.reduce\(/, /\.some\(/, /\.every\(/, /Object\.keys/, /Array\.isArray/,
    /JSON\.(parse|stringify)/, /\.trim\(\)/, /Date\.now/, /\.bind\(/, /\bconst\b/, /\blet\b/, /=>/, /`/];
let bad = 0;
for (const f of files) {
    const src = fs.readFileSync(path.join(EXT, f), 'utf8');
    if (acorn) {
        try { acorn.parse(src, { ecmaVersion: 3, allowReserved: false }); } catch (e) { bad++; console.error(`${f}: not ES3: ${e.message}`); }
    }
    src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\*|\*)/.test(line)) { return; }
        const code = line.replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'/g, "''");
        for (const re of BANNED) { if (re.test(code)) { bad++; console.error(`${f}:${i + 1}: ES3-unsafe ${re}: ${line.trim()}`); } }
    });
    // Array.prototype.indexOf is not in ExtendScript — only allow indexOf on obvious strings
    src.split('\n').forEach((line, i) => {
        if (/\b(arr|list|items|pts|vals|times|keys)\.indexOf\(/.test(line)) { bad++; console.error(`${f}:${i + 1}: Array.indexOf`); }
    });
}
console.log(acorn ? 'ES3 parse + lint' : 'lint only (acorn not found)', bad ? `— ${bad} problem(s)` : '— clean');
if (bad) { process.exitCode = 1; }
