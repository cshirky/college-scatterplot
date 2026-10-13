import * as d3 from "../../_npm/d3@7.9.0/080cf928.js";

// Shared grid math for the binned (5pt x 5pt) versions of the scatterplot.

export const STEP = 5;
export const YIELD_END = 90;  // yield axis always runs to 90%
export const GRAD_END = 100;

// Shade levels: 0=darkest … 3=white. Grad columns and yield rows each carry a level;
// cells use whichever is darker (lower index).
const shadeColors = ["#e9e9e9", "#efefef", "#f6f6f6", "white"];
export function cellShade(g1, y1) {
  const gLevel = g1 < 55 ? 0 : g1 < 60 ? 1 : g1 < 65 ? 2 : 3;
  const yLevel = y1 < 15 ? 0 : y1 < 20 ? 1 : y1 < 25 ? 2 : 3;
  return shadeColors[Math.min(gLevel, yLevel)];
}

// grid[yi][gi] is the list of schools in that cell.
export function buildCells(data, yieldFloor, gradFloor) {
  const gradBins = d3.range(gradFloor, GRAD_END, STEP);
  const yieldBins = d3.range(yieldFloor, YIELD_END, STEP);
  const nG = gradBins.length, nY = yieldBins.length;
  const grid = yieldBins.map(() => gradBins.map(() => []));
  const cellOf = new Map();
  for (const d of data) {
    if (d.yield_rate > YIELD_END) continue;
    const gi = Math.min(nG - 1, Math.floor((d.grad_rate_6yr - gradFloor) / STEP));
    const yi = Math.min(nY - 1, Math.floor((d.yield_rate - yieldFloor) / STEP));
    if (gi < 0 || yi < 0) continue;
    grid[yi][gi].push(d);
    cellOf.set(d, [gi, yi]);
  }
  for (const row of grid) for (const cell of row) {
    cell.sort((a, b) => b.yield_rate - a.yield_rate || a.INSTNM.localeCompare(b.INSTNM));
  }
  const maxCount = d3.max(grid, row => d3.max(row, cell => cell.length)) || 1;
  return {gradBins, yieldBins, grid, cellOf, maxCount};
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TRAY_CAP = 10;

export function cellHtml(schools, g1, y1, range = `${y1}–${y1 + STEP}% yield · ${g1}–${g1 + STEP}% grad`) {
  if (!schools.length) return `<strong>No schools</strong><br><span style="color:#555">${range}</span>`;
  const shown = schools.slice(0, 12).map(s => esc(s.INSTNM)).join("<br>");
  const more = schools.length > 12 ? `<br>…and ${schools.length - 12} more` : "";
  const hint = schools.length > TRAY_CAP
    ? `<br><em style="color:#888">Click to add the first ${TRAY_CAP} to the tray</em>`
    : `<br><em style="color:#888">Click to add to the tray</em>`;
  return `<strong>${schools.length} school${schools.length === 1 ? "" : "s"}</strong> · <span style="color:#555">${range}</span><br>${shown}${more}${hint}`;
}

export function addCellToTray(cardArea, schools, programsByUnitid) {
  for (const school of schools.slice(0, TRAY_CAP)) {
    cardArea.addSchool(school, (programsByUnitid.get(String(school.UNITID)) || []).slice(0, 5));
  }
}

export function makeTip() {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute; display:none; background:white; border:1px solid #ddd; border-radius:6px; padding:0.4rem 0.65rem; font-size:0.8rem; pointer-events:none; box-shadow:0 2px 8px rgba(0,0,0,0.12); max-width:280px; line-height:1.5; z-index:10;";
  return {
    el,
    show(htmlText, evt, wrapper) {
      const r = wrapper.getBoundingClientRect();
      el.innerHTML = htmlText;
      el.style.left = (evt.clientX - r.left + 14) + "px";
      el.style.top = (evt.clientY - r.top - 10) + "px";
      el.style.display = "block";
    },
    hide() { el.style.display = "none"; },
  };
}
