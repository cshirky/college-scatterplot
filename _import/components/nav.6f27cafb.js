const VERSIONS = [
  {id: "scatterplot", href: "/scatterplot", label: "Original"},
  {id: "reverse",     href: "/reverse",     label: "A) Reverse"},
  {id: "joy",         href: "/joy",         label: "B) Joy"},
  {id: "isometric",   href: "/isometric",   label: "C) Isometric"},
];

export function scatterNav(current) {
  const nav = document.createElement("nav");
  nav.style.cssText = "display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center; margin-bottom:1rem; font-size:0.85rem;";
  const lead = document.createElement("span");
  lead.textContent = "Versions:";
  lead.style.cssText = "color:#888; margin-right:0.25rem;";
  nav.append(lead);
  for (const v of VERSIONS) {
    const a = document.createElement("a");
    a.href = v.href;
    a.textContent = v.label;
    const active = v.id === current;
    a.style.cssText = active
      ? "padding:0.25rem 0.75rem; border-radius:999px; border:1px solid #1d4ed8; background:#1d4ed8; color:#fff; font-weight:600; text-decoration:none;"
      : "padding:0.25rem 0.75rem; border-radius:999px; border:1px solid #93c5fd; background:#dbeafe; color:#1e3a8a; text-decoration:none;";
    if (active) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
  return nav;
}
