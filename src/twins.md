<h1>School Twins</h1>

<a href="/">← Back to Explorer</a> | <a href="/compare">→ Compare categories</a>

```js
import { collegeCard } from "./components/collegeCard.js";
const allInstitutions = await FileAttachment("data/institutions.csv").csv({typed: true});
const programs = await FileAttachment("data/programs.csv").csv({typed: true});
const institutions = allInstitutions.filter(d => d.admission_rate != null && d.admission_rate <= 75);
```

---

## Discover Schools

Answer three questions and we'll show schools that match — sorted left to right from most accessible to most selective.

```js
const regionStates = {
  "New England": ["ME", "NH", "VT", "MA", "RI", "CT"],
  "Mid-Atlantic": ["NY", "NJ", "PA", "MD", "DE", "DC", "VA", "WV"],
  "South-East": ["NC", "SC", "GA", "FL", "AL", "MS", "TN", "KY", "AR", "LA"],
  "Midwest": ["OH", "IN", "MI", "WI", "IL", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  "Mountain West": ["MT", "ID", "WY", "CO", "UT", "NV", "AZ", "NM"],
  "West Coast": ["WA", "OR", "CA", "AK", "HI"]
};
const stateToRegion = new Map();
for (const [region, states] of Object.entries(regionStates)) {
  for (const state of states) stateToRegion.set(state, region);
}

const subjectCipMap = {
  "Math / Statistics":              [27],
  "Biology / Life Sciences":        [26],
  "Chemistry / Physics":            [40],
  "Computer Science / Technology":  [11, 10, 15],
  "English / Literature / Writing": [23],
  "History / Political Science":    [54, 45],
  "Foreign Language / Linguistics": [16],
  "Economics / Business":           [52],
  "Psychology / Sociology":         [42, 45],
  "Visual Arts / Design":           [50],
  "Music / Performance":            [50],
  "Theater / Film":                 [50],
  "Philosophy / Ethics / Religion": [38, 39],
  "Environmental Studies":          [3, 31]
};

const schoolCipFamilies = new Map();
for (const p of programs) {
  if (!schoolCipFamilies.has(p.UNITID)) schoolCipFamilies.set(p.UNITID, new Set());
  schoolCipFamilies.get(p.UNITID).add(p.cip_family);
}
```

```js
const localeChoice = view(Inputs.radio(
  ["City", "Town or Suburb", "Rural"],
  {label: "Location type", value: "City"}
));
```

```js
const sizeChoice = view(Inputs.radio(
  ["Under 2,000", "Under 5,000", "Under 10,000", "10,000+"],
  {label: "Size (# of undergrads)", value: "Under 5,000"}
));
```

```js
const regionChoice = view(Inputs.select(
  ["Any region", "New England", "Mid-Atlantic", "South-East", "Midwest", "Mountain West", "West Coast"],
  {label: "Region"}
));
```

```js
const subjectChoice = view(Inputs.checkbox(
  Object.keys(subjectCipMap),
  {label: "Subjects of interest (leave blank for any)"}
));
```

```js
const selectedCips = new Set(subjectChoice.flatMap(s => subjectCipMap[s] || []));

const discoverFiltered = institutions.filter(d => {
  const localeOk =
    localeChoice === "City" ? d.locale_group === "City" :
    localeChoice === "Town or Suburb" ? (d.locale_group === "Town" || d.locale_group === "Suburb") :
    d.locale_group === "Rural";
  const ug = d.enrollment_ug || 0;
  const sizeOk =
    sizeChoice === "Under 2,000" ? ug < 2000 :
    sizeChoice === "Under 5,000" ? ug < 5000 :
    sizeChoice === "Under 10,000" ? ug < 10000 :
    ug >= 10000;
  const regionOk = regionChoice === "Any region" || stateToRegion.get(d.STABBR) === regionChoice;
  const cipOk = selectedCips.size === 0 ||
    [...selectedCips].some(c => (schoolCipFamilies.get(d.UNITID) || new Set()).has(c));
  return localeOk && sizeOk && regionOk && cipOk;
});

const tierHigh = discoverFiltered
  .filter(d => d.admission_rate > 40)
  .sort((a, b) => (b.grad_rate_6yr || 0) - (a.grad_rate_6yr || 0))
  .slice(0, 3);
const tierMid = discoverFiltered
  .filter(d => d.admission_rate >= 20 && d.admission_rate <= 40)
  .sort((a, b) => (b.grad_rate_6yr || 0) - (a.grad_rate_6yr || 0))
  .slice(0, 3);
const tierLow = discoverFiltered
  .filter(d => d.admission_rate < 20)
  .sort((a, b) => (b.grad_rate_6yr || 0) - (a.grad_rate_6yr || 0))
  .slice(0, 3);
```

