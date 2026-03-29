# Carnegie 2025 College Dashboard

Explore institutions using the 2025 Carnegie Classification. Data: Carnegie 2025, IPEDS 2023–24, College Scorecard.

<a href="/compare">→ Compare categories</a> | <a href="/twins">→ Find school twins</a>

```js
import { collegeCard } from "./components/collegeCard.js";
const institutions = FileAttachment("data/institutions.csv").csv({typed: true});
const programs = FileAttachment("data/programs.csv").csv({typed: true});
```

```js
// Build CIP lookup
const cipLabels = [...new Set(programs.map(d => d.cip_label))].sort();
const institutionCips = new Map();
for (const p of programs) {
  if (!institutionCips.has(p.UNITID)) institutionCips.set(p.UNITID, new Set());
  institutionCips.get(p.UNITID).add(p.cip_label);
}
const allStates = [...new Set(institutions.map(d => d.STABBR))].sort();
const allSaec = [...new Set(institutions.map(d => d.saec2025name).filter(Boolean))].sort();
const allSettings = [...new Set(institutions.map(d => d.setting2025name).filter(Boolean))].sort();
```

<div style="display: grid; grid-template-columns: 280px 1fr; gap: 1.5rem;">
<div>

## Filters

```js
const resetBtn = view(Inputs.button("Clear all filters", {reduce: () => {
  const sidebar = document.querySelector("div[style*='grid-template-columns']")?.firstElementChild;
  if (!sidebar) return;
  const forms = sidebar.querySelectorAll("form");
  for (const form of forms) {
    for (const cb of form.querySelectorAll("input[type=checkbox]")) cb.checked = true;
    const range = form.querySelector("input[type=range]");
    if (range) {
      const label = form.querySelector("label")?.textContent || "";
      if (label.includes("Max enrollment")) range.value = 80000;
      else if (label.includes("Max % women")) range.value = 100;
      else range.value = 0;
      range.dispatchEvent(new Event("input", {bubbles: true}));
    }
    const sel = form.querySelector("select[multiple]");
    if (sel) { for (const opt of sel.options) opt.selected = true; }
    form.dispatchEvent(new Event("input", {bubbles: true}));
  }
}}));
```

```js
const sectorFilter = view(Inputs.checkbox(
  ["Public", "Private nonprofit", "Private for-profit"],
  {label: "Sector", value: ["Public", "Private nonprofit", "Private for-profit"]}
));
```

```js
const saecInput = Inputs.select(allSaec, {
  label: "SAEC classification", multiple: true, value: allSaec, width: 260,
});
saecInput.querySelector("select").size = 4;
const saecFilter = view(saecInput);
```

```js
const localeFilter = view(Inputs.checkbox(
  ["City", "Suburb", "Town", "Rural"],
  {label: "Location", value: ["City", "Suburb", "Town", "Rural"]}
));
```

```js
const stateOptions = ["All", ...allStates];
const stateInput = Inputs.select(stateOptions, {
  label: "State", multiple: true, value: ["All"], width: 260,
});
stateInput.querySelector("select").size = 4;
const stateSelection = view(stateInput);
```

```js
const stateFilter = stateSelection.includes("All") ? allStates : stateSelection;
```

```js
const enrollMin = view(Inputs.range([0, 80000], {label: "Min enrollment", step: 500, value: 0, width: 240}));
```

```js
const enrollMax = view(Inputs.range([0, 80000], {label: "Max enrollment", step: 500, value: 80000, width: 240}));
```

```js
const programInput = Inputs.select(cipLabels, {
  label: "Programs offered", multiple: true, value: cipLabels, width: 260,
});
programInput.querySelector("select").size = 4;
const programFilter = view(programInput);
```

```js
const pellMin = view(Inputs.range([0, 100], {label: "Min % Pell", step: 1, value: 0, width: 240}));
```

```js
const womenMin = view(Inputs.range([0, 100], {label: "Min % women", step: 1, value: 0, width: 240}));
```

