---
title: Find Your College
---

```js
import { collegeCard } from "./components/collegeCard.js";
const institutions = FileAttachment("data/institutions.csv").csv({typed: true});
```

```js
// Pick a recognizable mid-selectivity school as the sample card
const sampleSchool =
  institutions.find(d => d.INSTNM === "James Madison University") ||
  institutions.find(d => d.INSTNM === "University of Vermont") ||
  institutions.find(d => d.admission_rate != null && d.admission_rate > 20 && d.admission_rate < 50);
```

<div style="max-width: 680px; margin: 0 auto;">

<div style="
  padding: 2rem 2rem 1.75rem;
  background: linear-gradient(135deg, #1e3a8a 0%, #4e79a7 100%);
  border-radius: 12px;
  margin-bottom: 2rem;
  color: white;
">
  <h1 style="margin: 0 0 0.6rem; font-size: 2rem; font-weight: 700; color: white;">Find colleges that might be a good fit for you.</h1>
  <p style="margin: 0; font-size: 1.1rem; opacity: 0.9; line-height: 1.55;">That's it. That's all this site is for.</p>
</div>

The basic interaction on this site is simple: you tell us a bit about yourself. We tell you a bit about how higher education in the U.S. works. We show you some schools that might be a good fit. You tell us which ones interest you, we show you more options, and so on.

Every time you see a **school card** — like this one — you can save it to a deck (a page listing schools you are interested in):

```js
display(html`<div style="max-width: 280px; margin: 1.5rem 0 0.5rem;">${sampleSchool ? collegeCard(sampleSchool) : ""}</div>`);
```

<p style="font-size: 0.88rem; color: #666; font-style: italic; margin-top: 0.25rem;">↑ Try clicking "Extended data" or "+ Add to deck"</p>

We'll explain everything on a school card later. Once you've saved a list of cards, you can bookmark that page and come back to it, or share it with friends, family members, or guidance counselors. **We won't ask you to create an account** — so be sure to save or bookmark anything you want to keep.

---

## A few things we assume about you

<div style="
  background: #f8faff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin: 1rem 0;
">

- You are an American high school student
- You are a **B student or better** (around a 3.0 GPA, 1100 SAT, or 22 ACT)
- You want to go to a college that **selects it's applicants** rather than admitting most of them
- You want lots of **academic options**, even if you already know what you want to do after college
- You want to go to a school with **lots of kinds of people**, not one that mainly serves one gender or ethnicity

</div>

If those things aren't all true for you, you're still welcome here — maybe you're an international student, transferring, or interested in a music conservatory, art school, women's college, or HBCU. But the site is built for students headed to selective, broad-curriculum colleges.

---

## Where would you like to start?

```js
display(html`<div style="
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0 2rem;
">
  <a href="/school-card" style="
    display: block;
    padding: 1.25rem 1rem;
    background: #fff;
    border: 2px solid #bfdbfe;
    border-radius: 10px;
    text-decoration: none;
    color: #1e3a8a;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.4;
    transition: background 0.15s;
  " onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#fff'">
    <div style="font-size: 1.6rem; margin-bottom: 0.5rem;">🎓</div>
    Show me how to read a School Card
  </a>
  <a href="/landscape" style="
    display: block;
    padding: 1.25rem 1rem;
    background: #fff;
    border: 2px solid #bbf7d0;
    border-radius: 10px;
    text-decoration: none;
    color: #14532d;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.4;
  " onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background='#fff'">
    <div style="font-size: 1.6rem; margin-bottom: 0.5rem;">🗺️</div>
    Tell me about the landscape of colleges in the U.S.
  </a>
  <a href="/vibe" style="
    display: block;
    padding: 1.25rem 1rem;
    background: #fff;
    border: 2px solid #fed7aa;
    border-radius: 10px;
    text-decoration: none;
    color: #9a3412;
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.4;
  " onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='#fff'">
    <div style="font-size: 1.6rem; margin-bottom: 0.5rem;">👋</div>
    Let me tell you some things about me
  </a>
</div>`);
```

</div>
