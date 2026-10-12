import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";
import {STEP, cellShade, buildCells, cellHtml, addCellToTray, makeTip} from "./cells.55d7d74d.js";

const PUBLIC = "#d50000", PRIVATE = "#1d4ed8";

// Isometric 3D version: each 5x5 grid square gets a prism whose height is the number of schools.
// Grad rate runs down-right, yield runs down-left; the near corner is high-yield / high-grad,
// the far corner is low/low, so the tall prisms sit at the back and don't hide the sparse front.
export function isometricPlot({data, query, yieldFloor, gradFloor, cardArea, programsByUnitid}) {
  const {gradBins, yieldBins, grid, cellOf, maxCount} = buildCells(data, yieldFloor, gradFloor);
  const nG = gradBins.length, nY = yieldBins.length;

  const W = 860;
  const c = (W - 150) / (nG + nY);          // half-width of one tile
  const s = c * Math.tan(Math.PI / 6);      // half-height of one tile (true isometric)
  const maxH = 300;
  const originX = 75 + nY * c;
  const originY = maxH + 40;
  const H = Math.ceil(originY + (nG + nY) * s + 70);

  // u = grad column, v = yield row, z = height above the floor
  const P = (u, v, z = 0) => [originX + (u - v) * c, originY + (u + v) * s - z];
  const poly = pts => pts.map(p => p.join(",")).join(" ");

  const svg = d3.create("svg")
    .attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`)
    .style("max-width", "100%").style("height", "auto").style("font-family", "sans-serif");

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:relative; display:inline-block; max-width:100%;";
  const tip = makeTip();

  // Floor tiles
  const floor = svg.append("g");
  for (let v = 0; v < nY; v++) for (let u = 0; u < nG; u++) {
    floor.append("polygon")
      .attr("points", poly([P(u, v), P(u + 1, v), P(u + 1, v + 1), P(u, v + 1)]))
      .attr("fill", cellShade(gradBins[u], yieldBins[v])).attr("stroke", "#d4d4d8").attr("stroke-width", 0.8);
  }

  // Axis ticks along the two front edges
  for (let u = 0; u <= nG; u++) {
    const [px, py] = P(u, nY);
    svg.append("text").attr("x", px - 8).attr("y", py + 10).attr("text-anchor", "end")
      .attr("font-size", 10).attr("fill", "#555").text(gradFloor + u * STEP + "%");
  }
  for (let v = 0; v <= nY; v++) {
    const [px, py] = P(nG, v);
    svg.append("text").attr("x", px + 8).attr("y", py + 10).attr("text-anchor", "start")
      .attr("font-size", 10).attr("fill", "#555").text(yieldFloor + v * STEP + "%");
  }
  const [lx, ly] = P(nG / 2, nY);
  svg.append("text").attr("transform", `translate(${lx - 31}, ${ly + 54}) rotate(30)`)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555").text("6-year graduation rate ▶");
  const [rx, ry] = P(nG, nY / 2);
  svg.append("text").attr("transform", `translate(${rx + 31}, ${ry + 54}) rotate(-30)`)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555")
    .text("◀ Yield (admitted students who chose to attend)");

  // Prisms, far to near (ascending u + v)
  const color = d3.interpolateRgb(PRIVATE, PUBLIC);
  const cells = [];
  for (let v = 0; v < nY; v++) for (let u = 0; u < nG; u++) {
    if (grid[v][u].length) cells.push({u, v, schools: grid[v][u]});
  }
  cells.sort((a, b) => (a.u + a.v) - (b.u + b.v) || a.u - b.u);

  const prisms = svg.append("g");
  for (const {u, v, schools} of cells) {
    const n = schools.length;
    const h = (n / maxCount) * maxH;
    const share = schools.filter(d => d.sector_label === "Public").length / n;
    const top = d3.color(color(share));
    const g = prisms.append("g").style("cursor", "pointer");
    const faces = [
      [[P(u, v + 1), P(u + 1, v + 1), P(u + 1, v + 1, h), P(u, v + 1, h)], top.darker(0.6)],   // left-front
      [[P(u + 1, v + 1), P(u + 1, v), P(u + 1, v, h), P(u + 1, v + 1, h)], top.darker(1.2)],   // right-front
      [[P(u, v, h), P(u + 1, v, h), P(u + 1, v + 1, h), P(u, v + 1, h)], top],                 // top
    ];
    for (const [i, [pts, fill]] of faces.entries()) {
      const isTop = i === 2;
      g.append("polygon").attr("points", poly(pts)).attr("fill", fill.formatRgb())
        .attr("fill-opacity", isTop ? 1 : 0.25).classed("side", !isTop)
        .attr("stroke", fill.darker(0.4).formatRgb()).attr("stroke-opacity", 0.8).attr("stroke-width", 0.8)
        .attr("stroke-linejoin", "round");
    }
    const [tx, ty] = P(u + 0.5, v + 0.5, h);
    g.append("text").attr("x", tx).attr("y", ty).attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("font-size", 10).attr("font-weight", 600).attr("fill", "white").attr("pointer-events", "none").text(n);

    g.on("pointerenter", () => g.selectAll("polygon.side").attr("fill-opacity", 0.5));
    g.on("pointermove", evt => tip.show(cellHtml(schools, gradBins[u], yieldBins[v]), evt, wrapper));
    g.on("pointerleave", () => { g.selectAll("polygon.side").attr("fill-opacity", 0.25); tip.hide(); });
    g.on("click", () => addCellToTray(cardArea, schools, programsByUnitid));
  }

  // Search matches: a pin on the top face of the school's prism
  if (query) {
    const seen = new Map();
    for (const d of data) {
      if (!d.INSTNM.toLowerCase().includes(query) || !cellOf.has(d)) continue;
      const [u, v] = cellOf.get(d);
      const k = `${u}|${v}`;
      const i = seen.get(k) || 0;
      seen.set(k, i + 1);
      const h = (grid[v][u].length / maxCount) * maxH;
      const [px, py] = P(u + 0.5, v + 0.5, h);
      svg.append("line").attr("x1", px).attr("x2", px).attr("y1", py).attr("y2", py - 26)
        .attr("stroke", "#16a34a").attr("stroke-width", 1.5).attr("pointer-events", "none");
      svg.append("circle").attr("cx", px).attr("cy", py - 26).attr("r", 4.5)
        .attr("fill", "#16a34a").attr("stroke", "white").attr("stroke-width", 1.5).attr("pointer-events", "none");
      svg.append("text").attr("x", px).attr("y", py - 36 - i * 12).attr("text-anchor", "middle")
        .attr("font-size", 11).attr("font-weight", 600).attr("fill", "#111")
        .attr("stroke", "white").attr("stroke-width", 3).attr("paint-order", "stroke")
        .attr("pointer-events", "none").text(d.INSTNM);
    }
  }

  // Legend
  const lg = svg.append("g").attr("transform", "translate(16, 16)");
  lg.append("text").attr("font-size", 10).attr("fill", "#888").text("Prism height = number of schools in the square");
  lg.append("text").attr("y", 14).attr("font-size", 10).attr("fill", "#888").text(`Tallest here: ${maxCount}`);
  const defs = svg.append("defs");
  const grad = defs.append("linearGradient").attr("id", "iso-sector");
  grad.append("stop").attr("offset", "0%").attr("stop-color", PRIVATE);
  grad.append("stop").attr("offset", "100%").attr("stop-color", PUBLIC);
  lg.append("rect").attr("y", 26).attr("width", 110).attr("height", 8).attr("rx", 2).attr("fill", "url(#iso-sector)");
  lg.append("text").attr("y", 48).attr("font-size", 10).attr("fill", "#888").text("all private");
  lg.append("text").attr("x", 110).attr("y", 48).attr("text-anchor", "end").attr("font-size", 10).attr("fill", "#888").text("all public");

  wrapper.append(svg.node(), tip.el);
  return wrapper;
}
