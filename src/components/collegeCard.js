import { html } from "npm:htl";

const TIERS = ["definitely", "probably", "maybe"];

export function getDeck() {
  try {
    const raw = JSON.parse(localStorage.getItem("college-deck") || "{}");
    if (Array.isArray(raw)) return { definitely: new Set(), probably: new Set(), maybe: new Set(raw) };
    return {
      definitely: new Set(raw.definitely || []),
      probably:   new Set(raw.probably   || []),
      maybe:      new Set(raw.maybe      || []),
    };
  } catch { return { definitely: new Set(), probably: new Set(), maybe: new Set() }; }
}

export function saveDeck(deck) {
  localStorage.setItem("college-deck", JSON.stringify({
    definitely: [...deck.definitely],
    probably:   [...deck.probably],
    maybe:      [...deck.maybe],
  }));
}

export function getTier(unitid) {
  const deck = getDeck();
  for (const tier of TIERS) if (deck[tier].has(unitid)) return tier;
  return null;
}

// schoolPrograms: [{cip_family, cip_label, total_awards}] for this school only
// cipSchoolCounts: Map<cip_family, number> — how many schools offer each family
export function collegeCard(school, schoolPrograms = [], cipSchoolCounts = new Map()) {
  if (!school) return html``;

  const pct    = (v, decimals = 0) => v != null ? `${Number(v).toFixed(decimals)}%` : "—";
  const num    = (v) => v != null ? Number(v).toLocaleString() : "—";

  const rate = school.admission_rate;
  function admissionHue(r) {
    // 3% (most selective) → hue 18 (orangey-red)
    // 100% (open admission) → hue 142 (green)
    const t = Math.max(0, Math.min(1, (r - 3) / (100 - 3)));
    return 18 + t * (142 - 18);
  }
  const headerBg    = rate == null ? "#e5e7eb" : `hsl(${admissionHue(rate)}, 68%, 88%)`;
  const headerColor = rate == null ? "#374151" : `hsl(${admissionHue(rate)}, 72%, 28%)`;

  // ── Section 1: header stats ──────────────────────────────────────────────
  const statItems = [
    school.sector_label,
    school.locale_group,
    school.enrollment_ug != null ? `${num(school.enrollment_ug)} undergrads` : null,
    school.yield_rate    != null ? `${pct(school.yield_rate)} yield`         : null,
    school.grad_rate_6yr != null ? `${pct(school.grad_rate_6yr)} grad`       : null,
    school.HBCU === 1 ? "HBCU" : null,
  ].filter(Boolean);

  const header = html`<div style="background:${headerBg}; padding:0.75rem 1rem 0.65rem;">
    <strong style="color:${headerColor}; font-size:0.95rem; line-height:1.3; display:block;">${school.INSTNM}</strong>
    <div style="color:${headerColor}; opacity:0.8; font-size:0.78rem; margin-top:0.1rem;">${school.CITY}, ${school.STABBR}</div>
    <div style="margin-top:0.45rem; display:flex; flex-wrap:wrap; gap:0.3rem;">
      ${statItems.map(s => html`<span style="font-size:0.72rem; background:${headerColor}22; color:${headerColor}; border-radius:3px; padding:0.1rem 0.35rem; font-weight:500;">${s}</span>`)}
    </div>
  </div>`;

  // ── Section 2: majors ────────────────────────────────────────────────────
  const topMajors = [...schoolPrograms]
    .sort((a, b) => b.total_awards - a.total_awards)
    .slice(0, 5);
  const distinctiveMajors = [...schoolPrograms]
    .sort((a, b) => (cipSchoolCounts.get(a.cip_family) || 999) - (cipSchoolCounts.get(b.cip_family) || 999))
    .slice(0, 5);

  const majorsSection = schoolPrograms.length === 0 ? html`` : html`<div style="padding:0.6rem 1rem; border-bottom:1px solid #f0f0f0; font-size:0.78rem; color:#444;">
    <div style="margin-bottom:0.3rem;"><span style="font-weight:600; color:#555;">Top majors:</span> ${topMajors.map(p => p.cip_label).join(", ")}</div>
    <div><span style="font-weight:600; color:#555;">Distinctive:</span> ${distinctiveMajors.map(p => p.cip_label).join(", ")}</div>
  </div>`;

  // ── Section 3: external links ────────────────────────────────────────────
  const websiteUrl = school.WEBADDR
    ? (school.WEBADDR.startsWith("http") ? school.WEBADDR : "https://" + school.WEBADDR)
    : null;
  const wikiUrl   = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(school.INSTNM)}&go=Go`;
  const usnewsUrl = `https://www.usnews.com/best-colleges/search?name=${encodeURIComponent(school.INSTNM)}`;

  const externalLinks = html`<div style="padding:0.5rem 1rem; border-bottom:1px solid #f0f0f0; display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.78rem;">
    ${websiteUrl ? html`<a href="${websiteUrl}" target="_blank" rel="noopener" style="color:#2563eb;">Website ↗</a>` : html``}
    <a href="${wikiUrl}"   target="_blank" rel="noopener" style="color:#2563eb;">Wikipedia ↗</a>
    <a href="${usnewsUrl}" target="_blank" rel="noopener" style="color:#2563eb;">US News ↗</a>
  </div>`;

  // ── Section 4: internal profile link ────────────────────────────────────
  const profileLink = html`<div style="padding:0.45rem 1rem; border-bottom:1px solid #f0f0f0; font-size:0.78rem;">
    <a href="/schools?id=${school.UNITID}" style="color:#2563eb;">Full profile on this site →</a>
  </div>`;

  // ── Section 5: save to deck ──────────────────────────────────────────────
  const tierStyles = {
    definitely: { active: { bg: "#dcfce7", color: "#166534", border: "#86efac" }, label: "Definitely" },
    probably:   { active: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" }, label: "Probably"   },
    maybe:      { active: { bg: "#fef9c3", color: "#854d0e", border: "#fde047" }, label: "Maybe"      },
  };
  const inactiveStyle = "background:#f9fafb; color:#6b7280; border-color:#e5e7eb;";

  const saveSection = html`<div style="padding:0.5rem 1rem; display:flex; gap:0.4rem;">
    ${TIERS.map(tier => {
      const s = tierStyles[tier];
      const btn = html`<button data-tier="${tier}" style="flex:1; font-size:0.75rem; padding:0.3rem 0.2rem; border-radius:4px; border:1px solid; cursor:pointer; font-weight:500; transition:all 0.1s;">${s.label}</button>`;
      return btn;
    })}
  </div>`;

  const card = html`<div style="border:1px solid #ddd; border-radius:8px; overflow:hidden; font-size:0.9rem; background:var(--theme-background,#fff);">
    ${header}
    ${majorsSection}
    ${externalLinks}
    ${profileLink}
    ${saveSection}
  </div>`;

  function updateTierButtons() {
    const currentTier = getTier(school.UNITID);
    for (const btn of card.querySelectorAll("[data-tier]")) {
      const tier = btn.dataset.tier;
      const s = tierStyles[tier].active;
      if (tier === currentTier) {
        btn.style.background = s.bg;
        btn.style.color = s.color;
        btn.style.borderColor = s.border;
      } else {
        btn.style.cssText += inactiveStyle;
      }
    }
  }

  for (const btn of card.querySelectorAll("[data-tier]")) {
    btn.onclick = () => {
      const deck = getDeck();
      const currentTier = getTier(school.UNITID);
      for (const t of TIERS) deck[t].delete(school.UNITID);
      if (btn.dataset.tier !== currentTier) deck[btn.dataset.tier].add(school.UNITID);
      saveDeck(deck);
      updateTierButtons();
      card.dispatchEvent(new CustomEvent("deck-changed", { bubbles: true, detail: { unitid: school.UNITID } }));
    };
  }

  updateTierButtons();
  return card;
}
