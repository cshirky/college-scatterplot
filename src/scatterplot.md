# Graduation Rate vs. Yield

```js
import {collegeCard} from "./components/collegeCard.js";
```

```js
const good_schools = FileAttachment("data/good_schools.csv").csv({typed: true});
```

```js
const data = good_schools
  .filter(d => d.grad_rate_6yr != null && d.yield_rate != null &&
               !isNaN(d.grad_rate_6yr) && !isNaN(d.yield_rate))
  .map(d => ({...d, yield_rate: Math.round(d.yield_rate)}));

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

const yieldStep = 5, gradStep = 5;
const yieldStart = Math.floor(xMin / yieldStep) * yieldStep;
const yieldEnd   = Math.ceil(xMax  / yieldStep) * yieldStep;
const grid = [];
for (let x1 = yieldStart; x1 < yieldEnd; x1 += yieldStep) {
  for (let y1 = 50; y1 < 100; y1 += gradStep) {
    grid.push({x1, x2: x1 + yieldStep, y1, y2: y1 + gradStep});
  }
}
const edgeRects = grid.filter(q => q.x1 === 20 || (q.y1 === 50 && q.x1 < 25));
const cellCounts = grid.map(q => ({
  ...q,
  count: data.filter(d =>
    d.yield_rate    >= q.x1 && d.yield_rate    < q.x2 &&
    d.grad_rate_6yr >= q.y1 && d.grad_rate_6yr < q.y2
  ).length
})).filter(q => q.count > 0);

const colCounts = d3.range(yieldStart, yieldEnd, yieldStep).map(x1 => ({
  x: x1 + yieldStep / 2,
  count: data.filter(d => d.yield_rate >= x1 && d.yield_rate < x1 + yieldStep).length
}));
const rowCounts = d3.range(50, 100, gradStep).map(y1 => ({
  y: y1 + gradStep / 2,
  count: data.filter(d => d.grad_rate_6yr >= y1 && d.grad_rate_6yr < y1 + gradStep).length
}));
```

```js
const searchQuery = view(Inputs.text({placeholder: "Search for a school…", width: 300}));
```

