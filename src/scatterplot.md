# College Scatterplot

```js
import { collegeCard } from "./components/collegeCard.js";
```

```js
const good_schools      = FileAttachment("data/good_schools.csv").csv({typed: true});
const low_yield_schools = FileAttachment("data/low_yield_schools.csv").csv({typed: true});
```

```js
const data = [...good_schools, ...low_yield_schools]
  .filter(d => d.grad_rate_6yr != null && d.yield_rate != null &&
               !isNaN(+d.grad_rate_6yr) && !isNaN(+d.yield_rate))
  .filter(d => {
    const y = Math.round(+d.yield_rate);
    const g = +d.grad_rate_6yr;
    if (y < yieldFloor) return false;
    if (g < gradFloor) return false;
    return true;
  })
  .map(d => ({
    ...d,
    yield_rate:    Math.round(+d.yield_rate),
    grad_rate_6yr: +d.grad_rate_6yr,
  }));

function polyFit(dataArr, xKey, yKey, degree) {
  const xs = dataArr.map(d => d[xKey]);
  const ys = dataArr.map(d => d[yKey]);
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
  for (let y1 = gradFloor; y1 < 100; y1 += gradStep) {
    grid.push({x1, x2: x1 + yieldStep, y1, y2: y1 + gradStep});
  }
}
// Shade levels: 0=darkest … 3=white. Yield columns and grad rows each carry a level;
// cells use whichever is darker (lower index).
const shadeColors = ["#e0e0e0", "#ebebeb", "#f4f4f4", "white"];
function cellShade(x1, y1) {
  const yLevel = x1 < 15 ? 0 : x1 < 20 ? 1 : x1 < 25 ? 2 : 3;
  const gLevel = y1 < 55 ? 0 : y1 < 60 ? 1 : y1 < 65 ? 2 : 3;
  return shadeColors[Math.min(yLevel, gLevel)];
}
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
const rowCounts = d3.range(gradFloor, 100, gradStep).map(y1 => ({
  y: y1 + gradStep / 2,
  count: data.filter(d => d.grad_rate_6yr >= y1 && d.grad_rate_6yr < y1 + gradStep).length
}));
```

