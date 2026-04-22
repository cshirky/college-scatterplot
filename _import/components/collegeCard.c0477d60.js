import { html } from "../../_npm/htl@0.3.1/72f4716c.js";

const TIERS = ["definitely", "probably", "maybe"];

function getDeck() {
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

function saveDeck(deck) {
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


function roughEnroll(n) {
  if (n >= 20000) return Math.round(n / 5000) * 5000;
  if (n >= 5000)  return Math.round(n / 1000) * 1000;
  if (n >= 1000)  return Math.round(n / 500) * 500;
  return Math.round(n / 100) * 100;
}

function buildProse(school) {
  const p1 = [], p2 = [];

  // ── Para 1: place and community (Option A style) ─────────────────────────
  const kind    = instKind(school);
  const sector  = sectorAdjective(school.sector_label || "");
  const typeStr = sector ? `${sector} ${kind}` : kind;
  const ug      = school.enrollment_ug != null ? roughEnroll(+school.enrollment_ug) : null;

  // Locale-flavored city phrase
  const lg = school.locale_group;
  let cityPhrase = `${school.CITY}, ${school.STABBR}`;
  if (lg === "Rural") cityPhrase = `rural ${school.CITY}, ${school.STABBR}`;
  else if (lg === "Town") cityPhrase = `${school.CITY}, ${school.STABBR}, a small town`;

  let s1 = `${school.INSTNM} is a ${typeStr}`;
  if (ug != null) s1 += ` — about ${ug.toLocaleString()} students —`;
  s1 += ` in ${cityPhrase}.`;
  p1.push(s1);

  // Religious affiliation
  const rel = school.relaffil_label;
  if (rel) p1.push(`It is affiliated with the ${rel}.`);

  // Special designations
  const specials = [
    +school.hbcu      === 1 ? "a Historically Black College or University (HBCU)" : null,
    +school.hsi       === 1 ? "a Hispanic-Serving Institution (HSI)" : null,
    +school.womenonly === 1 ? "a women's college" : null,
    +school.tribal    === 1 ? "a Tribal College" : null,
    +school.landgrant === 1 ? "a land-grant institution" : null,
  ].filter(Boolean);
  if (specials.length === 1) p1.push(`It is ${specials[0]}.`);
  else if (specials.length > 1) p1.push(`It is ${specials.slice(0, -1).join(", ")} and ${specials.at(-1)}.`);

  // Demographics — only if notably skewed
  const demParts = [];
  if (school.pct_women != null) {
    const w = Math.round(+school.pct_women);
    if (w >= 60 || w <= 38) demParts.push(`${w}% women`);
  }
  if (school.pct_nonresident != null) {
    const nr = Math.round(+school.pct_nonresident);
    if (nr >= 10) demParts.push(`about ${nr}% of students from outside the US`);
  }
  if (demParts.length > 0) p1.push(`The student body is ${demParts.join("; ")}.`);

  // Yield as commitment signal (Option A framing)
  if (school.yield_rate != null) {
    const y = Math.round(+school.yield_rate);
    let s;
    if (y >= 50)      s = `${y}% of admitted students choose to enroll — a high yield for a school of this type.`;
    else if (y >= 30) s = `${y}% of admitted students choose to enroll.`;
    else              s = `${y}% of admitted students choose to enroll, meaning most who are admitted also have other options.`;
    p1.push(s);
  }

  // ── Para 2: can I get in? can I afford it? what happens after? ────────────

  // Admissions (Option C)
  if (school.admission_rate != null) {
    const adm = Math.round(+school.admission_rate > 1 ? +school.admission_rate : +school.admission_rate * 100);
    const shortName = school.INSTNM.replace(/\bUniversity\b/g, "U.");
    let s = `${shortName} admits ${adm}% of applicants`;
    const sat = school.sat_avg ? Math.round(+school.sat_avg) : null;
    const act = school.act_avg ? Math.round(+school.act_avg) : null;
    if (sat != null && sat > 0)       s += ` (average SAT: ${sat})`;
    else if (act != null && act > 0)  s += ` (average ACT: ${act})`;
    s += ".";
    p2.push(s);
  }

  // Cost (Option C)
  const isPublic = /public/i.test(school.sector_label || "");
  const net      = school.net_price      != null ? Math.round(+school.net_price)      : null;
  const inState  = school.tuition_in_state  != null ? Math.round(+school.tuition_in_state)  : null;
  const outState = school.tuition_out_of_state != null ? Math.round(+school.tuition_out_of_state) : null;

  if (isPublic && inState != null && outState != null && inState !== outState) {
    let s = `In-state tuition is $${inState.toLocaleString()}; out-of-state is $${outState.toLocaleString()}.`;
    if (net != null) s += ` The average student pays about $${net.toLocaleString()} per year after aid.`;
    p2.push(s);
  } else if (net != null && inState != null) {
    p2.push(`Tuition is about $${inState.toLocaleString()}, but the average student pays about $${net.toLocaleString()} per year after aid.`);
  } else if (net != null) {
    p2.push(`The average student pays about $${net.toLocaleString()} per year after aid.`);
  }

  const pellDebt = [];
  if (school.pell_2023 != null) pellDebt.push(`${Math.round(+school.pell_2023 * 100)}% of students receive Pell grants`);
  if (school.grad_debt_median != null) pellDebt.push(`median debt at graduation is $${Math.round(+school.grad_debt_median).toLocaleString()}`);
  if (pellDebt.length > 0) {
    const s = pellDebt.join("; ");
    p2.push(`${s[0].toUpperCase()}${s.slice(1)}.`);
  }

  // Outcomes
  if (school.grad_rate_6yr != null) {
    p2.push(`${Math.round(+school.grad_rate_6yr)}% of students graduate within six years.`);
  }

  if (school.saec_earnings != null) {
    let s = `Graduates earn a median of $${Math.round(+school.saec_earnings).toLocaleString()} eight years after enrollment`;
    if (school.earnings_ratio != null) {
      const r = +school.earnings_ratio;
      if (r >= 1.15)      s += `, above average for similar institutions`;
      else if (r <= 0.85) s += `, below average for similar institutions`;
    }
    s += ".";
    p2.push(s);
  }

  return { p1, p2 };
}

export function collegeCard(school, topMajors = []) {
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

  function admitPie(r) {
    const admit = Math.min(1, Math.max(0, (r > 1 ? r / 100 : r)));
    const size = 14;
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    canvas.style.verticalAlign = "middle";
    canvas.style.margin = "-1px 0";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2, rad = size / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, 2 * Math.PI);
    ctx.fillStyle = "#dc2626";
    ctx.fill();
    const start = -Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, rad, start, start + admit * 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = "#16a34a";
    ctx.fill();
    return canvas;
  }

  const pct = (v) => v != null ? `${Number(v).toFixed(0)}%` : null;
  const admPie = school.admission_rate != null ? admitPie(school.admission_rate) : null;
  if (admPie) {
    const r = school.admission_rate > 1 ? school.admission_rate / 100 : school.admission_rate;
    admPie.title = `${Math.round(r * 100)}% admission rate`;
  }

  const statItems = [
    school.yield_rate    != null ? `${pct(school.yield_rate)} yield`   : null,
    school.grad_rate_6yr != null ? `${pct(school.grad_rate_6yr)} grad` : null,
    admPie,
  ].filter(Boolean);

  // ── Section 1: header ────────────────────────────────────────────────────
  const header = html`<div style="background:${headerBg}; padding:0.75rem 1rem 0.65rem;">
    <div style="display:flex; align-items:baseline; gap:0.4rem; flex-wrap:wrap; margin-bottom:0.15rem;">
      <strong style="font-size:0.95rem; line-height:1.3;">
        <a href="${wikiUrl}" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:none;">${displayName}</a>
      </strong>
      <span style="font-size:0.78rem; color:${headerColor}; opacity:0.8;">
        <a href="${mapsUrl}" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:none;">${school.CITY}, ${school.STABBR}</a>
      </span>
    </div>
    ${statItems.length > 0 ? html`<div style="margin-top:0.45rem; display:flex; flex-wrap:wrap; gap:0.3rem; align-items:center;">
      ${statItems.map(s => html`<span style="${badgeStyle}">${s}</span>`)}
    </div>` : html``}
  </div>`;

  // ── Section 2: prose ─────────────────────────────────────────────────────
  const { p1, p2 } = buildProse(school);

  const prosePara = (sentences) => html`<p style="margin:0; font-size:0.8rem; color:#333; line-height:1.65;">${sentences.join(" ")}</p>`;

  const proseSection = html`<div style="padding:0.7rem 1rem; border-bottom:1px solid #f0f0f0; display:flex; flex-direction:column; gap:0.45rem;">
    ${prosePara(p1)}
    ${p2.length > 0 ? prosePara(p2) : html``}
  </div>`;

  // ── Section 3: majors ────────────────────────────────────────────────────
  const majorsSection = topMajors.length === 0 ? html`` : html`<div style="padding:0.45rem 1rem; border-bottom:1px solid #f0f0f0; font-size:0.78rem; color:#444;">
    <span style="font-weight:600; color:#555;">Top majors:</span> ${topMajors.map(m => m.cip_label).join(", ")}
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
