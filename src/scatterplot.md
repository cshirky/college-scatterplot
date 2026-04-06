# Graduation Rate vs. Yield

```js
const good_schools = FileAttachment("data/good_schools.csv").csv({typed: true});
```

```js
const data = good_schools.filter(d =>
  d.grad_rate_6yr != null && d.yield_rate != null &&
  !isNaN(d.grad_rate_6yr) && !isNaN(d.yield_rate)
);

function polyFit(data, xKey, yKey, degree) {
  const xs = data.map(d => d[xKey]);
  const ys = data.map(d => d[yKey]);
  const cols = degree + 1;
  const XtX = Array.from({length: cols}, (_, i) =>
    Array.from({length: cols}, (_, j) =>
      xs.reduce((s, x) => s + Math.pow(x, i + j), 0)));
  const Xty = Array.from({length: cols}, (_, i) =>
    xs.reduce((s, x, k) => s + Math.pow(x, i) * ys[k], 0));
  const aug = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < cols; col++) {
    let maxRow = col;
    for (let row = col + 1; row < cols; row++)
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    for (let row = col + 1; row < cols; row++) {
      const f = aug[row][col] / aug[col][col];
      for (let k = col; k <= cols; k++) aug[row][k] -= f * aug[col][k];
    }
  }
  const coeffs = new Array(cols);
  for (let i = cols - 1; i >= 0; i--) {
    coeffs[i] = aug[i][cols] / aug[i][i];
    for (let k = i - 1; k >= 0; k--) aug[k][cols] -= aug[k][i] * coeffs[i];
  }
  return coeffs;
}

const coeffs = polyFit(data, "yield_rate", "grad_rate_6yr", 2);
const xMin = d3.min(data, d => d.yield_rate);
const xMax = d3.max(data, d => d.yield_rate);
const allTrendPoints = d3.range(xMin, xMax, (xMax - xMin) / 200)
  .map(x => ({x, y: coeffs.reduce((s, c, i) => s + c * Math.pow(x, i), 0)}));

const residuals = data.map(d => {
  const yHat = coeffs.reduce((s, c, i) => s + c * Math.pow(d.yield_rate, i), 0);
  return d.grad_rate_6yr - yHat;
});
const sd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (residuals.length - 3));

const trendPoints = allTrendPoints.filter(p => p.y <= 98);
const bandPoints = allTrendPoints.filter(p => p.y - sd >= 50 && p.y + sd <= 102);
```

```js
Plot.plot({
  width: 800,
  height: 600,
  marginLeft: 50,
  marginBottom: 50,
  grid: true,
  x: {
    label: "Yield rate (%)",
  },
  y: {
    label: "6-year graduation rate (%)",
    domain: [50, 100],
  },
  marks: [
    Plot.dot(data, {
      x: "yield_rate",
      y: "grad_rate_6yr",
      r: 3,
      fill: "steelblue",
      fillOpacity: 0.5,
      tip: {format: {x: false, y: false, fill: false}},
      channels: {
        School: "INSTNM",
        State: "STABBR",
        "Public/Private": "sector_label",
        "Grad rate (6yr)": "grad_rate_6yr",
        "Yield": "yield_rate",
      },
    }),
    Plot.line(trendPoints, {x: "x", y: "y", stroke: "orange", strokeWidth: 1, strokeDasharray: "4,4"}),
    Plot.ruleX([40], {stroke: "green", strokeWidth: 1, strokeDasharray: "4,4"}),
    Plot.ruleY([79.5], {stroke: "green", strokeWidth: 1, strokeDasharray: "4,4"}),
    Plot.crosshair(data, {x: "yield_rate", y: "grad_rate_6yr", color: "#555"}),
  ],
})
```
