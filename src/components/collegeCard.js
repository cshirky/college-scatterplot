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

// ── Prose helpers ────────────────────────────────────────────────────────────

function instKind(school) {
  const ic   = school.ic2025name || "";
  const name = school.INSTNM || "";
  const hasUniv = /university/i.test(name);
  if (/Graduate-Doctorate/i.test(ic))               return hasUniv ? "university" : "doctoral university";
  if (/Graduate-Master/i.test(ic))                  return hasUniv ? "university" : "college";
  if (/Special Focus: Arts and Sciences/i.test(ic)) return "liberal arts college";
  if (/Special Focus: Arts, Music/i.test(ic))       return "arts and design college";
  if (/Special Focus: Business/i.test(ic))          return "business college";
  if (/Special Focus: Medical/i.test(ic))           return "medical school";
  if (/Special Focus: Theolog/i.test(ic))           return "theological school";
  if (/Special Focus: Nursing/i.test(ic))           return "nursing college";
  if (/Special Focus: Technology/i.test(ic))        return "technical college";
  if (/Special Focus: Law/i.test(ic))               return "law school";
  return hasUniv ? "university" : "college";
}

function sectorAdjective(sector) {
  if (/public/i.test(sector))    return "public";
  if (/nonprofit/i.test(sector)) return "private";
  if (/for.profit/i.test(sector)) return "for-profit";
  return "";
}

function localePhrase(locale) {
  return { City: "an urban area", Suburb: "a suburban area", Town: "a small town", Rural: "a rural area" }[locale] || null;
}

function roughEnroll(n) {
  if (n >= 20000) return Math.round(n / 5000) * 5000;
  if (n >= 5000)  return Math.round(n / 1000) * 1000;
  if (n >= 1000)  return Math.round(n / 500) * 500;
  return Math.round(n / 100) * 100;
}

function buildProse(school) {
  const p1 = [], p2 = [];

  // ── Para 1: identity, location, designations, size ───────────────────────
  const kind   = instKind(school);
  const sector = sectorAdjective(school.sector_label || "");
  const locale = localePhrase(school.locale_group);
  const typeStr = sector ? `${sector} ${kind}` : kind;

  let s1 = `${school.INSTNM} is a ${typeStr} in ${school.CITY}, ${school.STABBR}`;
  if (locale) s1 += `, ${locale}`;
  s1 += ".";
  p1.push(s1);

  // Religious affiliation
  const rel = school.relaffil_label;
  if (rel) p1.push(`It is affiliated with the ${rel}.`);

  // Special designations
  const specials = [
    +school.hbcu     === 1 ? "a Historically Black College or University (HBCU)" : null,
    +school.hsi      === 1 ? "a Hispanic-Serving Institution (HSI)" : null,
    +school.womenonly === 1 ? "a women's college" : null,
    +school.tribal   === 1 ? "a Tribal College" : null,
    +school.landgrant === 1 ? "a land-grant institution" : null,
  ].filter(Boolean);
  if (specials.length === 1) p1.push(`It is ${specials[0]}.`);
  else if (specials.length > 1) p1.push(`It is ${specials.slice(0, -1).join(", ")} and ${specials.at(-1)}.`);

  // Enrollment
  if (school.enrollment_ug != null) {
    const ug = roughEnroll(school.enrollment_ug);
    let s = `It enrolls about ${ug.toLocaleString()} undergraduates`;
    if (school.enrollment_total != null && school.enrollment_total > 0) {
      const gradFrac = (school.enrollment_total - school.enrollment_ug) / school.enrollment_total;
      if (gradFrac > 0.35)      s += `, along with a large graduate population`;
      else if (gradFrac > 0.15) s += `, plus some graduate students`;
    }
    s += ".";
    p1.push(s);
  }

  // ── Para 2: selectivity, cost, outcomes ──────────────────────────────────

  // Admission rate + grad rate (combined sentence)
  const admRate  = school.admission_rate;
  const gradRate = school.grad_rate_6yr;
  if (admRate != null || gradRate != null) {
    const parts = [];
    if (admRate != null) {
      const r   = admRate > 1 ? admRate / 100 : admRate;
      const pct = Math.round(r * 100);
      if (r < 0.15)      parts.push(`just ${pct}% of applicants are admitted`);
      else if (r < 0.35) parts.push(`${pct}% of applicants are admitted`);
      else if (r < 0.75) parts.push(`${pct}% of applicants are accepted`);
      else               parts.push(`${pct}% of applicants are accepted — broadly accessible`);
    }
    if (gradRate != null) {
      const g = Math.round(gradRate);
      parts.push(`${g}% of students graduate within six years`);
    }
    if (parts.length === 2) {
      p2.push(`${parts[0][0].toUpperCase()}${parts[0].slice(1)}, and ${parts[1]}.`);
    } else if (parts.length === 1) {
      p2.push(`${parts[0][0].toUpperCase()}${parts[0].slice(1)}.`);
    }
  }

  // Net price + Pell
  const netPrice = school.net_price;
  const pell     = school.pell_2023;
  if (netPrice != null || pell != null) {
    const parts = [];
    if (netPrice != null) parts.push(`the average net price is $${Math.round(netPrice).toLocaleString()} per year`);
    if (pell != null)     parts.push(`${Math.round(pell * 100)}% of students receive Pell grants`);
    const s = parts.join("; ");
    p2.push(`${s[0].toUpperCase()}${s.slice(1)}.`);
  }

  // Earnings
  if (school.saec_earnings) {
    let s = `Graduates earn a median of $${Math.round(school.saec_earnings).toLocaleString()} eight years after enrollment`;
    if (school.earnings_ratio != null) {
      const r = Number(school.earnings_ratio);
      if (r >= 1.15)      s += `, above average for similar institutions`;
      else if (r <= 0.85) s += `, below average for similar institutions`;
    }
    s += ".";
    p2.push(s);
  }

  return { p1, p2 };
}

