# Metis Whole Child Learning Impact Portal

**Live:** https://atindahhillary.github.io/METIS-Whole-Child-Learning-Impact-Portal-/

A concept prototype of an impact portal built around how Metis already works: the **METIS Way** (Make meaning, Empathize, Tackle, Iterate, Share) organises the navigation, and Metis's **North Star** learner outcomes (Agency, Belonging, Creativity, Delight, Expertise) sit at the centre of the dashboard.

> Concept prototype by Hillary Atindah. Not an official Metis platform. All figures are fictional sample data. Anything you add is saved in your own browser only.

## What it does

| METIS Way | Area | What it does |
|---|---|---|
| | Dashboard | Stat tiles, the North Star puzzle, outcome trends, a registration-to-use funnel, cost-against-results bubbles, a Kenya county map, a school heatmap, Fellowship waffle and Guskey staircase, a feedback bullet chart, an event pictogram, the EdTech evidence ladder, open decisions and a learner voice |
| m | Design map | The design thinking map: challenge, needs, objectives, outcome chain, impact and the expert council's requirements |
| e | Voices | Anonymous, consented quotes from learners, teachers, caregivers and Fellows, tagged by North Star outcome |
| t | Programmes | Fellowship, InnovatED, Whole Child Schools, Kenya EdTech Testbed, Knowledge Sharing Events |
| i | Add data | Forms and CSV uploads for six datasets, checked as rows are added |
| i | Review and trust | M&E verifies submissions or returns them with a note. Only verified data counts |
| i | Pause and adapt | Decision prompts from rules agreed in advance, plus a decision log |
| s | Donor report | Verified-only report with ready-to-use sentences, sources and sample sizes; prints to PDF |

## Roles

Switch role from the top bar.

- **Program staff** (Lead Coaches, Codifier, Associates, partners): add data, see everything internal.
- **M&E:** verify or return submissions.
- **Decision maker** (Programs Manager, Director): record decisions against prompts.
- **Donor:** verified data only; data entry, review and decisions are hidden.

## Data checks

Every row is checked when it's added and again whenever figures are calculated.

| Check | Example | Effect |
|---|---|---|
| Completed can't exceed registered | 22 completed, 18 registered | Row held back from every figure |
| Percentages 0 to 100 | 130% using the tool | Row left out of use figures |
| Required values | Use not recorded | Row left out of use figures |
| Small groups | 3 teachers in a session | Flagged; counted but never used alone |
| Cost outliers | More than twice the median | Flagged for a finance check |
| Personal data guard | Columns like `name`, `phone`, `upi`, `nemis`, `admission`; values that look like phone numbers or emails | Upload blocked |

Key measure: **cost per teacher using the tool** (cost per completer divided by the share using the tool at eight weeks), which counts drop-out and non-use that cost per completer hides.

## Adding data

Open **Add data**, pick a dataset, then either download the CSV template, fill it in any spreadsheet app and upload it, or add rows one at a time. Templates are also in [`templates/`](templates/).

Data is stored in the browser (`localStorage`). Use **Export data** and **Import data** in the sidebar to move a dataset between people or devices, and **Reset sample data** to start again.

## Running it locally

No build step. Open `index.html` in a browser, or serve the folder:

```
python -m http.server 8000
```

## Next step: shared data

This prototype keeps data in each browser. For a shared, multi-user version the same data model (`submissions`, `voices`, `decisions`) maps directly onto a hosted database with sign-in, for example Supabase with row-level security per role. The views would not need to change.

## Files

```
index.html                  App shell
assets/css/portal.css       Styles (Metis teal, navy, orange; Poppins and Inter)
assets/js/data.js           Programme config, dataset schemas, sample data, design map
assets/js/app.js            Checks, metrics, decision prompts, views
assets/js/kenya-map.js      Kenya's 47 county outlines as SVG paths (generated)
tools/build_kenya_map.py    Rebuilds kenya-map.js from geoBoundaries data
assets/img/                 Logo and icon
templates/                  CSV templates for each dataset
docs/DESIGN-THINKING-MAP.md The design thinking map
```

## Sources

The METIS Way Toolkit; metiscollective.org; the Metis North Star as described by Yale School of Management (2022); Kenya Basic Education Curriculum Framework; Guskey's five levels of professional development evaluation; Kenya Data Protection Act (2019). County boundaries: geoBoundaries gbOpen KEN ADM1 (RCMRD GeoPortal), public domain.
