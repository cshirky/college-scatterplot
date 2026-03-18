# Handoff: feature/discover branch

## What we're building

A new student-facing discovery flow for the college dashboard. Target audience: high school students who want to find colleges they don't know about that might be a good fit.

## Interaction model (agreed)

Three-step flow on a new page (`src/discover.md`):

1. **Seed schools** — Student enters colleges they're already thinking about (reuses the autocomplete textarea from twins.md)
2. **About you** — Condensed vibe + academic preferences (draws on existing vibe.md / academics.md questionnaire data)
3. **Discover** — Recommended schools shown as cards, each with:
   - Pre-written framing about why this type of school is worth knowing
   - AI-personalized sentence or two about fit (calls Claude API)
   - "Save to my list" button

## Key decisions made

- **Discovery engine**: Both combined — use seed schools as twins-algorithm seeds, then filter/rank by stated preferences
- **AI guidance**: Hybrid — pre-written framing + AI-personalized details via Claude API
- **Card persistence**: Shareable URL — collection encoded in URL hash (base64 UNITID array)
- **AI backend**: Start with client-side API key; move to serverless proxy before real user testing

## New files to create

- `src/discover.md` — main flow page
- `src/components/aiService.js` — thin Anthropic API wrapper (client-side key now, proxy-swappable later)
- `src/components/cardCollection.js` — URL hash encode/decode + saved list UI

## Existing code to reuse

- `src/components/collegeCard.js` — already built college card component
- `src/twins.md` — twins algorithm (cosineSimilarity, twinScore, findTwins functions)
- `src/vibe.md` + `src/academics.md` — existing questionnaire pages
- `src/data/vibe-questions.json.js` + `src/data/academic-questions.json.js` — questionnaire data
- `src/data/institutions.csv` — now includes relaffil_label, athletic_association, ncaa_division, sports_offered

## Repo state

- Branch: `feature/discover` (just created, branched from main at 67a11a8)
- Main is clean and up to date
- Git identity: Clay Shirky <cshirky@gmail.com>
- Local path: /home/cshirky/college-dashboard

## Setup

```bash
cd ~/college-dashboard
git checkout feature/discover
npx observable preview   # dev server at http://127.0.0.1:3000
```

Python venv is at `.venv/` if pipeline work is needed.

## Data available in institutions.csv

Key columns relevant to this feature:
- UNITID, INSTNM, CITY, STABBR
- admission_rate, grad_rate_6yr, enrollment_ug
- sector_label, locale_group
- sat_avg, act_avg, yield_rate
- pct_pell, pct_women, racial demographics
- tuition_in_state, tuition_out_of_state
- relaffil_label (religious affiliation, null = secular)
- athletic_association, ncaa_division, sports_offered
- grad_ratio (none/minority/majority grad students)
