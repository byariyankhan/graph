/*
 * DocuGraph — the brand look. One theme: yellow highlights, dark charcoal
 * background, white text. Old charts that name another theme get this one.
 * Fonts carry both the After Effects PostScript name (`ae`) and a CSS
 * family for the panel preview (`css`).
 */
var DG = (typeof DG !== 'undefined') ? DG : {};

(function () {
    var SANS = 'Arial, Helvetica, sans-serif';
    function f(ae, css, w) { return { ae: ae, css: css, w: w || 400 }; }

    DG.BRAND = { yellow: '#FFED54', charcoal: '#232322', white: '#FFFFFF' };

    DG.THEMES = {
        brand: {
            label: 'Brand', bg: DG.BRAND.charcoal, bg2: '#2E2E2C', text: DG.BRAND.white, muted: '#A9A8A1',
            grid: '#383836', axis: '#686760', accent: DG.BRAND.yellow, hi: DG.BRAND.yellow, dim: '#4A4A46', card: '#2C2C2A',
            /* yellow first, then hues checked for colour-blind separation on the charcoal */
            palette: ['#FFED54', '#D55181', '#3987E5', '#D95926', '#199E70', '#9085E9', '#E66767', '#8A8A85'],
            up: '#2FB67C', down: '#E66767',
            radius: 6, lineW: 6, gridW: 2, gridDash: null, titleSize: 62, upper: false, track: 0,
            titleMark: 'line', glow: false,
            fonts: { title: f('Arial-BoldMT', SANS, 700), body: f('ArialMT', SANS, 400), num: f('Arial-BoldMT', SANS, 700) }
        }
    };
    DG.THEME_ORDER = ['brand'];

    /* The brand theme + optional overrides (style.hi, style.fonts...). */
    DG.theme = function (id, ov) {
        var base = DG.THEMES.brand, t = DG.extend({}, base), k;
        t.fonts = DG.extend({}, base.fonts);
        if (ov) {
            var keys = ['bg', 'text', 'accent', 'hi', 'radius', 'lineW', 'upper'];
            for (k = 0; k < keys.length; k++) {
                if (ov[keys[k]] !== undefined && ov[keys[k]] !== null && ov[keys[k]] !== '') { t[keys[k]] = ov[keys[k]]; }
            }
            if (ov.bg) { t.bg2 = null; }
            if (ov.palette && ov.palette.length) { t.palette = ov.palette; }
            if (ov.fonts) {
                for (k in ov.fonts) {
                    if (ov.fonts.hasOwnProperty(k) && ov.fonts[k]) {
                        t.fonts[k] = { ae: ov.fonts[k], css: '"' + ov.fonts[k] + '", ' + (t.fonts[k] ? t.fonts[k].css : SANS), w: t.fonts[k] ? t.fonts[k].w : 400 };
                    }
                }
            }
        }
        return t;
    };
}());