```js
const womenMax = view(Inputs.range([0, 100], {label: "Max % women", step: 1, value: 100, width: 240}));
```

```js
const specialFlags = view(Inputs.checkbox(
  ["HBCU", "HSI", "Women's college", "Land-grant", "None required"],
  {label: "Special designation", value: ["HBCU", "HSI", "Women's college", "Land-grant", "None required"]}
));
```

```js
// Filtered dataset
const filtered = institutions.filter(d => {
  const cips = institutionCips.get(d.UNITID) || new Set();
  const pell_pct = d.pell_2023 != null ? d.pell_2023 * 100 : null;

  // Special designation: must match at least one selected
  const passFlag = (
    (specialFlags.includes("HBCU") && +d.hbcu === 1) ||
    (specialFlags.includes("HSI") && +d.hsi === 1) ||
    (specialFlags.includes("Women's college") && +d.womenonly === 1) ||
    (specialFlags.includes("Land-grant") && +d.landgrant === 1) ||
    (specialFlags.includes("None required"))
  );

  return (
    sectorFilter.includes(d.sector_label) &&
    (saecFilter.length === 0 || saecFilter.includes(d.saec2025name)) &&
    (localeFilter.length === 0 || localeFilter.includes(d.locale_group)) &&
    stateFilter.includes(d.STABBR) &&
    d.enrollment_total >= enrollMin &&
    d.enrollment_total <= enrollMax &&
    programFilter.some(p => cips.has(p)) &&
    (pell_pct == null || pell_pct >= pellMin) &&
    (d.pct_women == null || (d.pct_women >= womenMin && d.pct_women <= womenMax)) &&
    passFlag
  );
});
```

**${filtered.length}** of ${institutions.length} institutions

Undergrad: **${filtered.reduce((s, d) => s + (d.enrollment_ug || 0), 0).toLocaleString()}**<br>
Grad: **${filtered.reduce((s, d) => s + ((d.enrollment_total || 0) - (d.enrollment_ug || 0)), 0).toLocaleString()}**

</div>
<div>

```js
// Axis selector
const axisOptions = [
  {label: "Admission Rate vs 6-Yr Graduation Rate", xField: "grad_rate_6yr", yField: "admission_rate",
   xLabel: "6-Year Graduation Rate (%)", yLabel: "Admission Rate (%)", xFlip: true, yFlip: true,
   xDomain: [100, 33], yDomain: [70, 0]},
  {label: "Earnings Ratio vs Access Ratio", xField: "access_ratio", yField: "earnings_ratio",
   xLabel: "Access Ratio (vs expected Pell %)", yLabel: "Earnings Ratio (vs peer institutions)",
   xFlip: false, yFlip: false, xDomain: null, yDomain: null},
  {label: "Net Price vs Earnings", xField: "saec_earnings", yField: "net_price",
   xLabel: "Median Earnings 8yr ($)", yLabel: "Net Price ($)",
   xFlip: false, yFlip: false, xDomain: null, yDomain: null},
  {label: "6-Yr Grad Rate vs Net Price", xField: "net_price", yField: "grad_rate_6yr",
   xLabel: "Net Price ($)", yLabel: "6-Year Graduation Rate (%)",
   xFlip: false, yFlip: false, xDomain: null, yDomain: null},
];
const axisChoice = view(Inputs.select(axisOptions, {
  label: "Plot view", format: d => d.label, value: axisOptions[0]
}));
```

