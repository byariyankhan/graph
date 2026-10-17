/*
 * DocuGraph — data check. Looks at the pasted table for the chosen chart and
 * returns plain-language problems ("Row 3: 'abc' is not a number") so the
 * user can fix the data before the chart silently drops something.
 */
(function (root) {
    var DG = root.DG;

    /* What each chart needs: minimum columns / rows and which columns hold numbers. */
    function rules(type, variant) {
        switch (type) {
            case 'timeline': return variant === 'eras' ? { cols: 3, rows: 1, num: [0, 1] } : { cols: 2, rows: 1, num: [] };
            case 'scatter':
                if (variant === 'gapminder') { return { cols: 5, rows: 2, num: [1, 2, 3, 4] }; }
                return variant === 'scatter' ? { cols: 3, rows: 2, num: [1, 2] } : { cols: 4, rows: 2, num: [1, 2, 3] };
            case 'gauge': return { cols: 2, rows: 1, num: [1, 2, 3] };
            case 'counter': return { cols: 2, rows: 1, num: [1, 2] };
            case 'pyramid': return { cols: 3, rows: 2, num: null };
            case 'compare': return (variant === 'slope' || variant === 'dumbbell') ? { cols: 3, rows: 1, num: null } : { cols: 2, rows: 2, num: null };
            case 'line': return { cols: 2, rows: 2, num: null };
            case 'race': return { cols: 3, rows: 2, num: null };
            default: return { cols: 2, rows: 1, num: null };
        }
    }

    /* Returns [{level: 'error'|'warn'|'info', text}] — empty when all is well. */
    function check(type, variant, text) {
        var out = [], tb = DG.parseTable(text), rows = tb.rows, r = rules(type, variant), i, j;
        var add = function (level, t) { out.push({ level: level, text: t }); };
        if (!rows.length) { add('error', 'No data yet — paste a table or use “Get data from AI”.'); return out; }
        var width = tb.headers.length;
        if (width < r.cols) { add('error', 'This chart needs at least ' + r.cols + ' columns: ' + DG.typeInfo(type, variant, 'columns') + '.'); }
        if (rows.length < r.rows) { add('error', 'This chart needs at least ' + r.rows + ' data rows.'); }
        var numCols = r.num;
        if (!numCols) { numCols = []; for (j = 1; j < width; j++) { numCols.push(j); } }
        if (type === 'race' && DG.transposeIfWide(tb) !== tb) { numCols = []; } /* entities × years: checked after flipping */
        var bad = 0, shown = 0, neg = 0, labels = {}, dups = [];
        for (i = 0; i < rows.length; i++) {
            for (var k = 0; k < numCols.length; k++) {
                j = numCols[k];
                if (j >= width) { continue; }
                var cell = rows[i][j];
                if (cell === '' || cell === undefined) { continue; }
                var v = DG.num(cell);
                if (isNaN(v)) {
                    bad++;
                    if (shown < 3) { add('warn', 'Row ' + (i + 1) + ' (' + (rows[i][0] || '?') + '), “' + (tb.headers[j] || 'column ' + (j + 1)) + '”: “' + cell + '” is not a number.'); shown++; }
                } else if (v < 0) { neg++; }
            }
            var lab = DG.norm(rows[i][0]);
            if (lab && type !== 'scatter' && type !== 'timeline') {
                if (labels[lab]) { dups.push(rows[i][0]); }
                labels[lab] = true;
            }
        }
        if (bad > shown) { add('warn', (bad - shown) + ' more cells are not numbers.'); }
        if (neg && (type === 'pie' || type === 'waffle')) { add('warn', 'Negative values are left out of a ' + DG.TYPES[type].label.toLowerCase() + ' chart.'); }
        if (neg && DG.isLive(type, variant)) { add('info', 'Live sliders are switched off for this chart because it has negative values.'); }
        if (dups.length) { add('warn', 'Repeated name' + (dups.length > 1 ? 's' : '') + ': ' + dups.slice(0, 3).join(', ') + ' — each row should have its own label.'); }
        if (type === 'pie' && rows.length > 10) { add('info', 'Only the 9 biggest slices are shown; the rest become “Others”.'); }
        return out;
    }

    root.DGCheck = { check: check, rules: rules };
    if (typeof module !== 'undefined' && module.exports) { module.exports = root.DGCheck; }
}(typeof window !== 'undefined' ? window : globalThis));
