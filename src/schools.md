---
title: School Profile
---

```js
import { collegeCard, getDeck } from "./components/collegeCard.js";
const institutions = FileAttachment("data/institutions.csv").csv({typed: true});
const programs     = FileAttachment("data/programs.csv").csv({typed: true});
```

```js
const id = +new URLSearchParams(location.search).get("id");
const school = institutions.find(d => d.UNITID === id) ?? null;
const schoolPrograms = programs.filter(d => d.UNITID === id)
  .sort((a, b) => b.total_awards - a.total_awards);
```

```js
if (!school) display(html`<div style="padding:2rem; color:#666;">School not found. <a href="/intro">← Back</a></div>`);
```

```js
if (school) {

const pct    = (v, d = 0) => v != null ? `${Number(v).toFixed(d)}%` : "—";
const num    = (v) => v != null ? Number(v).toLocaleString() : "—";
const dollar = (v) => v != null ? `$${Number(v).toLocaleString()}` : "—";

function admissionHue(r) {
  const t = Math.max(0, Math.min(1, (r - 3) / (100 - 3)));
  return 18 + t * (142 - 18);
}
const rate        = school.admission_rate;
const headerBg    = rate == null ? "#e5e7eb" : `hsl(${admissionHue(rate)}, 68%, 88%)`;
const headerColor = rate == null ? "#374151" : `hsl(${admissionHue(rate)}, 72%, 28%)`;

const websiteUrl = school.WEBADDR
  ? (school.WEBADDR.startsWith("http") ? school.WEBADDR : "https://" + school.WEBADDR)
  : null;
const ncesUrl  = `https://nces.ed.gov/collegenavigator/?id=${school.UNITID}`;
const wikiUrl  = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(school.INSTNM)}&go=Go`;
const usnewsUrl = `https://www.usnews.com/best-colleges/search?name=${encodeURIComponent(school.INSTNM)}`;

// ── Header ────────────────────────────────────────────────────────────────
display(html`
<div style="margin-bottom:0.75rem;">
  <a href="javascript:history.back()" style="font-size:0.88rem; color:#555;">← Back</a>
</div>

<div style="background:${headerBg}; border-radius:12px; padding:1.5rem 1.75rem 1.25rem; margin-bottom:1.5rem;">
  <h1 style="margin:0 0 0.2rem; font-size:1.75rem; font-weight:700; color:${headerColor}; line-height:1.2;">
    ${websiteUrl ? html`<a href="${websiteUrl}" target="_blank" rel="noopener" style="color:inherit; text-decoration:none; border-bottom:2px solid ${headerColor}44;">${school.INSTNM}</a>` : school.INSTNM}
  </h1>
  <div style="color:${headerColor}; opacity:0.8; font-size:1rem; margin-bottom:1rem;">
    <a href="https://www.google.com/maps/search/${encodeURIComponent(school.INSTNM + ", " + school.CITY + ", " + school.STABBR)}" target="_blank" rel="noopener" style="color:inherit; text-decoration:none; border-bottom:1px solid ${headerColor}44;">${school.CITY}, ${school.STABBR}</a>
    · ${school.sector_label} · ${school.locale_group}${school.HBCU === 1 ? " · HBCU" : ""}${school.relaffil_label ? " · " + school.relaffil_label : ""}
  </div>

  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.75rem;">
    ${[
      ["Undergrad enrollment", num(school.enrollment_ug)],
      ["Yield rate",      pct(school.yield_rate, 1)],
      ["6-yr grad rate",  pct(school.grad_rate_6yr)],
    ].map(([label, value]) => html`
      <div style="background:${headerColor}18; border-radius:8px; padding:0.6rem 0.75rem;">
        <div style="font-size:0.72rem; color:${headerColor}; opacity:0.8; text-transform:uppercase; letter-spacing:0.04em; margin-bottom:0.2rem;">${label}</div>
        <div style="font-size:1.25rem; font-weight:700; color:${headerColor};">${value}</div>
      </div>
    `)}
  </div>
</div>`);

// ── Wikipedia summary ─────────────────────────────────────────────────────
{
  const wikiTitle = school.INSTNM.replace(/ /g, "_");
  const wikiApiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle)}`;
  try {
    const res = await fetch(wikiApiUrl, { headers: { "Accept": "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.extract) {
        display(html`<div style="border:1px solid #e5e7eb; border-radius:10px; padding:1.1rem 1.25rem; margin-bottom:1.5rem; font-size:0.92rem; line-height:1.7; color:#333;">
          <p style="margin:0;">${data.extract}</p>
          <p style="margin:0.6rem 0 0; font-size:0.78rem; color:#888;">Source: <a href="${data.content_urls?.desktop?.page}" target="_blank" rel="noopener" style="color:#2563eb;">Wikipedia</a></p>
        </div>`);
      }
    }
  } catch {}
}

// ── Academics & Cost ──────────────────────────────────────────────────────
display(html`
<div style="border:1px solid #e5e7eb; border-radius:10px; padding:1.1rem 1.25rem; margin-bottom:1.5rem;">
  <h2 style="margin:0 0 0.9rem; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#555;">Academics & Cost</h2>
  ${[
    ["Academic tier",         school.academic_tier ?? "—"],
    ["In-state tuition",      dollar(school.tuition_in_state)],
    ["Out-of-state tuition",  dollar(school.tuition_out_of_state)],
    ["Graduate students",     school.grad_ratio ?? "—"],
  ].map(([label, value]) => html`
    <div style="display:flex; justify-content:space-between; padding:0.3rem 0; border-bottom:1px solid #f3f4f6; font-size:0.88rem;">
      <span style="color:#555;">${label}</span>
      <span style="font-weight:500;">${value}</span>
    </div>
  `)}
