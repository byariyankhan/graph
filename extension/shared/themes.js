/*
 * DocuGraph — style themes. Every chart type × every variant works with
 * every theme. Fonts carry both the After Effects PostScript name (`ae`) and
 * a CSS family for the panel preview (`css`). Bengali text automatically
 * switches to the `bnBold` / `bnBody` fonts (needs a Bangla font installed —
 * e.g. Nirmala UI on Windows, or Hind Siliguri / Noto Sans Bengali).
 */
var DG = (typeof DG !== 'undefined') ? DG : {};

(function () {
    var SANS = 'Arial, Helvetica, sans-serif';
    var SERIF = 'Georgia, "Times New Roman", serif';
    var MONO = '"Courier New", Courier, monospace';
    var BN = '"Hind Siliguri", "Noto Sans Bengali", "Nirmala UI", "Vrinda", sans-serif';

    function f(ae, css, w) { return { ae: ae, css: css, w: w || 400 }; }
    var arial = {
        title: f('Arial-BoldMT', SANS, 700), body: f('ArialMT', SANS, 400), num: f('Arial-BoldMT', SANS, 700),
        bnBold: f('NirmalaUI-Bold', BN, 700), bnBody: f('NirmalaUI', BN, 400)
    };
    function fonts(over) { return DG.extend({}, arial, over || {}); }

    /* Shared defaults; each theme overrides what it needs. */
    var BASE = {
        bg: '#111418', bg2: null, text: '#F2EEE6', muted: '#8A9099', grid: '#2A2F36', axis: '#5A616B',
        accent: '#E8B04B', hi: '#E8B04B', dim: '#3A4049', card: '#1B2027', onColor: '#FFFFFF',
        palette: ['#E8B04B', '#4FA3D9', '#E5654B', '#7CC08A', '#B48CD9', '#F08FB3', '#63C7C0', '#C9C2B0'],
        up: '#3DAA6E', down: '#E0533D',
        radius: 6, lineW: 6, gridW: 2, gridDash: null, titleSize: 62, upper: false, track: 0,
        titleMark: 'line', glow: false, fonts: fonts()
    };

    DG.THEMES = {
        docDark: DG.extend({}, BASE, {
            label: 'Documentary Dark', bg: '#111418', bg2: '#1C222A'
        }),
        cleanLight: DG.extend({}, BASE, {
            label: 'Clean Editorial', bg: '#FFFFFF', text: '#161616', muted: '#6B6B6B', grid: '#E5E5E5', axis: '#9A9A9A',
            accent: '#D7261E', hi: '#D7261E', dim: '#C9CED6', card: '#F3F4F6', titleMark: 'bar',
            palette: ['#1F5FA8', '#D7261E', '#2BA37A', '#F2A900', '#7A4FB5', '#00A3C4', '#B85C38', '#6E7781'], radius: 2
        }),
        vintage: DG.extend({}, BASE, {
            label: 'Vintage Archive', bg: '#EFE4CC', bg2: '#F7EFDC', text: '#3B2F22', muted: '#7D6A52', grid: '#D6C6A5', axis: '#9C8763',
            accent: '#9E2B25', hi: '#9E2B25', dim: '#CDBB98', card: '#E6D7B8', radius: 0, gridDash: [6, 6], up: '#4E6B3A', down: '#9E2B25',
            palette: ['#9E2B25', '#2F4F6F', '#B07D2B', '#4E6B3A', '#6B3F5E', '#8A5A3C', '#5B7C8D', '#A3884F'],
            fonts: fonts({ title: f('Georgia-Bold', SERIF, 700), body: f('Georgia', SERIF, 400), num: f('Georgia-Bold', SERIF, 700) })
        }),
        newsroom: DG.extend({}, BASE, {
            label: 'Newsroom Red', bg: '#0B0B0D', text: '#FFFFFF', muted: '#9A9AA0', grid: '#232327', axis: '#55555C',
            accent: '#E10600', hi: '#E10600', dim: '#3B3B42', card: '#17171B', upper: true, track: 20, titleMark: 'bar',
            palette: ['#E10600', '#F2F2F2', '#8C8C94', '#FF7A59', '#5B5B63', '#C9C9CF', '#B00500', '#3F3F46'], radius: 0
        }),
        neon: DG.extend({}, BASE, {
            label: 'Neon Tech', bg: '#07081A', bg2: '#141A45', text: '#E8F1FF', muted: '#7D88B8', grid: '#1B2150', axis: '#3B4690',
            accent: '#00F0FF', hi: '#00F0FF', dim: '#232A5C', card: '#0F1433', glow: true, radius: 3, up: '#B6FF00', down: '#FF2BD6',
            palette: ['#00F0FF', '#FF2BD6', '#B6FF00', '#FFB800', '#7A5CFF', '#00FF9C', '#FF5C5C', '#5CC8FF']
        }),
        blueprint: DG.extend({}, BASE, {
            label: 'Blueprint', bg: '#0E3A66', bg2: '#165087', text: '#FFFFFF', muted: '#A9C4E2', grid: '#3E6A96', axis: '#7FA6CF',
            accent: '#FFD34D', hi: '#FFD34D', dim: '#2D5C8C', card: '#124677', gridDash: [4, 8], radius: 0, titleMark: null,
            palette: ['#FFFFFF', '#FFD34D', '#7FD1FF', '#FF8A65', '#B9F6CA', '#E1BEE7', '#90CAF9', '#FFE082'],
            fonts: fonts({ title: f('CourierNewPS-BoldMT', MONO, 700), body: f('CourierNewPSMT', MONO, 400), num: f('CourierNewPS-BoldMT', MONO, 700) })
        }),
        mono: DG.extend({}, BASE, {
            label: 'Minimal Mono', bg: '#F7F7F5', text: '#111111', muted: '#8A8A8A', grid: '#E2E2DE', axis: '#B5B5B0',
            accent: '#FF4F00', hi: '#FF4F00', dim: '#CFCFCB', card: '#EDEDEA', radius: 0, titleMark: null, up: '#111111', down: '#FF4F00',
            palette: ['#111111', '#555555', '#8A8A8A', '#B5B5B5', '#333333', '#777777', '#A0A0A0', '#CCCCCC']
        }),
        pop: DG.extend({}, BASE, {
            label: 'Bold Explainer', bg: '#FFD43B', text: '#111111', muted: '#5C4A00', grid: '#E9BE1F', axis: '#8C6F00',
            accent: '#FF3B30', hi: '#FF3B30', dim: '#E3B820', card: '#FFE275', onColor: '#FFFFFF', radius: 14, upper: true, titleSize: 70,
            palette: ['#111111', '#FF3B30', '#1E88E5', '#00B894', '#8E44AD', '#FF8A00', '#00ACC1', '#6D4C41'],
            fonts: fonts({ title: f('Arial-Black', SANS, 900), num: f('Arial-Black', SANS, 900) })
        }),
        earth: DG.extend({}, BASE, {
            label: 'Geo Earth', bg: '#0F1F1A', bg2: '#183229', text: '#EAF2E3', muted: '#8FA89A', grid: '#22392F', axis: '#4D6B5C',
            accent: '#7BC67E', hi: '#F2C14E', dim: '#2E4A3E', card: '#16291F',
            palette: ['#7BC67E', '#3FA7D6', '#F2C14E', '#E07A5F', '#81B29A', '#A3D5FF', '#C9A66B', '#D4E09B']
        }),
        cinematic: DG.extend({}, BASE, {
            label: 'Cinematic Gold', bg: '#050505', bg2: '#1A1610', text: '#F5E6C8', muted: '#9C8C70', grid: '#221D15', axis: '#4A3F2D',
            accent: '#D4AF37', hi: '#D4AF37', dim: '#3A3226', card: '#14110C', track: 40, upper: true, radius: 0,
            palette: ['#D4AF37', '#E8D8B0', '#A67C52', '#8C6D46', '#F2D98D', '#5E4B3C', '#C9A227', '#7A6A55'],
            fonts: fonts({ title: f('Georgia-Bold', SERIF, 700) })
        })
    };
    DG.THEME_ORDER = ['docDark', 'cleanLight', 'vintage', 'newsroom', 'neon', 'blueprint', 'mono', 'pop', 'earth', 'cinematic'];

    /* Theme + user overrides (style.accent, style.palette, style.fonts...). */
    DG.theme = function (id, ov) {
        var base = DG.THEMES[id] || DG.THEMES.docDark, t = DG.extend({}, base), k;
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