```js
{
  const query = searchQuery.trim().toLowerCase();
  const match = d => query && d.INSTNM.toLowerCase().includes(query);

  const baseColor = d => d.sector_label === "Public" ? "#FF8C00" : "steelblue";
  const hiColor   = d => d.sector_label === "Public" ? "#b35000" : "darkblue";

  const cardArea = html`<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-top:1.5rem; max-width:800px;"></div>`;

  const triSize = 14; // pixel size of corner triangle

  // cellCounts text is omitted from marks — drawn manually below for z-order control
  const plt = Plot.plot({
    width: 800,
    height: 600,
    marginLeft: 50,
    marginBottom: 50,
    marginTop: 24,
    marginRight: 30,
    x: { label: "Yield rate (%)", ticks: d3.range(Math.floor(xMin / 5) * 5, xMax + 5, 5) },
    y: { label: "6-year graduation rate (%)", domain: [50, 100] },
    marks: [
      Plot.rect(grid, {x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "white"}),
      Plot.rect(edgeRects, {x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "#f9f9f9"}),
      Plot.dot(data, {
        x: "yield_rate",
        y: "grad_rate_6yr",
        r: d => match(d) ? 6 : 3,
        fill: d => match(d) ? hiColor(d) : baseColor(d),
        fillOpacity: d => match(d) ? 1 : 0.5,
      }),
      Plot.text(colCounts, {x: "x", y: 100, text: "count", textAnchor: "middle", lineAnchor: "bottom", dy: -4, fontSize: 9, fontFamily: "sans-serif", fill: "#888", clip: false}),
      Plot.text(rowCounts, {x: xMax, y: "y", text: "count", textAnchor: "start", dx: 6, fontSize: 9, fontFamily: "sans-serif", fill: "#888", clip: false}),
      Plot.gridX({ticks: d3.range(Math.floor(xMin / 5) * 5, xMax + 5, 5)}),
      Plot.gridY({ticks: d3.range(50, 101, 5)}),
      Plot.ruleX([40], {stroke: "green", strokeWidth: 1, strokeDasharray: "1,4"}),
      Plot.ruleY([85], {stroke: "green", strokeWidth: 1, strokeDasharray: "1,4"}),
    ],
  });

  const svgEl = plt.tagName === "svg" ? plt : plt.querySelector("svg");
  const xs = plt.scale("x");
  const ys = plt.scale("y");
  const xRange = xs.range;
  const yRange = ys.range;
  const ns = "http://www.w3.org/2000/svg";

  // Triangles inserted before the dot group so dots render on top; labels appended after
  const triGroup = document.createElementNS(ns, "g");
  triGroup.setAttribute("fill", "#e5e7eb");
  triGroup.setAttribute("pointer-events", "none");
  for (const cell of cellCounts) {
    const bx = xs.apply(cell.x1);
    const by = ys.apply(cell.y1);
    const poly = document.createElementNS(ns, "polygon");
    poly.setAttribute("points", `${bx},${by} ${bx + triSize},${by} ${bx},${by - triSize}`);
    triGroup.appendChild(poly);
  }
  // Find the <g> that contains the dot circles and insert triangles before it
  const dotG = svgEl?.querySelector("circle")?.closest("g");
  if (dotG?.parentElement) dotG.parentElement.insertBefore(triGroup, dotG);
  else svgEl?.appendChild(triGroup);

  const labelGroup = document.createElementNS(ns, "g");
  labelGroup.setAttribute("font-size", "9");
  labelGroup.setAttribute("font-family", "sans-serif");
  labelGroup.setAttribute("fill", "#aaa");
  labelGroup.setAttribute("pointer-events", "none");
  for (const cell of cellCounts) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", xs.apply(cell.x1) + 3);
    t.setAttribute("y", ys.apply(cell.y1) - 2);
    t.setAttribute("text-anchor", "start");
    t.textContent = String(cell.count);
    labelGroup.appendChild(t);
  }
  svgEl?.appendChild(labelGroup);

  // Manual crosshair lines — only shown when cursor is directly over a dot
  const hLine = document.createElementNS(ns, "line");
  hLine.setAttribute("stroke", "#555");
  hLine.setAttribute("stroke-width", "0.5");
  hLine.setAttribute("stroke-dasharray", "4,3");
  hLine.setAttribute("x1", xRange[0]);
  hLine.setAttribute("x2", xRange[1]);
  hLine.style.display = "none";
  hLine.style.pointerEvents = "none";

  const vLine = document.createElementNS(ns, "line");
  vLine.setAttribute("stroke", "#555");
  vLine.setAttribute("stroke-width", "1");
  vLine.setAttribute("stroke-dasharray", "4,3");
  vLine.setAttribute("y1", yRange[0]);
  vLine.setAttribute("y2", yRange[1]);
  vLine.style.display = "none";
  vLine.style.pointerEvents = "none";

  svgEl?.appendChild(hLine);
  svgEl?.appendChild(vLine);

  const tipEl = html`<div style="position:absolute; display:none; background:white; border:1px solid #ddd; border-radius:6px; padding:0.4rem 0.65rem; font-size:0.8rem; pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.12); max-width:240px; line-height:1.5;"></div>`;
  const wrapper = html`<div style="position:relative; display:inline-block;"></div>`;
  wrapper.append(plt);
  wrapper.append(tipEl);

  plt.addEventListener("pointermove", evt => {
    if (!xs || !ys) return;
    const rect = plt.getBoundingClientRect();
    const xVal = xs.invert(evt.clientX - rect.left);
    const yVal = ys.invert(evt.clientY - rect.top);
    let nearest = null, minDist = Infinity;
    for (const d of data) {
      const dist = (d.yield_rate - xVal) ** 2 + (d.grad_rate_6yr - yVal) ** 2;
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    if (nearest && minDist < 30) {
      const sector = nearest.sector_label === "Public" ? "Public" : "Private";
      tipEl.innerHTML = `<strong>${nearest.INSTNM}</strong><br>${sector} school in ${nearest.CITY}, ${nearest.STABBR}<br><span style="color:#555">Grad rate: ${nearest.grad_rate_6yr}% &nbsp;·&nbsp; Yield: ${nearest.yield_rate}%</span>`;
      const offX = evt.clientX - rect.left + 14;
      const offY = evt.clientY - rect.top - 10;
      tipEl.style.left = offX + "px";
      tipEl.style.top  = offY + "px";
      tipEl.style.display = "block";
      // Crosshair only when cursor is pixel-close to the dot center
      const dotX = xs.apply(nearest.yield_rate);
      const dotY = ys.apply(nearest.grad_rate_6yr);
      const curX = evt.clientX - rect.left;
      const curY = evt.clientY - rect.top;
      const pixDist2 = (dotX - curX) ** 2 + (dotY - curY) ** 2;
      if (pixDist2 < 36) { // within 6px of dot center
        hLine.setAttribute("y1", dotY);
        hLine.setAttribute("y2", dotY);
        hLine.style.display = "";
        vLine.setAttribute("x1", dotX);
        vLine.setAttribute("x2", dotX);
        vLine.style.display = "";
      } else {
        hLine.style.display = "none";
        vLine.style.display = "none";
      }
    } else {
      tipEl.style.display = "none";
      hLine.style.display = "none";
      vLine.style.display = "none";
    }
  });

  plt.addEventListener("pointerleave", () => {
    tipEl.style.display = "none";
    hLine.style.display = "none";
    vLine.style.display = "none";
  });

  plt.addEventListener("click", evt => {
    const r = plt.getBoundingClientRect();
    const px = evt.clientX - r.left;
    const py = evt.clientY - r.top;

    // First: check if clicking near a dot (pixel-space distance)
    let nearest = null, minDist = Infinity;
    for (const d of data) {
      const dx = xs.apply(d.yield_rate) - px;
      const dy = ys.apply(d.grad_rate_6yr) - py;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    if (nearest && minDist < 36) { // within ~6px of dot center
      cardArea.innerHTML = "";
      cardArea.append(collegeCard(nearest));

      // If other schools share this cell, offer a "see all" link
      const cx1 = Math.floor(nearest.yield_rate / yieldStep) * yieldStep;
      const cy1 = Math.floor(nearest.grad_rate_6yr / gradStep) * gradStep;
      const cellmates = data.filter(d =>
        d !== nearest &&
        d.yield_rate    >= cx1 && d.yield_rate    < cx1 + yieldStep &&
        d.grad_rate_6yr >= cy1 && d.grad_rate_6yr < cy1 + gradStep
      );
      if (cellmates.length > 0) {
        const total = cellmates.length + 1;
        const seeAll = html`<p style="grid-column:1/-1; margin:0.25rem 0 0; font-size:0.82rem; color:#666;">
          <a href="#" style="color:#2563eb;">See all ${total} schools with ${cx1}–${cx1+yieldStep}% yield and ${cy1}–${cy1+gradStep}% grad rate →</a>
        </p>`;
        seeAll.querySelector("a").onclick = e => {
          e.preventDefault();
          cardArea.innerHTML = "";
          const noun = total === 1 ? "school" : "schools";
          cardArea.append(html`<p style="grid-column:1/-1; margin:0 0 0.5rem; font-size:0.9rem; color:#555;">
            <strong>${total} ${noun}</strong> with ${cx1}–${cx1+yieldStep}% yield and ${cy1}–${cy1+gradStep}% graduation rate
          </p>`);
          for (const school of [nearest, ...cellmates]) cardArea.append(collegeCard(school));
        };
        cardArea.append(seeAll);
      }
      return;
    }

    // Second: check if clicking inside a cell count triangle
    // Vertices: (bx,by), (bx+triSize,by), (bx,by-triSize) — right angle at bottom-left
    // Inside if: dx>=0, dy>=0, dx+dy<=triSize  (dy = by-py, since SVG y increases downward)
    for (const cell of cellCounts) {
      const bx = xs.apply(cell.x1);
      const by = ys.apply(cell.y1);
      const dx = px - bx;
      const dy = by - py;
      if (dx >= 0 && dy >= 0 && dx + dy <= triSize) {
        const matches = data.filter(d =>
          d.yield_rate    >= cell.x1 && d.yield_rate    < cell.x2 &&
          d.grad_rate_6yr >= cell.y1 && d.grad_rate_6yr < cell.y2
        );
        cardArea.innerHTML = "";
        if (matches.length === 0) return;
        const noun = matches.length === 1 ? "school" : "schools";
        const header = html`<p style="grid-column:1/-1; margin:0 0 0.5rem; font-size:0.9rem; color:#555;">
          <strong>${matches.length} ${noun}</strong> with ${cell.x1}–${cell.x2}% yield and ${cell.y1}–${cell.y2}% graduation rate
        </p>`;
        cardArea.append(header);
        for (const school of matches) cardArea.append(collegeCard(school));
        return;
      }
    }
  });

  display(wrapper);
  display(cardArea);
}
```
