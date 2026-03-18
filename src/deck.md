# My Deck

```js
import { collegeCard, getDeck, saveDeck } from "./components/collegeCard.js";
const allInstitutions = await FileAttachment("data/institutions.csv").csv({typed: true});
const programs = await FileAttachment("data/programs.csv").csv({typed: true});
```

```js
const TIERS = ["definitely", "probably", "maybe"];

// Build program lookup structures
const programsByUnitid = new Map();
for (const p of programs) {
  if (!programsByUnitid.has(p.UNITID)) programsByUnitid.set(p.UNITID, []);
  programsByUnitid.get(p.UNITID).push(p);
}
const cipSchoolCounts = new Map();
for (const p of programs) cipSchoolCounts.set(p.cip_family, (cipSchoolCounts.get(p.cip_family) || 0) + 1);

function urlToDeck() {
  const params = new URLSearchParams(location.search);
  const parse = (key) => new Set((params.get(key) || "").split("|").map(Number).filter(n => n > 0));
  const deck = { definitely: parse("definitely"), probably: parse("probably"), maybe: parse("maybe") };
  return (deck.definitely.size + deck.probably.size + deck.maybe.size) > 0 ? deck : null;
}

function syncUrl(deck) {
  const parts = TIERS.flatMap(tier =>
    deck[tier].size ? [`${tier}=${[...deck[tier]].join("|")}`] : []
  );
  history.replaceState(null, "", parts.length ? "?" + parts.join("&") : location.pathname);
}

// If URL has tier params, treat as source of truth
const fromUrl = urlToDeck();
if (fromUrl) saveDeck(fromUrl);

const container = html`<div></div>`;

function moveTier(unitid, newTier) {
  const deck = getDeck();
  for (const t of TIERS) deck[t].delete(unitid);
  if (newTier) deck[newTier].add(unitid);
  saveDeck(deck);
  render();
}

function render() {
  const deck = getDeck();
  syncUrl(deck);
  const total = TIERS.reduce((n, t) => n + deck[t].size, 0);
  container.innerHTML = "";

  if (total === 0) {
    container.append(html`<p style="color:#888; font-style:italic;">Your deck is empty. Browse schools and click <strong>Definitely</strong>, <strong>Probably</strong>, or <strong>Maybe</strong> on any card.</p>`);
    return;
  }

  const shareUrl = location.href;
  container.append(html`<p style="font-size:0.85rem; color:#555; margin-bottom:1.25rem;">
    Share this deck: <a href="${shareUrl}" style="font-family:monospace; word-break:break-all;">${shareUrl}</a>
  </p>`);

  const tierLabels = { definitely: "Definitely applying", probably: "Probably applying", maybe: "Maybe applying" };

  for (const tier of TIERS) {
    const schools = allInstitutions.filter(d => deck[tier].has(d.UNITID));
    if (schools.length === 0) continue;

    container.append(html`<div style="font-size:0.78rem; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; color:#777; padding-bottom:0.4rem; border-bottom:2px solid #eee; margin:1.5rem 0 0.75rem;">${tierLabels[tier]}</div>`);

    const grid = html`<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;"></div>`;
    for (const school of schools) {
      grid.append(html`<div>${collegeCard(school, programsByUnitid.get(school.UNITID) || [], cipSchoolCounts)}</div>`);
    }
    container.append(grid);
  }
}

container.addEventListener("deck-changed", render);
window.addEventListener("storage", render);

render();
display(container);
```
