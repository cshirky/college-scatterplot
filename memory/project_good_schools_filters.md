---
name: good_schools filter decisions
description: Design decisions about what's in/out of good_schools.csv and planned UI features
type: project
---

HBCUs and women's colleges are excluded from good_schools.csv by default.

**Why:** The list is designed for general-audience B+ high school students; HBCUs and women's colleges serve specific populations and should be opt-in rather than default.

**How to apply:** The dashboard should include checkboxes (off by default) to include HBCUs and/or women's colleges in search results. These schools live outside good_schools.csv and would need to be loaded from a separate file or the full institutions.csv when the user opts in.