```js
{
  const tiers = [tierHigh, tierMid, tierLow];
  const tierLabels = ["Admission > 40%", "Admission 20–40%", "Admission < 20%"];
  const nRows = Math.max(tierHigh.length, tierMid.length, tierLow.length);

  if (nRows === 0) {
    display(html`<p><em>No schools match these preferences — try adjusting your filters.</em></p>`);
  } else {
    display(html`<div style="overflow-x:auto;">
      <div style="display:grid; grid-template-columns:repeat(3, minmax(260px, 1fr)); gap:1.25rem;">
        ${tierLabels.map(label => html`
          <div style="font-size:0.78rem; font-weight:bold; text-transform:uppercase; letter-spacing:0.05em; color:#777; padding-bottom:0.4rem; border-bottom:2px solid #eee; margin-bottom:0.25rem;">${label}</div>`)}
        ${Array.from({length: nRows}, (_, i) =>
          tiers.map(tier => html`
            <div>${tier[i] ? collegeCard(tier[i]) : html`<div style="color:#ccc; font-size:0.85rem; padding:1rem;"><em>—</em></div>`}</div>`)
        ).flat()}
      </div>
    </div>`);
  }
}
```

---

## Find Twins for a Specific School

Paste school names or UNITIDs (one per line) to find the three closest twin institutions for each.

```js
// Build CIP degree-count vector per school
const cipFamilies = [...new Set(programs.map(d => d.cip_family))].sort();
const cipIndex = new Map(cipFamilies.map((f, i) => [f, i]));
const schoolVectors = new Map();
for (const p of programs) {
  if (!schoolVectors.has(p.UNITID)) schoolVectors.set(p.UNITID, new Float64Array(cipFamilies.length));
  schoolVectors.get(p.UNITID)[cipIndex.get(p.cip_family)] = p.total_awards;
}

// Precompute vector magnitudes for cosine similarity
const schoolMagnitudes = new Map();
for (const [id, vec] of schoolVectors) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  schoolMagnitudes.set(id, Math.sqrt(sum));
}

function cosineSimilarity(idA, idB) {
  const vecA = schoolVectors.get(idA);
  const vecB = schoolVectors.get(idB);
  if (!vecA || !vecB) return 0;
  const magA = schoolMagnitudes.get(idA);
  const magB = schoolMagnitudes.get(idB);
  if (magA === 0 || magB === 0) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i];
  return dot / (magA * magB);
}

// Enrollment normalization ranges
const ugRange = d3.max(institutions, d => d.enrollment_ug) - d3.min(institutions, d => d.enrollment_ug) || 1;
const gradMax = d3.max(institutions, d => (d.enrollment_total || 0) - (d.enrollment_ug || 0));
const gradMin = d3.min(institutions, d => (d.enrollment_total || 0) - (d.enrollment_ug || 0));
const gradRange = gradMax - gradMin || 1;

function enrollmentCloseness(a, b) {
  const ugDist = Math.abs((a.enrollment_ug || 0) - (b.enrollment_ug || 0)) / ugRange;
  const gradA = (a.enrollment_total || 0) - (a.enrollment_ug || 0);
  const gradB = (b.enrollment_total || 0) - (b.enrollment_ug || 0);
  const gradDist = Math.abs(gradA - gradB) / gradRange;
  return 1 - (ugDist * 0.5 + gradDist * 0.5);
}

function gradProportion(d) {
  const total = d.enrollment_total || 0;
  if (total === 0) return 0;
  return ((total - (d.enrollment_ug || 0)) / total);
}

const raceFields = ["pct_white", "pct_black", "pct_hispanic", "pct_asian", "pct_aian", "pct_nhpi", "pct_two_or_more", "pct_nonresident"];

function racialDistance(a, b) {
  // Euclidean distance on racial composition percentages, normalized to 0-1
  // Max possible distance is sqrt(8 * 100^2) ≈ 283
  let sumSq = 0;
  for (const f of raceFields) {
    const diff = (a[f] || 0) - (b[f] || 0);
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq) / 283;
}

function genderDistance(a, b) {
  // Difference in % women, normalized to 0-1
  return Math.abs((a.pct_women || 50) - (b.pct_women || 50)) / 100;
}

const localeOrder = {"City": 0, "Suburb": 1, "Town": 2, "Rural": 3};

function localeCloseness(a, b) {
  const la = localeOrder[a.locale_group] ?? 1;
  const lb = localeOrder[b.locale_group] ?? 1;
  return 1 - Math.abs(la - lb) / 3;
}

function twinScore(a, b) {
  const programSim = cosineSimilarity(a.UNITID, b.UNITID);
  const enrollClose = enrollmentCloseness(a, b);
  // Penalize large differences in grad/undergrad balance
  const balanceDiff = Math.abs(gradProportion(a) - gradProportion(b));
  const balancePenalty = 1 - balanceDiff;
  // Penalize differences in racial, gender, and locale makeup
  const racialPenalty = 1 - racialDistance(a, b);
  const genderPenalty = 1 - genderDistance(a, b);
  const localePenalty = localeCloseness(a, b);
  return (programSim * 0.5 + enrollClose * 0.5) * balancePenalty * racialPenalty * genderPenalty * localePenalty;
}

// Count how many schools offer each CIP family
const cipSchoolCount = new Map();
for (const p of programs) {
  if (!cipSchoolCount.has(p.cip_family)) cipSchoolCount.set(p.cip_family, new Set());
  cipSchoolCount.get(p.cip_family).add(p.UNITID);
}

function topCips(unitid, n = 5) {
  return programs
    .filter(d => d.UNITID === unitid)
    .sort((a, b) => b.total_awards - a.total_awards)
    .slice(0, n);
}

function rarestCips(unitid, n = 5) {
  return programs
    .filter(d => d.UNITID === unitid)
    .map(d => ({...d, schoolCount: cipSchoolCount.get(d.cip_family)?.size || 0}))
    .sort((a, b) => a.schoolCount - b.schoolCount)
    .slice(0, n);
}

function findTwins(school, n = 3) {
  if (!schoolVectors.has(school.UNITID)) return {school, twins: [], noPrograms: true};
  const candidates = institutions.filter(d =>
    d.UNITID !== school.UNITID &&
    d.sector_label === school.sector_label &&
    schoolVectors.has(d.UNITID)
  );
  const scored = candidates.map(d => ({school: d, score: twinScore(school, d)}));
  scored.sort((a, b) => b.score - a.score);
  return {school, twins: scored.slice(0, n), noPrograms: false};
}
```

