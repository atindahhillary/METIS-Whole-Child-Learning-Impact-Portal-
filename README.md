# Metis Whole Child Learning Impact Portal

**Live:** https://atindahhillary.github.io/METIS-Whole-Child-Learning-Impact-Portal-/

A concept prototype of an impact portal built around how Metis already works: the **METIS Way** (Make meaning, Empathize, Tackle, Iterate, Share) organises the navigation, and Metis's **North Star** learner outcomes (Agency, Belonging, Creativity, Delight, Expertise) sit at the centre of every dashboard, drawn as children rather than letters.

> Concept prototype by Hillary Atindah. Not an official Metis platform. All figures are fictional sample data. Anything you add is saved in your own browser only.

## What it does

| METIS Way | Area | What it does |
|---|---|---|
| | Dashboard | A different dashboard for each role (see below). The North Star appears as ten children per outcome, one lit for every lesson in ten where children clearly showed it, with a sparkle on each one gained since Term 1. Every chart carries a one-line Metis caption, and the dashboards update live as data is saved |
| m | Design map | The design thinking map: challenge, needs, objectives, outcome chain, impact and the expert council's requirements |
| e | Voices | Anonymous, consented quotes from learners, teachers, caregivers and Fellows, tagged by North Star outcome |
| t | Programmes | Fellowship, InnovatED, Whole Child Schools, Kenya EdTech Testbed, Knowledge Sharing Events |
| i | Teacher check-in | A two-minute, phone-friendly check-in for teachers, in English or Kiswahili: tool use, time saved, class make-up, North Star outcomes seen, support needed |
| i | Add data | Forms and CSV uploads for seven datasets, checked as rows are added |
| i | Review and trust | M&E verifies submissions or returns them with a note, and every submission keeps a dated history. Only verified data counts |
| i | Pause and adapt | Decision prompts from rules agreed in advance, plus a decision log that links decisions to prompts and flags overdue reviews |
| s | Partner report | Verified-only report with ready-to-use sentences, what we're learning, sources and sample sizes; prints to PDF and downloads verified figures as CSV |

## Roles

Switch role from the top bar. Each role gets its own dashboard and only the menu items it needs.

| Role | Dashboard | What it shows |
|---|---|---|
| **Decision maker** (Programs Manager, Director) | Leadership view | Headline tiles, the North Star children, term-by-term progress, funnel, cost against results, map, school heatmap, Fellowship, teacher reports, decisions due and a live activity feed. Records decisions against prompts |
| **Program staff** (Lead Coaches, Codifier, Associates) | Programme view | This week's to-do list (returned submissions, missing event data, Fellows and teachers needing support), activity, teacher reports, Fellowship, events, the evidence ladder and the map. Adds data |
| **M&E** | Data trust view | Review queue with check results, what the checks found, held-back and flagged rows, how fresh each dataset is, and activity. Verifies or returns submissions |
| **Teacher** | My classroom | A check-in prompt, their own check-ins from this device, what teachers are seeing as children, time saved, ideas from other teachers and the support teachers asked for. Menu: Dashboard, Voices, Teacher check-in |
| **Partner** (funders and partners) | Partner view | Verified results only: the North Star children, progress, reach map, what teachers are seeing, events, evidence ladder, voices and the partner report. No delivery comparisons, held-back rows or decision prompts |

## Live updates

- Numbers count up and charts draw themselves in when a dashboard opens.
- A card whose data changed since you last saw it pulses and shows an **Updated** tag.
- **Just in** lists the latest submissions, reviews, decisions and voices.
- The **Live** badge in the top bar shows when data was last saved. Open the portal in two tabs (say, a teacher check-in in one and the M&E dashboard in the other) and the second tab updates on its own when the first saves.

## Data checks

Every row is checked when it's added and again whenever figures are calculated.

| Check | Example | Effect |
|---|---|---|
| Completed can't exceed registered | 22 completed, 18 registered | Row held back from every figure |
| Percentages 0 to 100 | 130% using the tool | Row left out of use figures |
| Required values | Use not recorded | Row left out of use figures |
| Small groups | 3 teachers in a session | Flagged; counted but never used alone |
| Cost outliers | More than twice the median | Flagged for a finance check |
| Name phrases | "my name is", "naitwa", "jina langu ni" in notes or quotes | Blocked until removed |
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
assets/js/kenya-map.js      Kenya's 47 county outlines and national border as SVG paths (generated)
tools/build_kenya_map.py    Rebuilds kenya-map.js from geoBoundaries data
assets/img/                 Logo and icon
templates/                  CSV templates for each dataset
docs/DESIGN-THINKING-MAP.md The design thinking map
```

## Sources

The METIS Way Toolkit; metiscollective.org; the Metis North Star as described by Yale School of Management (2022); Kenya Basic Education Curriculum Framework; Guskey's five levels of professional development evaluation; Kenya Data Protection Act (2019). County and national boundaries: geoBoundaries gbOpen KEN ADM1 and ADM0 (RCMRD GeoPortal), public domain.
