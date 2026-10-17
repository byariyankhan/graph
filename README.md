# DocuGraph — animated charts for After Effects

A CEP panel for Adobe After Effects that builds **documentary-grade animated charts** as
**native, editable layers**. You paste data (or let AI fetch it), pick a style, and click once.

Plan, roadmap and chart catalogue: **[PLAN.md](PLAN.md)**

![Every style, Documentary Dark](docs/img/sheet-docDark-end-1920x1080.jpg)

## What's in v0.2

**11 chart types / 39 styles.** Every style works with all **10 themes** and with HD, 4K, 9:16 Shorts, 1:1 and 4:5 output.

| Type | Styles | Data columns | Live sliders in AE |
|---|---|---|---|
| Bar | Column · Horizontal (ranking) · Grouped · Stacked · 100% Stacked · Lollipop | label, value[, value…] | column, horizontal, grouped |
| Line | Line · Smooth curve · Stepped · Area · Stacked area | year, series… | line, smooth, stepped, area |
| Pie / Donut | Donut · Pie · Half donut · Progress rings · Rose | label, value | all but Rose |
| Big number | Single · Compare (A vs B) · Stat cards | label, value[, start value] | all |
| Timeline | Horizontal · Vertical · Eras / spans | date, title[, note] (eras: start, end, label) | — |
| Bar race | Horizontal · Column | year, entity 1, entity 2, … (or entities × years) | — |
| Bubble | Bubble · Scatter · Moving bubbles (Gapminder) | label, x, y, size[, group] | — |
| Waffle / icons | Waffle 10×10 · People icons · Proportional circles | label, value | — |
| Compare | Slope · Dumbbell · Waterfall · Gains & losses | label, then, now | — |
| Gauge | Speedometer · Thermometer · Progress bars | label, value[, max][, target] | — |
| Pyramid | Population pyramid · Butterfly | group, left, right | — |

Numbers can use currency symbols, `%`, thousands separators or `K/M/B/T` suffixes.

### The panel: five numbered steps

![Panel](docs/img/panel.png)

1. **Chart:** filter by type, then click an animated thumbnail (hover to play).
2. **Data:**
   - Get the data from AI:
     - Copy the prompt into ChatGPT, Claude or Gemini and paste the whole reply back.
     - Or click **Generate with Claude** if you have your own API key; it searches the web for sourced figures.
   - You can also type into the table, or paste from Excel.
   - A **check list** spots problems before you build, such as "Row 3 (India), “2020”: “abc” is not a number", repeated names, or missing columns.
   - Only the options that apply to the chosen chart are shown.
3. **Text:**
   - Title, subtitle, source and credit.
   - Number format: before/after text, decimals, short form (K/M/B or "million"), and a live example.
4. **Look:** theme, highlight colour, background, size, fps and fonts.
5. **Motion:** speed, length, easing, title animation, stagger and overshoot.

Click **Create chart** or press Ctrl+Enter.
- By default the chart drops into the open comp at the playhead, as a precomp.
- A banner at the top shows whether it worked.
- The pill in the header shows whether the panel is connected to After Effects.

### In After Effects

- Charts are built from shape layers and text layers, with plain keyframes and matching easing.
- Everything is parented to a `DG Controller` null.
- **Essential Properties** on the chart layer (Motion Bro style):
  - title / subtitle / source text
  - every colour (one Color Control per theme role)
  - the data values
  - chart scale and position
- **Live data:** with a supported style, changing a value slider redraws bars, slices, lines, labels and the axis.
- **Re-edit (Edit chart mode):**
  1. Switch the panel to **✎ Edit chart**. It finds the chart by itself: the open chart comp, the selected chart layer, or the only chart in the open comp. A green dot on the button means a chart was found.
  2. Change anything, then click **Apply changes**. If you tick **Apply automatically**, AE updates a moment after you stop editing.
  - **Revert** reloads the chart from AE. Your new-chart draft waits for you in **＋ New chart**.
  - The comp keeps its name and position, and any layers you added yourself are kept.

## Install (developer mode)

1. Run `install/install-windows.bat` on Windows or `install/install-mac.sh` on macOS.
   - It copies `extension/` into the CEP extensions folder.
   - It enables unsigned extensions.
2. Restart After Effects and open **Window → Extensions → DocuGraph**.

To update, download the new ZIP, run the installer again, and restart AE.

To try the UI without AE, open `extension/client/index.html` in a browser. The preview works there, and Create is disabled.

## Development

```
npm test        # ES3 lint, engine (780 builds), mock After Effects, AI helper, data checks, bad-data fuzz
npm run sheet   # contact sheet of every style → docs/img
```

Layout:

- `extension/shared/` holds the chart engine. After Effects runs the same files, so they must stay **ES3**; `tests/es3-lint.js` enforces this.
- `shared/manifest.js` lists the engine files once. The panel, the AE host and the tests all load from it.
- Each `shared/charts/<type>.js` file holds the layout and its registry entry (`DG.VARIANTS.<type>` and `DG.TYPES.<type>`).
  - The registry entry holds the label, icon, data columns, AI prompt hint and live styles.

To add a chart type:
1. Add `shared/charts/<type>.js` and list it in `shared/manifest.js`.
2. Add a sample in `shared/samples.js`.

Both renderers, the gallery and the AI prompt pick it up automatically.