</div>`);

// ── SAT context chart ─────────────────────────────────────────────────────
{
  const benchmarks = [
    { label: "Top 50% of test-takers", score: 1000 },
    { label: "Top 25% of test-takers", score: 1200 },
    { label: "Top 10% of test-takers", score: 1350 },
    { label: "Top 1% of test-takers",  score: 1450 },
  ];

  const satAvg = school.sat_avg;

  display(html`<div style="border:1px solid #e5e7eb; border-radius:10px; padding:1.1rem 1.25rem; margin-bottom:1.5rem;">
    <h2 style="margin:0 0 0.9rem; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#555;">Academic performance at your high school</h2>
    <p style="margin:0 0 0.9rem; font-size:0.85rem; color:#555; line-height:1.5;">Students admitted here typically scored around <strong>${satAvg != null ? num(satAvg) : "—"}</strong> on the SAT. Here's where that falls on the national distribution:</p>
    ${Plot.plot({
      marginLeft: 195,
      marginRight: 80,
      width: 560,
      height: benchmarks.length * 36 + 40,
      x: { domain: [800, 1600], label: "SAT score", tickFormat: d => d.toLocaleString() },
      marks: [
        Plot.barX(benchmarks, {
          x1: 800,
          x2: "score",
          y: "label",
          fill: "#dbeafe",
          sort: { y: "-x2" },
        }),
        Plot.text(benchmarks, {
          x: "score",
          y: "label",
          text: d => d.score.toLocaleString() + "+",
          dx: 6,
          textAnchor: "start",
          fontSize: 12,
          fill: "#1e40af",
          sort: { y: "-x" },
        }),
        ...(satAvg != null ? [
          Plot.ruleX([satAvg], { stroke: headerColor, strokeWidth: 2.5, strokeDasharray: "4,3" }),
          Plot.text([{ score: satAvg }], {
            x: "score",
            y: () => benchmarks[0].label,
            text: () => `▲ ${num(satAvg)} avg`,
            dy: -14,
            fontSize: 11,
            fill: headerColor,
            fontWeight: 600,
          }),
        ] : []),
        Plot.ruleX([800]),
      ],
    })}
  </div>`);
}

// ── Programs chart ────────────────────────────────────────────────────────
if (schoolPrograms.length > 0) {
  display(html`<h2 style="font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#555; margin:0 0 0.75rem;">Degrees Awarded by Field</h2>`);
  display(Plot.plot({
    marginLeft: 160,
    width: 640,
    height: Math.max(120, schoolPrograms.length * 26),
    x: { label: "Degrees awarded (2023)" },
    marks: [
      Plot.barX(schoolPrograms, {
        x: "total_awards",
        y: "cip_label",
        fill: headerBg,
        stroke: headerColor,
        strokeWidth: 0.5,
        sort: { y: "-x" },
        tip: true,
      }),
      Plot.ruleX([0]),
    ],
  }));
}

// ── Athletics ─────────────────────────────────────────────────────────────
if (school.athletic_association) {
  display(html`
  <div style="border:1px solid #e5e7eb; border-radius:10px; padding:1.1rem 1.25rem; margin-top:1.5rem; margin-bottom:1.5rem;">
    <h2 style="margin:0 0 0.75rem; font-size:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#555;">Athletics</h2>
    <div style="font-size:0.88rem; margin-bottom:0.4rem;"><span style="color:#555;">Association:</span> <strong>${school.athletic_association}</strong>${school.ncaa_division ? " · " + school.ncaa_division : ""}</div>
    ${school.sports_offered ? html`<div style="font-size:0.85rem; color:#444; line-height:1.6;">${school.sports_offered}</div>` : html``}
  </div>`);
}

// ── External links ────────────────────────────────────────────────────────
display(html`
<div style="display:flex; flex-wrap:wrap; gap:0.75rem; margin-top:1rem; padding-top:1rem; border-top:1px solid #e5e7eb;">
  ${websiteUrl ? html`<a href="${websiteUrl}" target="_blank" rel="noopener" style="padding:0.45rem 0.9rem; background:#f1f5f9; border-radius:6px; font-size:0.88rem; color:#2563eb; text-decoration:none;">School website ↗</a>` : html``}
  <a href="${ncesUrl}"   target="_blank" rel="noopener" style="padding:0.45rem 0.9rem; background:#f1f5f9; border-radius:6px; font-size:0.88rem; color:#2563eb; text-decoration:none;">NCES College Navigator ↗</a>
  <a href="${wikiUrl}"   target="_blank" rel="noopener" style="padding:0.45rem 0.9rem; background:#f1f5f9; border-radius:6px; font-size:0.88rem; color:#2563eb; text-decoration:none;">Wikipedia ↗</a>
  <a href="${usnewsUrl}" target="_blank" rel="noopener" style="padding:0.45rem 0.9rem; background:#f1f5f9; border-radius:6px; font-size:0.88rem; color:#2563eb; text-decoration:none;">US News ↗</a>
</div>`);

} // end if (school)
```