```js
// Scatterplot
{
  const xF = axisChoice.xField;
  const yF = axisChoice.yField;
  const plotData = filtered.filter(d => d[xF] != null && d[yF] != null);

  function polyFit(xs, ys, degree) {
    const n = xs.length;
    const size = degree + 1;
    const X = Array.from({length: size}, (_, i) => Array.from({length: size}, (_, j) =>
      xs.reduce((s, x) => s + x ** (i + j), 0)));
    const Y = Array.from({length: size}, (_, i) =>
      xs.reduce((s, x, k) => s + x ** i * ys[k], 0));
    for (let i = 0; i < size; i++) {
      let max = i;
      for (let j = i + 1; j < size; j++) if (Math.abs(X[j][i]) > Math.abs(X[max][i])) max = j;
      [X[i], X[max]] = [X[max], X[i]];
      [Y[i], Y[max]] = [Y[max], Y[i]];
      for (let j = i + 1; j < size; j++) {
        const f = X[j][i] / X[i][i];
        for (let k = i; k < size; k++) X[j][k] -= f * X[i][k];
        Y[j] -= f * Y[i];
      }
    }
    const coeffs = new Array(size);
    for (let i = size - 1; i >= 0; i--) {
      coeffs[i] = Y[i];
      for (let j = i + 1; j < size; j++) coeffs[i] -= X[i][j] * coeffs[j];
      coeffs[i] /= X[i][i];
    }
    return coeffs;
  }

  const sectorColors = {"Public": "#4e79a7", "Private nonprofit": "#e15759", "Private for-profit": "#f28e2b"};
  const trendLines = [];
  for (const sector of sectorFilter) {
    const sd = plotData.filter(d => d.sector_label === sector);
    if (sd.length < 4) continue;
    const xs = sd.map(d => d[xF]);
    const ys = sd.map(d => d[yF]);
    const xMin = d3.min(xs), xMax = d3.max(xs);
    const coeffs = polyFit(xs, ys, 3);
    for (const x of d3.range(xMin, xMax, (xMax - xMin) / 100)) {
      trendLines.push({x, y: coeffs[0] + coeffs[1]*x + coeffs[2]*x**2 + coeffs[3]*x**3, sector});
    }
  }

  const xDomain = axisChoice.xDomain || [d3.min(plotData, d => d[xF]), d3.max(plotData, d => d[xF])];
  const yDomain = axisChoice.yDomain || [d3.min(plotData, d => d[yF]), d3.max(plotData, d => d[yF])];

  display(Plot.plot({
    width: 900,
    height: 600,
    grid: true,
    style: {"--plot-grid-stroke": "#999"},
    x: {label: axisChoice.xLabel, domain: xDomain},
    y: {label: axisChoice.yLabel, domain: yDomain},
    r: {range: [2, 15]},
    color: {
      legend: true,
      domain: ["Public", "Private nonprofit", "Private for-profit"],
      range: ["#4e79a7", "#e15759", "#f28e2b"],
    },
    marks: [
      Plot.line(trendLines, {x: "x", y: "y", z: "sector", stroke: d => sectorColors[d.sector],
        strokeWidth: 2, strokeDasharray: "6,4"}),
      Plot.dot(plotData, {
        x: xF, y: yF,
        fill: "sector_label",
        r: "enrollment_total",
        fillOpacity: 0.5,
        stroke: "currentColor",
        strokeWidth: 0.5,
        tip: {format: {x: false, y: false, fill: false, r: false}},
        channels: {
          Name: "INSTNM",
          State: "STABBR",
          "Classification": "ic2025name",
          "SAEC": "saec2025name",
          [axisChoice.xLabel]: xF,
          [axisChoice.yLabel]: yF,
          "Enrollment": "enrollment_ug",
        },
      }),
      Plot.crosshair(plotData, {x: xF, y: yF, color: "#555"}),
      Plot.dot(plotData.filter(d => d.INSTNM === selectedName), {
        x: xF, y: yF,
        r: 12,
        fill: "none",
        stroke: "black",
        strokeWidth: 3,
      }),
    ],
  }));
}
```

</div>
</div>

---

## Institution Detail

```js
const selectedName = view(Inputs.text({
  label: "Search institution",
  placeholder: "Type to search...",
  datalist: filtered.map(d => d.INSTNM).sort(),
  width: 400,
}));
```

```js
const selected = filtered.find(d => d.INSTNM === selectedName) || null;
```

```js
if (selected) display(collegeCard(selected));
```

