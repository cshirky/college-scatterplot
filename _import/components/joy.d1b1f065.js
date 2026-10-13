import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";
import {STEP, YIELD_END, buildCells, cellHtml, addCellToTray, makeTip} from "./cells.dceb64b7.js";

const ns = "http://www.w3.org/2000/svg";

// Each school is drawn as a smooth bell centred on its own yield, one school tall at the centre
// and falling to nothing this many points either side.
const SPREAD = 1;
const bell = dist => 0.5 * (1 + Math.cos(Math.PI * dist / SPREAD));
// Positions sampled per yield point.
const RES = 4;
const EPS = 1e-9;
const fmt = d3.format(".2~f");

// Joy (ridgeline) plot: one horizontal line per 5-point grad-rate row. Along the yield axis each
// school is a bell covering its own yield ± SPREAD points, and the line is the sum of the bells.
export function joyPlot({data, query, yieldFloor, gradFloor, cardArea, programsByUnitid}) {
  const {gradBins, cellOf} = buildCells(data, yieldFloor, gradFloor);
  const nRows = gradBins.length;
  const yields = d3.range(0, (YIELD_END - yieldFloor) * RES + 1).map(i => yieldFloor + i / RES);

  // rows[r] = that row's schools, highest yield first; counts[r][i] = summed bells at yields[i]
  const rows = gradBins.map(() => []);
  for (const [d, [gi]] of cellOf) rows[gi].push(d);
  const counts = rows.map(() => yields.map(() => 0));
  for (const [r, schools] of rows.entries()) {
    schools.sort((a, b) => b.yield_rate - a.yield_rate || a.INSTNM.localeCompare(b.INSTNM));
    for (const d of schools) {
      const lo = Math.ceil((d.yield_rate - SPREAD - yieldFloor) * RES - EPS);
      const hi = Math.floor((d.yield_rate + SPREAD - yieldFloor) * RES + EPS);
      for (let j = Math.max(0, lo); j <= Math.min(yields.length - 1, hi); j++) {
        counts[r][j] += bell(Math.abs(yields[j] - d.yield_rate));
      }
    }
  }
  const maxCount = d3.max(counts, row => d3.max(row)) || 1;
  const indexOf = y => Math.max(0, Math.min(yields.length - 1, Math.round((y - yieldFloor) * RES)));
  const schoolsAt = (r, i) => rows[r].filter(d => Math.abs(d.yield_rate - yields[i]) <= SPREAD + EPS);
  const rangeAt = (r, i) =>
    `${fmt(yields[i] - SPREAD)}–${fmt(yields[i] + SPREAD)}% yield · ${gradBins[r]}–${gradBins[r] + STEP}% grad`;

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
  for (let r = 0; r < nRows; r++) {
    svg.append("text").attr("x", marginLeft - 8).attr("y", baseline(r)).attr("text-anchor", "end")
      .attr("dominant-baseline", "middle").attr("font-size", 11).attr("fill", "#555")
      .text(gradFloor + r * STEP + "%");
  }
  svg.append("text").attr("x", (marginLeft + W - marginRight) / 2).attr("y", H - 8)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555").text("Yield (admitted students who chose to attend)");
  svg.append("text").attr("transform", `translate(22, ${(topPad + bottomY) / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555")
    .text("6-year graduation rate");

  // Only stretches with schools get the filled, outlined ridge; elsewhere just the faint baseline shows.
  const area = d3.area().curve(d3.curveMonotoneX).defined(p => p.on).x(p => x(p.g)).y0(p => p.base).y1(p => p.top);

  const highlight = svg.append("rect").attr("fill", "#f59e0b").attr("fill-opacity", 0.35)
    .attr("pointer-events", "none").style("display", "none");
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative; display:inline-block; max-width:100%;";
  const tip = makeTip();

  const colAt = evt => {
    const rect = svg.node().getBoundingClientRect();
    const sx = (evt.clientX - rect.left) * (W / rect.width);
    return indexOf(x.invert(sx));
  };

  // Highest-yield row first, so lower rows paint over it.
  const rowGroups = [];
  for (let r = nRows - 1; r >= 0; r--) {
    const base = baseline(r);
    const pts = yields.map((g, i) => ({
      g, base, top: base - peakH(counts[r][i]),
      on: counts[r][i] > EPS || counts[r][i - 1] > EPS || counts[r][i + 1] > EPS,  // include the step down to zero
    }));
    const g = svg.append("g");
    g.append("line").attr("x1", x(yieldFloor)).attr("x2", x(YIELD_END)).attr("y1", base).attr("y2", base)
      .attr("stroke", "#cbd5e1").attr("stroke-width", 0.7);
    const path = g.append("path").attr("d", area(pts))
      .attr("fill", "#1d4ed8").attr("fill-opacity", 0.25)
      .attr("stroke", "#1e3a8a").attr("stroke-width", 1.3).attr("stroke-linejoin", "round")
      .style("cursor", "pointer");
    rowGroups.push(path);

    path.on("pointermove", evt => {
      const i = colAt(evt);
      const schools = schoolsAt(r, i);
      const left = Math.max(x(yieldFloor), x(yields[i] - SPREAD));
      const right = Math.min(x(YIELD_END), x(yields[i] + SPREAD));
      path.attr("fill-opacity", 0.45);
      highlight.style("display", null)
        .attr("x", left).attr("width", right - left)
        .attr("y", base - Math.max(peakH(counts[r][i]), 3)).attr("height", Math.max(peakH(counts[r][i]), 3));
      highlight.raise();
      tip.show(cellHtml(schools, gradBins[r], yields[i], rangeAt(r, i)), evt, wrapper);
    });
    path.on("pointerleave", () => {
      path.attr("fill-opacity", 0.25);
      highlight.style("display", "none");
      tip.hide();
    });
    path.on("click", evt => {
      addCellToTray(cardArea, schoolsAt(r, colAt(evt)), programsByUnitid);
    });
  }

  // Search matches: mark the school's own yield at the top of its ridge.
  if (query) {
    const hits = data.filter(d => d.INSTNM.toLowerCase().includes(query) && cellOf.has(d));
    const seen = new Map();
    for (const d of hits) {
      const [gi] = cellOf.get(d);
      const i = indexOf(d.yield_rate);
      const k = `${gi}|${i}`;
      const n = seen.get(k) || 0;
      seen.set(k, n + 1);
      const cx = x(d.yield_rate);
      const cy = baseline(gi) - peakH(counts[gi][i]);
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
    .text(`Height = schools at that yield, each spread over ±${SPREAD} point (tallest here: about ${Math.round(maxCount)})`);

  wrapper.append(svg.node(), tip.el);
  return wrapper;
}
