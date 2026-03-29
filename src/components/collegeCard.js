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
  const dollar = (v) => v != null ? "$" + Math.round(Number(v)).toLocaleString() : "—";

  const rate = school.admission_rate;
  function admissionHue(r) {
    // 0.003 (most selective) → hue 18 (orangey-red)
    // 1.0 (open admission) → hue 142 (green)
    // Handle both 0–1 and 0–100 scales
    const normalized = r > 1 ? r / 100 : r;
    const t = Math.max(0, Math.min(1, (normalized - 0.03) / (1.0 - 0.03)));
    return 18 + t * (142 - 18);
  }
  const headerBg    = rate == null ? "#e5e7eb" : `hsl(${admissionHue(rate)}, 68%, 88%)`;
  const headerColor = rate == null ? "#374151" : `hsl(${admissionHue(rate)}, 72%, 28%)`;

  // ── Section 1: header stats ──────────────────────────────────────────────
  const admRate = rate != null
    ? (rate > 1 ? `${rate.toFixed(1)}% admit` : `${(rate * 100).toFixed(1)}% admit`)
    : null;
  const statItems = [
    school.sector_label,
    school.locale_group || null,
    school.enrollment_ug != null ? `${num(school.enrollment_ug)} undergrads` : null,
    school.yield_rate    != null ? `${pct(school.yield_rate)} yield`         : null,
    school.grad_rate_6yr != null ? `${pct(school.grad_rate_6yr)} grad`       : null,
    admRate,
    +school.hbcu === 1 ? "HBCU" : null,
    +school.hsi  === 1 ? "HSI"  : null,
    +school.womenonly === 1 ? "Women's" : null,
    +school.tribal === 1 ? "Tribal" : null,
  ].filter(Boolean);

  const header = html`<div style="background:${headerBg}; padding:0.75rem 1rem 0.65rem;">
    <strong style="color:${headerColor}; font-size:0.95rem; line-height:1.3; display:block;">${school.INSTNM}</strong>
    <div style="color:${headerColor}; opacity:0.8; font-size:0.78rem; margin-top:0.1rem;">${school.CITY}, ${school.STABBR}</div>
    <div style="margin-top:0.45rem; display:flex; flex-wrap:wrap; gap:0.3rem;">
      ${statItems.map(s => html`<span style="font-size:0.72rem; background:${headerColor}22; color:${headerColor}; border-radius:3px; padding:0.1rem 0.35rem; font-weight:500;">${s}</span>`)}
    </div>
  </div>`;

  // ── Section 2: Carnegie classification ───────────────────────────────────
  const carnegieItems = [
    school.ic2025name     ? html`<div style="font-size:0.75rem; color:#555;"><span style="color:#888;">Type:</span> ${school.ic2025name}</div>` : html``,
    school.saec2025name   ? html`<div style="font-size:0.75rem; color:#555;"><span style="color:#888;">SAEC:</span> ${school.saec2025name}</div>` : html``,
    school.research2025name ? html`<div style="font-size:0.75rem; color:#555;"><span style="color:#888;">Research:</span> ${school.research2025name}</div>` : html``,
    school.setting2025name  ? html`<div style="font-size:0.75rem; color:#555;"><span style="color:#888;">Setting:</span> ${school.setting2025name}</div>` : html``,
  ];

  const carnegieSection = (school.ic2025name || school.saec2025name)
    ? html`<div style="padding:0.55rem 1rem; border-bottom:1px solid #f0f0f0;">
        ${carnegieItems}
      </div>`
    : html``;

  // ── Section 3: earnings & equity ─────────────────────────────────────────
  const earningsItems = [];
  if (school.saec_earnings) earningsItems.push(`Median earnings: ${dollar(school.saec_earnings)}`);
  if (school.earnings_ratio) earningsItems.push(`${Number(school.earnings_ratio).toFixed(2)}× vs peers`);
  if (school.net_price) earningsItems.push(`Net price: ${dollar(school.net_price)}`);
  if (school.pell_2023 != null) {
    earningsItems.push(`${(school.pell_2023 * 100).toFixed(1)}% Pell`);
  }

  const earningsSection = earningsItems.length > 0
    ? html`<div style="padding:0.5rem 1rem; border-bottom:1px solid #f0f0f0; font-size:0.76rem; color:#555; display:flex; flex-wrap:wrap; gap:0.5rem 1rem;">
        ${earningsItems.map(e => html`<span>${e}</span>`)}
      </div>`
    : html``;

  // ── Section 4: majors ────────────────────────────────────────────────────
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

  // ── Section 5: external links ────────────────────────────────────────────
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

  // ── Section 6: save to deck ──────────────────────────────────────────────
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
    ${carnegieSection}
    ${earningsSection}
    ${majorsSection}
    ${externalLinks}
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