```js
{
  const imgUrl = await FileAttachment("scatterplot_all_schools.png").url();
  const details = html`<details open style="border:1px solid #ddd; border-radius:6px; padding:0.6rem 1rem; margin-bottom:1.5rem; background:#f9fafb;">
  <summary style="font-weight:600; font-size:1rem; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center;">
    What (and who) this is for
    <span class="toggle-hint" style="font-size:0.8rem; font-weight:400; color:#888;">click to close</span>
  </summary>
  <div style="margin-top:0.75rem; font-size:0.9rem; line-height:1.7; color:#333; max-width:720px;">
    <p>This is an opinionated guide to picking U.S. colleges. It assumes you are:</p>
    <ul>
      <li>An American high school student…</li>
      <li>…with a B- grade average or better</li>
      <li>…who wants a Bachelor's degree</li>
      <li>…at a college that has lots of options for majors</li>
      <li>…where you study full-time and live on campus.</li>
    </ul>
    <p>If that describes you, the chart below, drawn from data collected in the <a href="https://nces.ed.gov/ipeds">Integrated Postsecondary Education Data System</a>, is designed to help you explore your options. (And maybe that doesn't describe you, because you want to go to community college, or art school, or study online. Maybe you want to live at home, or go to a women's college, or a school for people of your religion. Those are fine choices, but easier than picking among hundreds of broad curriculum residential schools.)</p>
    <p>I'll start with three assertions:</p>
    <ol>
      <li><strong>High school students worry too much</strong> about whether they will be accepted, while spending too little time trying to get a sense of the places they might like to go. This page is for you to get a sense of the layout of American higher ed generally.</li>
      <li><strong>If you have a dream school</strong>, knock it off. Seriously, tf are you thinking? It's good to have a sense of what colleges you might like to attend, but no institution is worth that much adulation. Make a list and don't fixate on just one school.</li>
      <li><strong>A college's acceptance rate</strong> is a fairly bullshit number. When the Common App went online in the late '90s, most of the selective colleges saw their admissions rates fall even though there were <em>no new students and no reductions in incoming classes</em> -- the change in rate came solely from students applying to more schools.</li>
    </ol>
    <p>Colleges have every incentive to get you to focus on things like their mission statement (some version of "Knowledge is good", but in Latin), or how selective they are, or how nice the campus looks in the fall. These signals of quality are easy to understand but also easy to fake and relatively unimportant.</p>
    <p>On the other hand, there are two important and hard to fake measurements: Yield, and 6 Year Graduation rate.</p>
    <ul>
      <li><p><strong>Yield</strong> is a measure of the percentage of students who were admitted and chose to go.</p> 
      <p>Yield measures a <em>choice</em> -- if a student says Yes to one school, they are saying No to every other school they got into. Colleges obsess over yield internally, but don't mention it to applicants because the students control it, not their marketing department. If a school offers a spot to 100 students, and only 10 go, that tells you something very different than if 40 go: School A, at 10% yield, is a safety, School B, at 40%, has more people who want to be there in particular. So, higher Yield is a good proxy for an engaged and committed student body.</p></li>
      <li><p><strong>6 Year Graduation Rate</strong> is just what it sounds like: how many students graduated by 6 years after their arrival?</p> 
        <p>Graduation rate is the single most important metric, capturing how prepared and serious the students are, and how well the college supports them. (The Bachelor's is often called a "4 year degree", but many students take more time, hence the 6 year window.) If many students drop out or transfer out before graduating, it does not matter how nice the campus looks in fall -- just don't apply.</p></li>
    </ul>
    <p>The chart below lists the tk colleges (including those inside universities) that:</p> 
    <ol>
      <li>Have 10%+ Yield and 50%+ 6 year graduation rate (You can adjust this.)</li> 
      <li>Offers more Bachelor's degrees than Associates degrees</li>
      <li>Has students studying full-time, in person, and living on or near campus</li>
      <li>Has a broad curriculum (a lot of potential majors)</li>
      <li>The chart excludes schools with highly specialized curricula -- art schools, engineering schools, health professions schools, seminaries</li>
      <li>Is non-profit, whether public or private. (For-profit colleges are awful, none are listed here, because I would never.)</li>
    </ol>
    <p>Click any dot to see a school card. Click the triangle in any given Yield/Grad Rate square to see all the school cardss in that range.</p>
  </div>
</details>`;
  details.addEventListener("toggle", () => {
    details.querySelector(".toggle-hint").textContent = details.open ? "click to close" : "click to expand";
  });
  display(details);
}
```

## ${data.length} Residential Colleges / Broad Student Body and Curriculum / Yield x Graduation Rate
```js
const searchQuery = view(Inputs.text({placeholder: "Search for a school…", width: 300}));
```

```js
const cardArea = html`<div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; max-width:800px;"></div>`;
```

```js
{
  const query = searchQuery.trim().toLowerCase();
  const match = d => query && d.INSTNM.toLowerCase().includes(query);

  const baseColor = d => d.sector_label === "Public" ? "#e53e3e" : "#3b82f6";
  const hiColor   = d => d.sector_label === "Public" ? "#991b1b" : "#1e3a8a";

  const marginLeft = 65, marginRight = 45, marginTop = 36, marginBottom = 50;
  const plotWidth = 800, plotHeight = 600;

  const plt = Plot.plot({
    width: plotWidth,
    height: plotHeight,
    marginLeft,
    marginBottom,
    marginTop,
    marginRight,
    x: { label: null, domain: [yieldFloor, xMax + 2], ticks: d3.range(yieldFloor, xMax + 5, 5) },
    y: { label: null, domain: [gradFloor, 100] },
    marks: [
      Plot.rect(grid, {x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: d => cellShade(d.x1, d.y1)}),
      Plot.dot(data, {
        x: "yield_rate",
        y: "grad_rate_6yr",
        r: d => match(d) ? 6 : 4,
        fill: d => match(d) ? hiColor(d) : baseColor(d),
        fillOpacity: d => match(d) ? 0.9 : 0.22,
        stroke: "none",
      }),
      Plot.text(colCounts, {x: "x", y: 100, text: "count", textAnchor: "middle", lineAnchor: "bottom", dy: -4, fontSize: 9, fontFamily: "sans-serif", fill: "#888", clip: false}),
      Plot.gridX({ticks: d3.range(yieldFloor, xMax + 5, 5)}),
      Plot.gridY({ticks: d3.range(gradFloor, 101, 5)}),
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

  // Cell count labels (appended after dots)
  const labelGroup = document.createElementNS(ns, "g");
  labelGroup.setAttribute("font-size", "9");
  labelGroup.setAttribute("font-family", "sans-serif");
  labelGroup.setAttribute("fill", "#777");
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

  // Y-axis label
  const plotCenterY = (marginTop + (plotHeight - marginBottom)) / 2;
  const yAxisLabel = document.createElementNS(ns, "text");
  yAxisLabel.setAttribute("transform", `translate(13, ${plotCenterY}) rotate(-90)`);
  yAxisLabel.setAttribute("text-anchor", "middle");
  yAxisLabel.setAttribute("font-size", "11");
  yAxisLabel.setAttribute("font-family", "sans-serif");
  yAxisLabel.setAttribute("fill", "#555");
  yAxisLabel.textContent = "6-year graduation rate (%)";
  svgEl?.appendChild(yAxisLabel);

  // X-axis label
  const plotCenterX = (marginLeft + (plotWidth - marginRight)) / 2;
  const xAxisLabel = document.createElementNS(ns, "text");
  xAxisLabel.setAttribute("x", plotCenterX);
  xAxisLabel.setAttribute("y", plotHeight - 8);
  xAxisLabel.setAttribute("text-anchor", "middle");
  xAxisLabel.setAttribute("font-size", "11");
  xAxisLabel.setAttribute("font-family", "sans-serif");
  xAxisLabel.setAttribute("fill", "#555");
  xAxisLabel.textContent = "Yield (% of admitted students who chose to attend)";
  svgEl?.appendChild(xAxisLabel);

  // "Number of schools in each column" label across the top
  const colCountLabel = document.createElementNS(ns, "text");
  colCountLabel.setAttribute("x", plotCenterX);
  colCountLabel.setAttribute("y", 11);
  colCountLabel.setAttribute("text-anchor", "middle");
  colCountLabel.setAttribute("font-size", "9");
  colCountLabel.setAttribute("font-family", "sans-serif");
  colCountLabel.setAttribute("fill", "#888");
  colCountLabel.textContent = "Number of schools in each column";
  svgEl?.appendChild(colCountLabel);

  // Row counts to the right of the plot
  for (const row of rowCounts) {
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", xRange[1] + 8);
    t.setAttribute("y", ys.apply(row.y));
    t.setAttribute("text-anchor", "start");
    t.setAttribute("dominant-baseline", "middle");
    t.setAttribute("font-size", "9");
    t.setAttribute("font-family", "sans-serif");
    t.setAttribute("fill", "#888");
    t.textContent = String(row.count);
    svgEl?.appendChild(t);
  }

  // "Number of schools in each row" label down the right side
  const rowCountLabel = document.createElementNS(ns, "text");
  rowCountLabel.setAttribute("transform", `translate(${xRange[1] + 36}, ${plotCenterY}) rotate(90)`);
  rowCountLabel.setAttribute("text-anchor", "middle");
  rowCountLabel.setAttribute("font-size", "9");
  rowCountLabel.setAttribute("font-family", "sans-serif");
  rowCountLabel.setAttribute("fill", "#888");
  rowCountLabel.textContent = "Number of schools in each row";
  svgEl?.appendChild(rowCountLabel);

  const tipEl = html`<div style="position:absolute; display:none; background:white; border:1px solid #ddd; border-radius:6px; padding:0.4rem 0.65rem; font-size:0.8rem; pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.12); max-width:260px; line-height:1.5;"></div>`;
  const wrapper = html`<div style="position:relative; display:inline-block;"></div>`;
  wrapper.append(plt);
  wrapper.append(tipEl);

  function stackAt(d) {
    // All schools at the exact same yield_rate × grad_rate_6yr position
    return data.filter(e => e.yield_rate === d.yield_rate && e.grad_rate_6yr === d.grad_rate_6yr);
  }

  plt.addEventListener("pointermove", evt => {
    if (!xs || !ys) return;
    const rect = plt.getBoundingClientRect();
    const px = evt.clientX - rect.left, py = evt.clientY - rect.top;
    let nearest = null, minDist = Infinity;
    for (const d of data) {
      const dx = xs.apply(d.yield_rate) - px, dy = ys.apply(d.grad_rate_6yr) - py;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    if (nearest && minDist < 100) {
      const stack = stackAt(nearest);
      const sector = nearest.sector_label === "Public" ? "Public" : "Private";
      if (stack.length === 1) {
        tipEl.innerHTML = `<strong>${nearest.INSTNM}</strong><br>${sector} · ${nearest.CITY}, ${nearest.STABBR}<br><span style="color:#555">Grad: ${nearest.grad_rate_6yr}% &nbsp;·&nbsp; Yield: ${nearest.yield_rate}%</span>`;
      } else {
        tipEl.innerHTML = `<strong>${stack.length} schools</strong> · ${nearest.yield_rate}% yield, ${nearest.grad_rate_6yr}% grad<br><span style="color:#555">${stack.map(s => s.INSTNM).join("<br>")}</span>`;
      }
      const offX = px + 14, offY = py - 10;
      tipEl.style.left = offX + "px";
      tipEl.style.top  = offY + "px";
      tipEl.style.display = "block";
    } else {
      tipEl.style.display = "none";
    }
  });

  plt.addEventListener("pointerleave", () => { tipEl.style.display = "none"; });

  plt.addEventListener("click", evt => {
    const r = plt.getBoundingClientRect();
    const px = evt.clientX - r.left, py = evt.clientY - r.top;
    let nearest = null, minDist = Infinity;
    for (const d of data) {
      const dx = xs.apply(d.yield_rate) - px, dy = ys.apply(d.grad_rate_6yr) - py;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    if (nearest && minDist < 100) {
      const stack = stackAt(nearest);
      cardArea.innerHTML = "";
      if (stack.length > 1) {
        cardArea.append(html`<p style="grid-column:1/-1; margin:0 0 0.5rem; font-size:0.9rem; color:#555;">
          <strong>${stack.length} schools</strong> at ${nearest.yield_rate}% yield · ${nearest.grad_rate_6yr}% grad rate
        </p>`);
      }
      for (const school of stack) cardArea.append(collegeCard(school));
    }
  });

  display(wrapper);
}
```

```js
const filters = view(Inputs.form(
  {
    yieldFloor: Inputs.select([10, 15, 20, 25], {
      label: null,
      format: d => `Exclude schools with < ${d}% yield`,
      value: 10,
    }),
    gradFloor: Inputs.select([50, 55, 60, 65], {
      label: null,
      format: d => `Exclude schools with < ${d}% grad rate`,
      value: 50,
    }),
  },
  {
    template: inputs => {
      const div = document.createElement("div");
      div.style.cssText = "display:flex; gap:1rem; margin-top:0.5rem;";
      div.append(inputs.yieldFloor, inputs.gradFloor);
      return div;
    }
  }
));
const yieldFloor = filters.yieldFloor;
const gradFloor  = filters.gradFloor;
```

```js
display(cardArea);
```

