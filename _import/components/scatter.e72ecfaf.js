import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/93ce672e.js";
import {STEP, YIELD_END, GRAD_END, cellShade} from "./cells.55d7d74d.js";

const ns = "http://www.w3.org/2000/svg";

// The scatterplot. `reversed` swaps the axes: yield on X, grad rate on Y.
export function scatterPlot({data, query, yieldFloor, gradFloor, cardArea, programsByUnitid, reversed = false}) {
  const match = d => query && d.INSTNM.toLowerCase().includes(query);

  const baseColor = d => d.sector_label === "Public" ? "#d50000" : "#1d4ed8";
  const hiColor   = d => d.sector_label === "Public" ? "#7f0000" : "#1e3a8a";

  const gradAxis  = {key: "grad_rate_6yr", floor: gradFloor,  end: GRAD_END,  label: "6-year graduation rate", name: "grad-rate"};
  const yieldAxis = {key: "yield_rate",    floor: yieldFloor, end: YIELD_END, label: "Yield (admitted students who chose to attend)", name: "yield"};
  const xAx = reversed ? yieldAxis : gradAxis;
  const yAx = reversed ? gradAxis : yieldAxis;

  const yieldMax = d3.max(data, d => d.yield_rate);

  // Grid of 5x5 cells, in grad/yield terms regardless of orientation.
  const grid = [];
  for (let g1 = gradFloor; g1 < GRAD_END; g1 += STEP) {
    for (let y1 = yieldFloor; y1 < YIELD_END; y1 += STEP) {
      grid.push({g1, g2: g1 + STEP, y1, y2: y1 + STEP});
    }
  }

  // Counts per bin along one axis. Yield bins stop at yieldMax so we don't label empty bins at the edge.
  function binCounts(ax) {
    const stop = ax === yieldAxis ? Math.ceil(yieldMax / STEP) * STEP : ax.end;
    return d3.range(ax.floor, stop, STEP).map(b1 => ({
      pos: b1 + STEP / 2,
      count: data.filter(d => d[ax.key] >= b1 && d[ax.key] < b1 + STEP).length,
    }));
  }
  const xCounts = binCounts(xAx);  // labelled across the top
  const yCounts = binCounts(yAx);  // labelled down the right side

  const stackKeys = new Set(), dupeKeys = new Set();
  for (const d of data) {
    const key = `${d.grad_rate_6yr}|${d.yield_rate}`;
    if (stackKeys.has(key)) dupeKeys.add(key); else stackKeys.add(key);
  }
  const isDupe = d => dupeKeys.has(`${d.grad_rate_6yr}|${d.yield_rate}`);

  const marginLeft = 65, marginRight = 45, marginTop = 36, marginBottom = 50;
  const plotWidth = 860, plotHeight = 720;

  const px = d => d[xAx.key], py = d => d[yAx.key];
  const matches = data.filter(match);

  const dotOpts = symbol => ({
    x: px,
    y: py,
    r: d => match(d) ? 7 : 5,
    symbol,
    fill: d => match(d) ? hiColor(d) : baseColor(d),
    fillOpacity: d => match(d) ? 0.9 : (query ? 0.15 : 0.6),
    stroke: "none",
  });

  const plt = Plot.plot({
    width: plotWidth,
    height: plotHeight,
    marginLeft,
    marginBottom,
    marginTop,
    marginRight,
    x: { label: null, domain: [xAx.floor, xAx.end], ticks: d3.range(xAx.floor, xAx.end + 1, 5), tickFormat: d => d + "%" },
    y: { label: null, domain: [yAx.floor, yAx.end], ticks: d3.range(yAx.floor, yAx.end + 1, 5), tickFormat: d => d + "%" },
    marks: [
      Plot.rect(grid, {
        x1: d => reversed ? d.y1 : d.g1, x2: d => reversed ? d.y2 : d.g2,
        y1: d => reversed ? d.g1 : d.y1, y2: d => reversed ? d.g2 : d.y2,
        fill: d => cellShade(d.g1, d.y1),
      }),
      Plot.dot(data.filter(d => !isDupe(d)), dotOpts("circle")),
      Plot.dot(data.filter(isDupe), dotOpts("diamond")),
      Plot.ruleX(matches, {x: px, y1: yAx.floor, y2: py, stroke: "#16a34a", strokeWidth: 1, strokeDasharray: "4,3"}),
      Plot.ruleY(matches, {y: py, x1: xAx.floor, x2: px, stroke: "#16a34a", strokeWidth: 1, strokeDasharray: "4,3"}),
      Plot.text(matches, {x: px, y: py, text: "INSTNM", dy: -10, fontSize: 11, fontWeight: "600", fill: "#111", stroke: "white", strokeWidth: 3, paintOrder: "stroke"}),
      Plot.text(xCounts, {x: "pos", y: yAx.end, text: "count", textAnchor: "middle", lineAnchor: "bottom", dy: -4, fontSize: 9, fontFamily: "sans-serif", fill: "#888", clip: false}),
      Plot.gridX({ticks: d3.range(xAx.floor, xAx.end + 1, 5)}),
      Plot.gridY({ticks: d3.range(yAx.floor, yAx.end + 1, 5)}),
    ],
  });

  const svgEl = plt.tagName === "svg" ? plt : plt.querySelector("svg");

  // Rotate the dupe-diamond dot layer 90° so the long axis is horizontal.
  // The second g[aria-label="dot"] in the SVG is the dupe layer.
  const dotGroups = svgEl.querySelectorAll("g[aria-label='dot']");
  if (dotGroups[1]) {
    for (const path of dotGroups[1].querySelectorAll("path")) {
      const t = path.getAttribute("transform") || "";
      path.setAttribute("transform", t + " rotate(90)");
    }
  }

  const xs = plt.scale("x");
  const ys = plt.scale("y");
  const xRange = xs.range;

  function svgText(text, attrs) {
    const t = document.createElementNS(ns, "text");
    for (const [k, v] of Object.entries(attrs)) t.setAttribute(k, v);
    t.textContent = text;
    svgEl.appendChild(t);
    return t;
  }

  // Y-axis label
  const plotCenterY = (marginTop + (plotHeight - marginBottom)) / 2;
  svgText(yAx.label, {
    transform: `translate(22, ${plotCenterY}) rotate(-90)`, "text-anchor": "middle",
    "font-size": 11, "font-family": "sans-serif", fill: "#555",
  });

  // X-axis label
  const plotCenterX = (marginLeft + (plotWidth - marginRight)) / 2;
  svgText(xAx.label, {
    x: plotCenterX, y: plotHeight - 8, "text-anchor": "middle",
    "font-size": 11, "font-family": "sans-serif", fill: "#555",
  });

  // "Number of schools in each column" label across the top
  svgText(`Number of schools in each ${xAx.name} column`, {
    x: plotCenterX, y: 11, "text-anchor": "middle",
    "font-size": 9, "font-family": "sans-serif", fill: "#888",
  });

  // Row counts to the right of the plot
  for (const row of yCounts) {
    svgText(String(row.count), {
      x: xRange[1] + 8, y: ys.apply(row.pos), "text-anchor": "start", "dominant-baseline": "middle",
      "font-size": 9, "font-family": "sans-serif", fill: "#888",
    });
  }

  // "Number of schools in each row" label down the right side
  svgText(`Number of schools in each ${yAx.name} row`, {
    transform: `translate(${xRange[1] + 36}, ${plotCenterY}) rotate(90)`, "text-anchor": "middle",
    "font-size": 9, "font-family": "sans-serif", fill: "#888",
  });

  const tipEl = document.createElement("div");
  tipEl.style.cssText = "position:absolute; display:none; background:white; border:1px solid #ddd; border-radius:6px; padding:0.4rem 0.65rem; font-size:0.8rem; pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.12); max-width:260px; line-height:1.5;";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative; display:inline-block;";
  wrapper.append(plt, tipEl);

  // All schools at the exact same yield_rate × grad_rate_6yr position
  const stackAt = d => data.filter(e => e.yield_rate === d.yield_rate && e.grad_rate_6yr === d.grad_rate_6yr);

  function nearestTo(evt) {
    const rect = plt.getBoundingClientRect();
    const mx = evt.clientX - rect.left, my = evt.clientY - rect.top;
    let nearest = null, minDist = Infinity;
    for (const d of data) {
      const dx = xs.apply(px(d)) - mx, dy = ys.apply(py(d)) - my;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) { minDist = dist; nearest = d; }
    }
    return {nearest, minDist, mx, my};
  }

  plt.addEventListener("pointermove", evt => {
    const {nearest, minDist, mx, my} = nearestTo(evt);
    if (nearest && minDist < 100) {
      const stack = stackAt(nearest);
      const sector = nearest.sector_label === "Public" ? "Public" : "Private";
      if (stack.length === 1) {
        tipEl.innerHTML = `<strong>${nearest.INSTNM}</strong><br>${sector} · ${nearest.CITY}, ${nearest.STABBR}<br><span style="color:#555">Grad: ${nearest.grad_rate_6yr}% &nbsp;·&nbsp; Yield: ${nearest.yield_rate}%</span>`;
      } else {
        tipEl.innerHTML = `<strong>${stack.length} schools</strong> · ${nearest.yield_rate}% yield, ${nearest.grad_rate_6yr}% grad<br><span style="color:#555">${stack.map(s => s.INSTNM).join("<br>")}</span>`;
      }
      tipEl.style.left = (mx + 14) + "px";
      tipEl.style.top  = (my - 10) + "px";
      tipEl.style.display = "block";
    } else {
      tipEl.style.display = "none";
    }
  });

  plt.addEventListener("pointerleave", () => { tipEl.style.display = "none"; });

  plt.addEventListener("click", evt => {
    const {nearest, minDist} = nearestTo(evt);
    if (nearest && minDist < 100) {
      for (const school of stackAt(nearest)) {
        cardArea.addSchool(school, (programsByUnitid.get(String(school.UNITID)) || []).slice(0, 5));
      }
    }
  });

  // Legend: upper-left corner of plot area (lower-right when reversed, where the dots are sparse)
  // d3 diamond for r=5: M0,-8.25 L4.76,0 L0,8.25 L-4.76,0 — height/width ratio = sqrt(3)
  const legW = 185, legPad = 7, legShapeR = 4;
  const legDiamondHH = legShapeR * (8.25 / 4.76); // half-height matching d3 ratio ≈ 6.93
  const legRow1Y = 13;   // relative to legRectY
  const legRow2Y = 33;   // enough clearance for diamond half-height above
  const legH = legRow2Y + Math.ceil(legDiamondHH) + legPad;
  const legRectX = reversed ? plotWidth - marginRight - legW - 8 : marginLeft + 8;
  const legRectY = reversed ? plotHeight - marginBottom - legH - 8 : marginTop + 8;
  const legShapeX = legRectX + legPad + legShapeR;
  const legTextX  = legRectX + legPad + legShapeR * 2 + 6;

  const r1Y = legRectY + legRow1Y, r2Y = legRectY + legRow2Y;

  const legBg = document.createElementNS(ns, "rect");
  legBg.setAttribute("x", legRectX); legBg.setAttribute("y", legRectY);
  legBg.setAttribute("width", legW); legBg.setAttribute("height", legH);
  legBg.setAttribute("fill", "white"); legBg.setAttribute("stroke", "#ccc");
  legBg.setAttribute("stroke-width", "1"); legBg.setAttribute("rx", "3");
  svgEl.appendChild(legBg);

  const legCircle = document.createElementNS(ns, "circle");
  legCircle.setAttribute("cx", legShapeX); legCircle.setAttribute("cy", r1Y);
  legCircle.setAttribute("r", legShapeR); legCircle.setAttribute("fill", "#888");
  legCircle.setAttribute("fill-opacity", "0.6");
  svgEl.appendChild(legCircle);

  const legLabelAttrs = {"font-size": 9, "font-family": "sans-serif", fill: "#555", "dominant-baseline": "middle", "text-anchor": "start"};
  svgText("One school at this position", {x: legTextX, y: r1Y, ...legLabelAttrs});

  const legDiamond = document.createElementNS(ns, "path");
  legDiamond.setAttribute("d", `M${legShapeX - legDiamondHH},${r2Y} L${legShapeX},${r2Y - legShapeR} L${legShapeX + legDiamondHH},${r2Y} L${legShapeX},${r2Y + legShapeR} Z`);
  legDiamond.setAttribute("fill", "#888"); legDiamond.setAttribute("fill-opacity", "0.6");
  svgEl.appendChild(legDiamond);

  svgText("Two+ schools at this position", {x: legTextX, y: r2Y, ...legLabelAttrs});

  return wrapper;
}
