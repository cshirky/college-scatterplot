# Graduation Rate vs. Yield

```js
const good_schools = FileAttachment("data/good_schools.csv").csv({typed: true});
```

```js
const data = good_schools.filter(d =>
  d.grad_rate_6yr != null && d.yield_rate != null &&
  !isNaN(d.grad_rate_6yr) && !isNaN(d.yield_rate)
);
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
        "Grad rate (6yr)": "grad_rate_6yr",
        "Yield": "yield_rate",
      },
    }),
    Plot.ruleX([30], {stroke: "green", strokeWidth: 1, strokeDasharray: "4,4"}),
    Plot.ruleY([65.5], {stroke: "green", strokeWidth: 1, strokeDasharray: "4,4"}),
    Plot.crosshair(data, {x: "yield_rate", y: "grad_rate_6yr", color: "#555"}),
  ],
})
```
