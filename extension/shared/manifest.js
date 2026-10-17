/*
 * DocuGraph — the one list of engine files, in load order.
 * Used by the panel (index.html), After Effects (host/main.jsx) and tests.
 * To add a chart type: create shared/charts/<type>.js (with its DG.VARIANTS
 * and DG.TYPES entry) and add it here — nothing else needs to change.
 */
var DG = (typeof DG !== 'undefined') ? DG : {};
DG.FILES = [
    'shared/core.js', 'shared/themes.js', 'shared/build.js',
    'shared/charts/bar.js', 'shared/charts/line.js', 'shared/charts/pie.js', 'shared/charts/counter.js',
    'shared/charts/timeline.js', 'shared/charts/race.js', 'shared/charts/scatter.js', 'shared/charts/waffle.js',
    'shared/charts/compare.js', 'shared/charts/gauge.js', 'shared/charts/pyramid.js',
    'shared/samples.js'
];