// ── schoolPrograms: [{cip_family, cip_label, total_awards}] for this school
// ── cipSchoolCounts: Map<cip_family, number> — how many schools offer each
export function collegeCard(school, schoolPrograms = [], cipSchoolCounts = new Map()) {
  if (!school) return html``;

  const wikiUrl    = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(school.INSTNM)}&go=Go`;
  const mapsUrl    = `https://maps.google.com/?q=${encodeURIComponent(school.CITY + ", " + school.STABBR)}`;
  const usnewsUrl  = `https://www.usnews.com/best-colleges/search?name=${encodeURIComponent(school.INSTNM)}`;
  const websiteUrl = school.WEBADDR
    ? (school.WEBADDR.startsWith("http") ? school.WEBADDR : "https://" + school.WEBADDR)
    : null;

  const displayName  = school.INSTNM.replace(/\bUniversity\b/g, "U.");
  const headerBg     = "#f3f4f6";
  const headerColor  = "#374151";
  const badgeStyle   = `font-size:0.72rem; background:${headerColor}22; color:${headerColor}; border-radius:3px; padding:0.1rem 0.35rem; font-weight:500;`;

  // ── Section 1: header ────────────────────────────────────────────────────
  const header = html`<div style="background:${headerBg}; padding:0.75rem 1rem 0.65rem;">
    <div style="display:flex; align-items:baseline; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.15rem;">
      <strong style="font-size:0.95rem; line-height:1.3;">
        <a href="${wikiUrl}" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:none;">${displayName}</a>
      </strong>
    </div>
    <div style="font-size:0.78rem; color:${headerColor}; opacity:0.8;">
      <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:none;">${school.CITY}, ${school.STABBR}</a>
      ${school.locale_group ? html` · <span style="${badgeStyle}">${school.locale_group}</span>` : html``}
    </div>
  </div>`;

  // ── Section 2: prose ─────────────────────────────────────────────────────
  const { p1, p2 } = buildProse(school);

  const prosePara = (sentences) => html`<p style="margin:0; font-size:0.8rem; color:#333; line-height:1.65;">${sentences.join(" ")}</p>`;

  const proseSection = html`<div style="padding:0.7rem 1rem; border-bottom:1px solid #f0f0f0; display:flex; flex-direction:column; gap:0.45rem;">
    ${prosePara(p1)}
    ${p2.length > 0 ? prosePara(p2) : html``}
  </div>`;

  // ── Section 3: majors ────────────────────────────────────────────────────
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

  // ── Section 4: external links ────────────────────────────────────────────
  const externalLinks = html`<div style="padding:0.5rem 1rem; border-bottom:1px solid #f0f0f0; display:flex; flex-wrap:wrap; gap:0.5rem; font-size:0.78rem;">
    ${websiteUrl ? html`<a href="${websiteUrl}" target="_blank" rel="noopener" style="color:#2563eb;">Website ↗</a>` : html``}
    <a href="${usnewsUrl}" target="_blank" rel="noopener" style="color:#2563eb;">US News ↗</a>
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
    ${proseSection}
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
