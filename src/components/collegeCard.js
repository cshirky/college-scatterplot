import { html } from "npm:htl";

export function collegeCard(school) {
  if (!school) return html``;

  const grad = (school.enrollment_total ?? 0) - (school.enrollment_ug ?? 0);
  const pct    = (v) => v != null ? `${v}%` : "N/A";
  const num    = (v) => v != null ? Number(v).toLocaleString() : "N/A";
  const dollar = (v) => v != null ? `$${Number(v).toLocaleString()}` : "N/A";
  const ncesUrl = `https://nces.ed.gov/collegenavigator/?id=${school.UNITID}`;

  const rate = school.admission_rate;
  const headerBg = rate == null ? "#e5e7eb"
    : rate > 40  ? "#bfdbfe"   // light blue — accessible
    : rate >= 20 ? "#bbf7d0"   // green — moderate
    :              "#fed7aa";  // orange — selective
  const headerColor = rate == null ? "#374151"
    : rate > 40  ? "#1e3a8a"
    : rate >= 20 ? "#14532d"
    :              "#9a3412";

  const badges = [school.sector_label, school.locale_group, school.HBCU === 1 ? "HBCU" : null]
    .filter(Boolean).join(" · ");

  function row(label, value) {
    return html`<div style="display:flex; justify-content:space-between; gap:0.5rem; padding:0.22rem 0; border-bottom:1px solid #f2f2f2;">
      <span style="color:#555; font-size:0.83rem;">${label}</span>
      <span style="font-size:0.83rem; font-weight:500; text-align:right;">${value}</span>
    </div>`;
  }

  const dialog = html`<dialog style="border-radius:10px; border:1px solid #ddd; padding:0; max-width:380px; width:90%; box-shadow:0 8px 32px rgba(0,0,0,0.2);">
    <div style="background:${headerBg}; padding:0.9rem 1.1rem 0.75rem; border-radius:10px 10px 0 0; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <strong style="color:${headerColor}; font-size:1rem; line-height:1.3;">${school.INSTNM}</strong>
        <div style="color:${headerColor}; opacity:0.75; font-size:0.8rem; margin-top:0.15rem;">${school.CITY}, ${school.STABBR}</div>
      </div>
      <button data-close style="background:none; border:none; font-size:1.4rem; line-height:1; cursor:pointer; color:${headerColor}; padding:0 0 0 0.5rem; opacity:0.7;">×</button>
    </div>
    <div style="padding:0.9rem 1.1rem 1rem;">
      ${row("SAT average", num(school.sat_avg))}
      ${row("ACT average", num(school.act_avg))}
      ${row("In-state tuition", dollar(school.tuition_in_state))}
      ${row("Out-of-state tuition", dollar(school.tuition_out_of_state))}
      <div style="margin:0.75rem 0 0.3rem; font-size:0.8rem; font-weight:700; color:#444; text-transform:uppercase; letter-spacing:0.04em;">Demographics</div>
      ${row("White", pct(school.pct_white))}
      ${row("Black", pct(school.pct_black))}
      ${row("Hispanic", pct(school.pct_hispanic))}
      ${row("Asian", pct(school.pct_asian))}
      ${row("Two or more", pct(school.pct_two_or_more))}
      ${row("AIAN", pct(school.pct_aian))}
      ${row("NHPI", pct(school.pct_nhpi))}
      ${row("Nonresident", pct(school.pct_nonresident))}
      <p style="margin:0.75rem 0 0; font-size:0.83rem;">
        <a href="${ncesUrl}" target="_blank" rel="noopener">Full profile on NCES College Navigator ↗</a>
      </p>
    </div>
  </dialog>`;

  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.onclick = (e) => { if (e.target === dialog) dialog.close(); };

  const card = html`<div style="border:1px solid #ddd; border-radius:8px; overflow:hidden; font-size:0.9rem; background:var(--theme-background,#fff);">
    <div style="background:${headerBg}; padding:0.75rem 1rem;">
      <strong style="color:${headerColor}; font-size:0.95rem; line-height:1.3; display:block;">${school.INSTNM}</strong>
      <div style="color:${headerColor}; opacity:0.8; font-size:0.78rem; margin-top:0.15rem;">${school.CITY}, ${school.STABBR}</div>
    </div>
    <div style="padding:0.75rem 1rem;">
      <div style="font-size:0.75rem; color:#777; margin-bottom:0.5rem;">${badges}</div>
      ${row("Admission rate", pct(rate))}
      ${row("6-yr grad rate", pct(school.grad_rate_6yr))}
      ${row("Undergrad enrollment", num(school.enrollment_ug))}
      ${row("Graduate enrollment", grad > 0 ? num(grad) : "N/A")}
      ${row("Pell recipients", pct(school.pct_pell))}
      ${row("Women", pct(school.pct_women))}
      <button data-extend style="margin-top:0.6rem; background:none; border:none; padding:0; font-size:0.8rem; color:#555; cursor:pointer; text-decoration:underline;">Extended data ↗</button>
    </div>
    ${dialog}
  </div>`;

  card.querySelector("[data-extend]").onclick = () => dialog.showModal();

  return card;
}
