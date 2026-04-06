---
name: College Dashboard Project Overview
description: Architecture, data sources, branches, and key design decisions for the Carnegie 2025 college dashboard
type: project
---

## Project: Carnegie 2025 College Dashboard

Observable Framework app (`src/`) with Python data pipeline (`data/pipeline/`).

### Branches
- `master` — original IPEDS 2023 dashboard (admission rate vs grad rate scatterplot, pandas-based pipeline)
- `Carnegie-Data` — rebuilt dashboard using Carnegie 2025 classification files as primary source

### Data Sources (Carnegie-Data branch)
1. **2025-Public-Data-File.xlsx** (project root) — 3927 institutions, 94 columns. Carnegie 2025 IC/SAEC/Research classifications, College Scorecard metrics (net price, debt, 8-yr outcomes), earnings, equity ratios.
2. **2025-SAEC-Public-Data-File.xlsx** (project root) — 205 columns. State recruitment patterns, CBSA data, detailed URM/Pell ratios.
3. **IPEDS 2023 raw files** (`data/raw/`) — already downloaded. Provides: admission rates (DVADM01, 0-100%), grad rates, enrollment, SAT/ACT, tuition, religious affiliation, athletics, CIP completions.
4. **IPEDS HD2024** — downloaded during pipeline run. Updated institution directory (coordinates, website, locale).

### Pipeline
- `data/pipeline/build_carnegie.py` — Python stdlib only (no pandas). Reads xlsx via zipfile+xml, joins IPEDS CSVs, outputs to `data/output/` and copies to `src/data/`.
- `data/pipeline/download_carnegie.sh` — downloads IPEDS supplemental files.

### Key field mapping decisions
- `admission_rate` = IPEDS DVADM01 (0-100 % scale). **NOT** from Carnegie/Scorecard OMEN* fields.
- `OMENRAP_ALL_POOLED_SUPP` = 8-yr transfer-out rate (not admission rate — common confusion!)
- `OMAWDP8_ALL_POOLED_SUPP` = 8-yr completion rate (0-1 decimal → stored as %)
- `pell_2023` = 0-1 decimal (multiply ×100 for display)
- `saec_earnings` = median earnings in dollars
- `setting2025` = campus residential setting (1-9, NOT geographic urban/rural)
- `locale_group` = geographic City/Suburb/Town/Rural from IPEDS HD locale code

**Why:** Carnegie OMEN* variables were mistakenly identified as admission rates. The real admission rate from College Scorecard would be `ADM_RATE` but that's not in the Carnegie file; IPEDS DVADM01 is used instead.

### New Carnegie-specific UI features
- SAEC classification filter (`saec2025name`): Higher/Lower Access × Higher/Medium/Lower Earnings
- Setting filter (`setting2025name`): Highly residential → Mostly part-time
- Earnings/equity panel in institution detail (Carnegie outcomes data)
- Special designation badges: HBCU, HSI, Women's, Tribal
- New plot axes: earnings_ratio, access_ratio, net_price, completion_rate_8yr
- Compare page: HBCU/HSI toggles and SAEC classification grouping
