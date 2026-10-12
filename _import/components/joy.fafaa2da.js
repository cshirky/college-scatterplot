import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";
import {STEP, YIELD_END, buildCells, cellHtml, addCellToTray, makeTip} from "./cells.55d7d74d.js";

const ns = "http://www.w3.org/2000/svg";

// Joy (ridgeline) plot: one horizontal line per grad-rate row; the line's height at each
// yield column is the number of schools in that grid square.
export function joyPlot({data, query, yieldFloor, gradFloor, cardArea, programsByUnitid}) {
  const {gradBins, yieldBins, grid, cellOf, maxCount} = buildCells(data, yieldFloor, gradFloor);
  const nRows = gradBins.length;

  const W = 860, H = 720;
  const marginLeft = 65, marginRight = 45, marginBottom = 50, topPad = 30;
  const overlap = 4.5;                      // tallest peak, in row pitches
  const bottomY = H - marginBottom;
  const pitch = (bottomY - topPad) / (nRows - 1 + overlap);
  const baseline = r => bottomY - r * pitch;  // r = 0 is the lowest-grad row
  const x = d3.scaleLinear([yieldFloor, YIELD_END], [marginLeft, W - marginRight]);
  const peakH = count => (count / maxCount) * overlap * pitch;

  const svg = d3.create("svg")
    .attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`)
    .style("max-width", "100%").style("height", "auto").style("font-family", "sans-serif");

  // Vertical gridlines and yield ticks
  for (const g of d3.range(yieldFloor, YIELD_END + 1, STEP)) {
    svg.append("line").attr("x1", x(g)).attr("x2", x(g)).attr("y1", topPad).attr("y2", bottomY)
      .attr("stroke", "#e5e7eb");
    svg.append("text").attr("x", x(g)).attr("y", bottomY + 16).attr("text-anchor", "middle")
      .attr("font-size", 11).attr("fill", "#555").text(g + "%");
  }
  // Grad-rate ticks sit on each row's baseline (the bottom edge of that row's 5-point band)
  for (let r = 0; r <= nRows; r++) {
    svg.append("text").attr("x", marginLeft - 8).attr("y", baseline(r)).attr("text-anchor", "end")
      .attr("dominant-baseline", "middle").attr("font-size", 11).attr("fill", "#555")
      .text(gradFloor + r * STEP + "%");
  }
  svg.append("text").attr("x", (marginLeft + W - marginRight) / 2).attr("y", H - 8)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555").text("Yield (admitted students who chose to attend)");
  svg.append("text").attr("transform", `translate(22, ${(topPad + bottomY) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555")
    .text("6-year graduation rate");

  const area = d3.area().curve(d3.curveMonotoneX).x(p => x(p.g)).y0(p => p.base).y1(p => p.top);

  const highlight = svg.append("rect").attr("fill", "#f59e0b").attr("fill-opacity", 0.35)
    .attr("pointer-events", "none").style("display", "none");
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative; display:inline-block; max-width:100%;";
  const tip = makeTip();

  const colAt = evt => {
    const rect = svg.node().getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (W / rect.width);
    return Math.max(0, Math.min(yieldBins.length - 1, Math.floor((x.invert(sx) - yieldFloor) / STEP)));
  };

  // Highest-yield row first, so lower rows paint over it.
  const rowGroups = [];
  for (let r = nRows - 1; r >= 0; r--) {
    const base = baseline(r);
    const pts = [
      {g: yieldFloor, base, top: base},
      ...yieldBins.map((y1, yi) => ({g: y1 + STEP / 2, base, top: base - peakH(grid[yi][r].length)})),
      {g: YIELD_END, base, top: base},
    ];
    const g = svg.append("g");
    g.append("line").attr("x1", x(yieldFloor)).attr("x2", x(YIELD_END)).attr("y1", base).attr("y2", base)
      .attr("stroke", "#cbd5e1");
    const path = g.append("path").attr("d", area(pts))
      .attr("fill", "#1d4ed8").attr("fill-opacity", 0.25)
      .attr("stroke", "#1e3a8a").attr("stroke-width", 1.3).attr("stroke-linejoin", "round")
      .style("cursor", "pointer");
    rowGroups.push(path);

    path.on("pointermove", evt => {
      const yi = colAt(evt);
      const schools = grid[yi][r];
      path.attr("fill-opacity", 0.45);
      highlight.style("display", null)
        .attr("x", x(yieldBins[yi])).attr("width", x(yieldBins[yi] + STEP) - x(yieldBins[yi]))
        .attr("y", base - Math.max(peakH(schools.length), 3)).attr("height", Math.max(peakH(schools.length), 3));
      highlight.raise();
      tip.show(cellHtml(schools, gradBins[r], yieldBins[yi]), evt, wrapper);
    });
    path.on("pointerleave", () => {
      path.attr("fill-opacity", 0.25);
      highlight.style("display", "none");
      tip.hide();
    });
    path.on("click", evt => {
      addCellToTray(cardArea, grid[colAt(evt)][r], programsByUnitid);
    });
  }

  // Search matches: mark the school's square at the top of its ridge.
  if (query) {
    const hits = data.filter(d => d.INSTNM.toLowerCase().includes(query) && cellOf.has(d));
    const seen = new Map();
    for (const d of hits) {
      const [gi, yi] = cellOf.get(d);
      const k = `${gi}|${yi}`;
      const n = seen.get(k) || 0;
      seen.set(k, n + 1);
      const cx = x(yieldBins[yi] + STEP / 2);
      const cy = baseline(gi) - peakH(grid[yi][gi].length);
      svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 5)
        .attr("fill", "#16a34a").attr("stroke", "white").attr("stroke-width", 1.5).attr("pointer-events", "none");
      svg.append("text").attr("x", cx).attr("y", cy - 9 - n * 12).attr("text-anchor", "middle")
        .attr("font-size", 11).attr("font-weight", 600).attr("fill", "#111")
        .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .attr("pointer-events", "none").text(d.INSTNM);
    }
  }

  // Scale note
  svg.append("text").attr("x", W - marginRight).attr("y", 14).attr("text-anchor", "end")
    .attr("font-size", 10).attr("fill", "#888")
    .text(`Peak height = schools in a 5×5-point square (tallest here: ${maxCount})`);

  wrapper.append(svg.node(), tip.el);
  return wrapper;
}
