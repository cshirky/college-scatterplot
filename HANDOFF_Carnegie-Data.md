# Handoff: Carnegie-Data Branch

**Date:** 2026-04-04
**Branch:** `Carnegie-Data`

## What we did

### Extracted US News rankings data

- Saved `usnwr_national_universities_2026.html` from usnews.com (saved manually by user, since US News requires JavaScript rendering)
- Wrote a Python regex extraction script to pull school names + URLs from the embedded JSON in the HTML
- Output: `usnwr_national_universities_2026.csv` — 436 schools, format: `"School_Name",URL`

### Extraction approach

US News embeds school data as JSON in the page HTML. The working pattern:

```python
pattern = r'/best-colleges/([\w-]+-\d+)[^}]{0,500}?\"name\"\s*:\s*\"([A-Z][^\"]{5,80})\"'
matches = re.findall(pattern, content, re.DOTALL)
```

This finds URL slugs (ending in numeric IPEDS-style IDs) paired with the following `"name"` field in the JSON blob.

## Next steps

We need the same treatment for the remaining 9 ranking categories. User will save HTML files locally; then we run the same extraction script on each:

| Category | Expected filename |
|---|---|
| Liberal Arts Colleges | `usnwr_liberal_arts_2026.html` |
| Regional Universities North | `usnwr_regional_universities_north_2026.html` |
| Regional Universities South | `usnwr_regional_universities_south_2026.html` |
| Regional Universities Midwest | `usnwr_regional_universities_midwest_2026.html` |
| Regional Universities West | `usnwr_regional_universities_west_2026.html` |
| Regional Colleges North | `usnwr_regional_colleges_north_2026.html` |
| Regional Colleges South | `usnwr_regional_colleges_south_2026.html` |
| Regional Colleges Midwest | `usnwr_regional_colleges_midwest_2026.html` |
| Regional Colleges West | `usnwr_regional_colleges_west_2026.html` |

Once all 10 CSVs are generated, the plan is to use them as a classification layer in the Carnegie-Data branch dashboard.

## Branch context

- `Carnegie-Data` was branched from `main` and rebuilt the dashboard around Carnegie 2025 classifications
- The stashed changes from `feature/discover` (HANDOFF.md, institutions.csv, schools-slug.csv, etc.) are still in the stash on that branch
