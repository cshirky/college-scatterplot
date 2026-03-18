---
title: How to Read a School Card
---

```js
import { collegeCard } from "./components/collegeCard.js";
const institutions = FileAttachment("data/institutions.csv").csv({typed: true});
```

```js
const sampleSchool =
  institutions.find(d => d.INSTNM === "James Madison University") ||
  institutions.find(d => d.admission_rate != null && d.admission_rate > 20 && d.admission_rate < 50);
```

<div style="max-width: 680px; margin: 0 auto;">

<p style="font-size: 1.05rem; color: #555; margin-bottom: 2rem;">
  ← <a href="/intro">Back to the start</a>
</p>

Every school in this site can be summarized in a **school card**. Here's a sample — we'll walk through what each piece means.

```js
display(html`<div style="max-width: 280px; margin: 1.5rem 0 2rem;">${sampleSchool ? collegeCard(sampleSchool) : ""}</div>`);
```

---

## What's on a school card

*This page is coming soon. We'll explain admission rate, graduation rate, enrollment, Pell recipients, and more.*

<div style="
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  color: #78350f;
  font-size: 0.95rem;
  line-height: 1.6;
">
  🚧 <strong>Under construction.</strong> Check back soon for a full walkthrough of school card data.
</div>

---

<p style="margin-top: 2rem;">
  Ready to keep going? <a href="/intro">← Back to the start</a> or jump to <a href="/vibe">tell us about yourself →</a>
</p>

</div>