```js
// Demographics chart
if (selected) {
  display(html`<h3>Demographics</h3>`);
  const demoData = [
    {group: "White", value: selected.pct_white},
    {group: "Black", value: selected.pct_black},
    {group: "Hispanic", value: selected.pct_hispanic},
    {group: "Asian", value: selected.pct_asian},
    {group: "Two+", value: selected.pct_two_or_more},
    {group: "AIAN", value: selected.pct_aian},
    {group: "NHPI", value: selected.pct_nhpi},
    {group: "Nonresident", value: selected.pct_nonresident},
  ].filter(d => d.value > 0);

  display(Plot.plot({
    width: 500,
    height: Math.max(100, demoData.length * 30),
    marginLeft: 100,
    x: {label: "%", domain: [0, 100]},
    marks: [
      Plot.barX(demoData, {x: "value", y: "group", fill: "#4e79a7", sort: {y: "-x"}, tip: true}),
    ],
  }));
}
```

```js
// Programs chart
if (selected) {
  const instPrograms = programs
    .filter(d => d.UNITID === selected.UNITID)
    .sort((a, b) => b.total_awards - a.total_awards)
    .slice(0, 10);

  if (instPrograms.length > 0) {
    display(html`<h3>Programs (Top 10 by Bachelor's Degrees Awarded)</h3>`);
    display(Plot.plot({
      width: 500,
      height: Math.max(100, instPrograms.length * 28),
      marginLeft: 160,
      x: {label: "Degrees Awarded"},
      marks: [
        Plot.barX(instPrograms, {x: "total_awards", y: "cip_label", fill: "#e15759", sort: {y: "-x"}, tip: true}),
      ],
    }));
  } else {
    display(html`<p><em>No bachelor's program data available.</em></p>`);
  }
}
```

```js
// Earnings & equity panel
if (selected && (selected.saec_earnings || selected.earnings_ratio)) {
  display(html`<h3>Outcomes & Equity (Carnegie 2025)</h3>`);
  const items = [
    {label: "Median Earnings (8yr)", value: selected.saec_earnings != null ? "$" + Math.round(selected.saec_earnings).toLocaleString() : "N/A"},
    {label: "Earnings vs Peer Group", value: selected.earnings_ratio != null ? (selected.earnings_ratio).toFixed(2) + "×" : "N/A"},
    {label: "Comparison Earnings", value: selected.saec_compearn != null ? "$" + Math.round(selected.saec_compearn).toLocaleString() : "N/A"},
    {label: "Pell Ratio (vs expected)", value: selected.pell_ratio != null ? selected.pell_ratio.toFixed(2) : "N/A"},
    {label: "URM Ratio (vs expected)", value: selected.saec_urm_ratio != null ? selected.saec_urm_ratio.toFixed(2) : "N/A"},
    {label: "Access Ratio", value: selected.access_ratio != null ? selected.access_ratio.toFixed(2) : "N/A"},
    {label: "Net Price", value: selected.net_price != null ? "$" + Math.round(selected.net_price).toLocaleString() : "N/A"},
    {label: "Median Grad Debt", value: selected.grad_debt_median != null ? "$" + Math.round(selected.grad_debt_median).toLocaleString() : "N/A"},
    {label: "8-Yr Completion Rate", value: selected.completion_rate_8yr != null ? selected.completion_rate_8yr.toFixed(1) + "%" : "N/A"},
    {label: "8-Yr Transfer-Out Rate", value: selected.transfer_out_8yr != null ? selected.transfer_out_8yr.toFixed(1) + "%" : "N/A"},
  ];
  display(html`<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:0.75rem; max-width:700px;">
    ${items.map(item => html`<div style="background:#f8f9fa; border-radius:6px; padding:0.6rem 0.8rem;">
      <div style="font-size:0.72rem; color:#666; margin-bottom:0.2rem;">${item.label}</div>
      <div style="font-size:1rem; font-weight:600; color:#222;">${item.value}</div>
    </div>`)}
  </div>`);
}
```