```js
const inputText = view(Inputs.textarea({label: "Paste school names or UNITIDs (one per line)", rows: 8, width: 600}));
```

```js
const findBtn = view(Inputs.button("Find Twins"));
```

```js
// Parse input and match schools
const searchLines = inputText.split("\n").map(s => s.trim()).filter(s => s.length > 0);
const dedupedLines = [...new Set(searchLines)];

const matchResults = dedupedLines.map(line => {
  const asNum = parseInt(line, 10);
  // Try UNITID match first
  if (!isNaN(asNum)) {
    const match = institutions.find(d => d.UNITID === asNum);
    if (match) return {line, match, error: null};
  }
  // Try case-insensitive substring match on name
  const lower = line.toLowerCase();
  const nameMatches = institutions.filter(d => d.INSTNM.toLowerCase().includes(lower));
  if (nameMatches.length === 1) return {line, match: nameMatches[0], error: null};
  if (nameMatches.length > 1) return {line, match: null, error: `"${line}" matched ${nameMatches.length} schools — be more specific`};
  return {line, match: null, error: `"${line}" not found`};
});

const errors = matchResults.filter(r => r.error);
const matched = matchResults.filter(r => r.match);
// Deduplicate by UNITID
const seen = new Set();
const uniqueMatched = matched.filter(r => {
  if (seen.has(r.match.UNITID)) return false;
  seen.add(r.match.UNITID);
  return true;
});
```

```js
// Show errors
if (errors.length > 0) {
  display(html`<div style="color: #e15759; margin: 0.5rem 0;">
    ${errors.map(e => html`<div>${e.error}</div>`)}
  </div>`);
}
```

```js
// Compute twins for all matched schools
const results = uniqueMatched.map(r => findTwins(r.match));
```

```js
// Display results as cards
if (results.length > 0) {
  for (const r of results) {
    const s = r.school;
    const top5 = topCips(s.UNITID);
    const rare5 = rarestCips(s.UNITID);
    display(html`<div style="margin-bottom: 2.5rem; padding-bottom: 2rem; border-bottom: 2px solid #eee;">
      ${collegeCard(s)}
      ${r.noPrograms
        ? html`<p style="margin-top: 0.75rem; color: #999; font-size: 0.9rem;"><em>No program data available — cannot compute twins.</em></p>`
        : html`<div style="margin-top: 1rem;">
            <div style="font-size: 0.8rem; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; color: #777; margin-bottom: 0.5rem;">Closest twins</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
              ${r.twins.map((t, i) => html`<div>
                <div style="font-size: 0.78rem; color: #888; margin-bottom: 0.3rem;">
                  Twin ${i + 1} &middot; Match score: ${(t.score * 100).toFixed(1)}%
                </div>
                ${collegeCard(t.school)}
              </div>`)}
            </div>
            <details>
              <summary style="cursor: pointer; font-size: 0.82rem; color: #555; user-select: none;">CIP program details for ${s.INSTNM}</summary>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem; font-size: 0.82rem;">
                <div>
                  <strong>Top 5 by graduates:</strong>
                  <ol style="margin: 0.3rem 0; padding-left: 1.2rem;">
                    ${top5.map(p => html`<li>${p.cip_label} (${p.total_awards.toLocaleString()})</li>`)}
                  </ol>
                </div>
                <div>
                  <strong>5 rarest programs:</strong>
                  <ol style="margin: 0.3rem 0; padding-left: 1.2rem;">
                    ${rare5.map(p => html`<li>${p.cip_label} (offered at ${p.schoolCount.toLocaleString()} schools)</li>`)}
                  </ol>
                </div>
              </div>
            </details>
          </div>`}
    </div>`);
  }
} else if (findBtn > 0 && searchLines.length > 0 && uniqueMatched.length === 0) {
  display(html`<p><em>No schools matched.</em></p>`);
}
```
