import { collegeCard } from "./collegeCard.48785337.js";

// Bottom tray of school chips + modal card. Returns {addSchool(school, majors)}.
export function createCardArea({usGeo, emptyText = "Click any dot to see a school"}) {
  document.getElementById("college-tray")?.remove();
  document.getElementById("college-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "college-modal";
  modal.style.cssText = "position:fixed; bottom:60px; left:50%; transform:translateX(-50%); width:min(600px, calc(100vw - 2rem)); max-height:calc(100vh - 80px); overflow-y:auto; z-index:1001; display:none;";
  modal.onclick = e => e.stopPropagation();

  const tray = document.createElement("div");
  tray.id = "college-tray";
  tray.style.cssText = "position:fixed; bottom:0; left:0; right:0; z-index:1000; background:#fff; border-top:2px solid #e5e7eb; box-shadow:0 -2px 12px rgba(0,0,0,0.1); display:flex; align-items:center; gap:0.5rem; padding:0.4rem 1rem; min-height:52px; flex-wrap:wrap;";
  document.body.style.marginBottom = "60px";

  const trayEmpty = document.createElement("span");
  trayEmpty.textContent = emptyText;
  trayEmpty.style.cssText = "font-size:0.8rem; color:#aaa; font-style:italic;";

  const trayChips = document.createElement("div");
  trayChips.style.cssText = "display:flex; gap:0.5rem; flex-wrap:wrap; flex:1; align-items:center;";

  const deckLink = document.createElement("a");
  deckLink.textContent = "My Deck";
  deckLink.style.cssText = "font-size:0.8rem; font-weight:600; color:#2563eb; text-decoration:none; white-space:nowrap; padding:0.2rem 0.5rem; border:1px solid #93c5fd; border-radius:4px; background:#dbeafe;";

  function getStarred() {
    try { return new Set(JSON.parse(localStorage.getItem("tray-starred") || "[]").map(String)); }
    catch { return new Set(); }
  }
  function setStarred(set) {
    localStorage.setItem("tray-starred", JSON.stringify([...set]));
  }
  function updateDeckLink() {
    const ids = [...getStarred()];
    deckLink.href = ids.length ? `/my-deck?ids=${ids.join(",")}` : "/my-deck";
  }
  updateDeckLink();

  tray.append(trayEmpty, trayChips, deckLink);
  document.body.append(modal, tray);
  document.addEventListener("click", () => {
    modal.style.display = "none";
    trayChips.querySelectorAll("[data-unitid]").forEach(c => c.style.background = c.dataset.basebg);
    activeChip = null;
  });

  let activeChip = null;

  return {
    addSchool(school, majors) {
      const key = String(school.UNITID);
      const existing = trayChips.querySelector(`[data-unitid="${key}"]`);
      if (existing) { existing.click(); return; }

      trayEmpty.style.display = "none";

      const isPublic = school.sector_label === "Public";
      const chipBg      = isPublic ? "#fee2e2" : "#dbeafe";
      const chipBorder  = isPublic ? "#fca5a5" : "#93c5fd";
      const chipActiveBg = isPublic ? "#fecaca" : "#bfdbfe";
      const chipColor   = isPublic ? "#7f0000" : "#1e3a8a";

      const chip = document.createElement("div");
      chip.dataset.unitid = key;
      chip.dataset.basebg = chipBg;
      chip.style.cssText = `display:inline-flex; align-items:center; gap:0.25rem; background:${chipBg}; border:1px solid ${chipBorder}; border-radius:999px; padding:0.2rem 0.45rem 0.2rem 0.75rem; font-size:0.78rem; white-space:nowrap; user-select:none;`;

      const nameEl = document.createElement("span");
      nameEl.style.cssText = `font-weight:600; color:${chipColor}; cursor:pointer;`;
      nameEl.textContent = school.INSTNM.replace(/\bUniversity\b/g, "U.").replace(/\bCollege\b/g, "Col.");
      chip.append(nameEl);

      const statsEl = document.createElement("span");
      statsEl.style.cssText = "font-size:0.7rem; color:#555; margin-left:0.15rem;";
      statsEl.textContent = ` ${Math.round(school.yield_rate)}%Y ${Math.round(school.grad_rate_6yr)}%G`;
      chip.append(statsEl);

      const isSaved = () => getStarred().has(key);

      const btnStyle = "background:none; border:none; cursor:pointer; line-height:1; padding:0 0.15rem; margin-left:0.1rem;";

      const saveBtn = document.createElement("button");
      saveBtn.title = "Save";
      saveBtn.style.cssText = btnStyle + " font-size:1rem;";
      saveBtn.textContent = isSaved() ? "★" : "☆";
      saveBtn.style.color = isSaved() ? "#f59e0b" : "#9ca3af";
      saveBtn.onclick = e => {
        e.stopPropagation();
        const starred = getStarred();
        if (starred.has(key)) { starred.delete(key); saveBtn.textContent = "☆"; saveBtn.style.color = "#9ca3af"; }
        else                  { starred.add(key);    saveBtn.textContent = "★"; saveBtn.style.color = "#f59e0b"; }
        setStarred(starred);
        updateDeckLink();
      };
      chip.append(saveBtn);

      const expandBtn = document.createElement("button");
      expandBtn.title = "Expand";
      expandBtn.style.cssText = btnStyle + " font-size:0.85rem; color:#6b7280;";
      expandBtn.textContent = "⤢";
      expandBtn.onclick = e => {
        e.stopPropagation();
        trayChips.querySelectorAll("[data-unitid]").forEach(c => c.style.background = c.dataset.basebg);
        modal.innerHTML = "";
        modal.append(collegeCard(school, majors, {
          usGeo,
          onClose: () => { modal.style.display = "none"; chip.style.background = chipBg; activeChip = null; },
        }));
        modal.style.display = "block";
        chip.style.background = chipActiveBg;
        activeChip = key;
      };
      chip.append(expandBtn);

      const xBtn = document.createElement("button");
      xBtn.title = "Remove";
      xBtn.textContent = "×";
      xBtn.style.cssText = btnStyle + " font-size:1.1rem; color:#9ca3af;";
      xBtn.onclick = e => {
        e.stopPropagation();
        chip.remove();
        if (activeChip === key) { modal.style.display = "none"; activeChip = null; }
        if (!trayChips.querySelector("[data-unitid]")) trayEmpty.style.display = "";
      };
      chip.append(xBtn);

      chip.onclick = e => {
        e.stopPropagation();
        if (activeChip === key) {
          modal.style.display = "none";
          chip.style.background = chipBg;
          activeChip = null;
          return;
        }
        trayChips.querySelectorAll("[data-unitid]").forEach(c => c.style.background = c.dataset.basebg);
        modal.innerHTML = "";
        modal.append(collegeCard(school, majors, {
          usGeo,
          onClose: () => { modal.style.display = "none"; chip.style.background = chipBg; activeChip = null; },
        }));
        modal.style.display = "block";
        chip.style.background = chipActiveBg;
        activeChip = key;
      };

      trayChips.append(chip);
      chip.click();
    }
  };
}
