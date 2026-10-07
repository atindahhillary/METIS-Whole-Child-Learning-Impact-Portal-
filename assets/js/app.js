/* Metis Whole Child Learning Impact Portal (concept prototype). Vanilla JS, no build step. */
(function () {
  "use strict";
  const C = window.METIS_CONFIG;
  const STORE = "metis-wcl-portal-v1";
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- state ---------- */
  const fresh = () => JSON.parse(JSON.stringify(C.seed));
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) { const p = JSON.parse(raw); if (p && p.version === C.version && Array.isArray(p.submissions)) return p; }
    } catch (e) { /* storage unavailable: fall back to sample data */ }
    return null;
  }
  let state = load() || fresh();
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  /* ---------- helpers ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = n => (isFinite(n) ? Math.round(n).toLocaleString("en-US") : "n/a");
  const pct = x => (isFinite(x) ? Math.round(x * 100) + "%" : "n/a");
  const kes = n => "KES " + fmt(n);
  const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
  const mean = arr => (arr.length ? sum(arr) / arr.length : NaN);
  const median = arr => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const termIdx = t => C.TERMS.findIndex(x => x.id === t);
  const termLabel = t => (C.TERMS.find(x => x.id === t) || { label: esc(t) }).label;
  const today = () => new Date().toISOString().slice(0, 10);
  const uid = p => p + "-" + Math.random().toString(36).slice(2, 8);
  const roleOf = () => C.ROLES.find(r => r.id === state.role) || C.ROLES[0];
  const isDonor = () => state.role === "donor";
  const can = { add: () => state.role !== "donor", verify: () => state.role === "me", decide: () => state.role === "lead" };
  const prettyDate = d => { const x = new Date(d + "T00:00:00"); return isNaN(x) ? esc(d) : x.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

  /* ---------- data checks ---------- */
  const PII_HEADER = /(^|_)(name|names|firstname|first_name|lastname|last_name|surname|full_name|phone|mobile|tel|telephone|email|e_mail|id_no|idno|id_number|national_id|upi|nemis|admission|adm_no|birth|dob|date_of_birth|parent|guardian|address)(_|$)/;
  const PII_VALUE = /(\+?254|\b0)[17]\d{8}\b|[^\s@]+@[^\s@]+\.[a-z]{2,}/i;

  function checkRows(dsKey, rows) {
    const ds = C.DATASETS[dsKey];
    const res = rows.map(row => {
      const issues = [];
      for (const f of ds.fields) {
        const raw = row[f.key];
        const empty = raw === undefined || raw === null || String(raw).trim() === "";
        if (empty) {
          if (f.required) issues.push({ level: "fail", excl: "row", msg: `${f.label} is missing` });
          else if (f.missingExcl) issues.push({ level: "flag", excl: f.missingExcl, msg: `${f.label} not recorded, so this row is left out of use figures` });
          continue;
        }
        if (["int", "num", "pct"].includes(f.type)) {
          const v = Number(raw);
          const ex = f.rangeExcl || "row";
          if (!isFinite(v)) { issues.push({ level: "fail", excl: ex, msg: `${f.label} must be a number` }); continue; }
          if (f.type === "int" && !Number.isInteger(v)) issues.push({ level: "fail", excl: ex, msg: `${f.label} must be a whole number` });
          if (f.type === "pct" && (v < 0 || v > 100)) issues.push({ level: "fail", excl: ex, msg: `${f.label} is ${v}%, which is impossible` });
          if (f.min != null && v < f.min) issues.push({ level: "fail", excl: ex, msg: `${f.label} can't be below ${f.min}` });
          if (f.max != null && v > f.max) issues.push({ level: "fail", excl: ex, msg: `${f.label} can't be above ${f.max}` });
        } else if (f.type === "select" && !f.options.includes(String(raw))) {
          issues.push({ level: "fail", excl: "row", msg: `${f.label} "${raw}" isn't one of the allowed values` });
        }
      }
      if (dsKey === "innovated_sites") {
        const reg = Number(row.registered), comp = Number(row.completed);
        if (isFinite(reg) && isFinite(comp) && comp > reg) issues.push({ level: "fail", excl: "row", msg: `${comp} completed but only ${reg} registered` });
        if (isFinite(reg) && reg > 0 && reg < 10) issues.push({ level: "flag", excl: null, msg: `Only ${reg} teachers, so percentages mean little. Counted, never used alone for a conclusion` });
      }
      if (dsKey === "school_obs") {
        const l = Number(row.lessons_observed);
        if (isFinite(l) && l < 5) issues.push({ level: "flag", excl: null, msg: `Only ${l} lessons observed, so treat this school's figures as indicative` });
      }
      if (dsKey === "event_attendance" && Number(row.commitments_followed) > Number(row.commitments_made)) {
        issues.push({ level: "fail", excl: "row", msg: "More commitments followed up than were made" });
      }
      for (const [k, v] of Object.entries(row)) {
        if (typeof v === "string" && PII_VALUE.test(v)) issues.push({ level: "fail", excl: "row", msg: `"${k}" looks like it holds a phone number or email address` });
      }
      return { issues };
    });
    if (dsKey === "innovated_sites") {
      const med = median(rows.map(r => Number(r.cost_per_completer)).filter(v => isFinite(v) && v > 0));
      rows.forEach((r, i) => {
        const c = Number(r.cost_per_completer);
        if (isFinite(c) && med && c > 2 * med) res[i].issues.push({ level: "flag", excl: null, msg: `Cost is more than twice the median (${kes(med)}). Check it against the finance ledger` });
      });
    }
    return res.map(r => ({
      ...r,
      level: r.issues.some(i => i.level === "fail") ? "fail" : r.issues.length ? "flag" : "pass",
      exclRow: r.issues.some(i => i.excl === "row"),
      exclUse: r.issues.some(i => i.excl === "use")
    }));
  }
  function checkLabel(res) {
    if (res.exclRow) return { cls: "bad", text: "Held back" };
    if (res.exclUse) return { cls: "warn", text: "Out of use figures" };
    if (res.level === "flag") return { cls: "warn", text: "Flagged" };
    return { cls: "ok", text: "Passed" };
  }

  /* ---------- selectors ---------- */
  const subsOf = (ds, status) => state.submissions.filter(s => s.dataset === ds && (!status || s.status === status));
  function verifiedItems(ds, term) {
    const out = [];
    subsOf(ds, "verified").filter(s => !term || s.term === term).forEach(s => {
      const res = checkRows(s.dataset, s.rows);
      s.rows.forEach((row, i) => out.push({ row, res: res[i], sub: s }));
    });
    return out;
  }
  function latestTerm(ds) {
    const terms = subsOf(ds, "verified").map(s => s.term);
    return terms.sort((a, b) => termIdx(a) - termIdx(b)).pop() || null;
  }
  const pending = () => state.submissions.filter(s => s.status === "submitted");

  /* ---------- metrics ---------- */
  function innovatedAgg(items) {
    const base = items.filter(x => !x.res.exclRow);
    const useI = base.filter(x => !x.res.exclUse);
    const registered = sum(base, x => +x.row.registered), completed = sum(base, x => +x.row.completed);
    const cost = sum(base, x => x.row.completed * x.row.cost_per_completer);
    const useCompleted = sum(useI, x => +x.row.completed), useRegistered = sum(useI, x => +x.row.registered);
    const users = sum(useI, x => x.row.completed * x.row.using_pct / 100);
    const useCost = sum(useI, x => x.row.completed * x.row.cost_per_completer);
    return {
      base, useI, sites: base.length, useSites: useI.length, registered, completed, completion: completed / registered,
      costPerCompleter: cost / completed, useCompleted, useRegistered, users, usePct: users / useCompleted,
      per100: users / useRegistered * 100, costPerActive: useCost / users, counties: new Set(base.map(x => x.row.county)).size
    };
  }
  function innovated() {
    const term = latestTerm("innovated_sites");
    if (!term) return null;
    const items = verifiedItems("innovated_sites", term);
    const all = innovatedAgg(items);
    const metis = innovatedAgg(items.filter(x => x.row.delivered_by === "Metis"));
    const partner = innovatedAgg(items.filter(x => x.row.delivered_by === "Partner"));
    const both = [...new Set(all.useI.map(x => x.row.county))].filter(c =>
      all.useI.some(x => x.row.county === c && x.row.delivered_by === "Metis") && all.useI.some(x => x.row.county === c && x.row.delivered_by === "Partner"));
    const inBoth = items.filter(x => both.includes(x.row.county));
    return {
      term, items, ...all, metis, partner, sameCounties: both,
      metisSame: innovatedAgg(inBoth.filter(x => x.row.delivered_by === "Metis")),
      partnerSame: innovatedAgg(inBoth.filter(x => x.row.delivered_by === "Partner")),
      heldBack: items.filter(x => x.res.exclRow || x.res.exclUse)
    };
  }
  function northStar(term, schoolIds) {
    let items = verifiedItems("school_obs", term).filter(x => !x.res.exclRow);
    if (schoolIds) items = items.filter(x => schoolIds.includes(x.row.school));
    return {
      term, schools: items.map(x => x.row.school), lessons: sum(items, x => +x.row.lessons_observed),
      values: C.NORTH_STAR.map(o => ({ ...o, value: mean(items.map(x => +x.row[o.key + "_pct"])) }))
    };
  }
  function northStarNow() {
    const t = latestTerm("school_obs");
    if (!t) return null;
    const now = northStar(t);
    const first = C.TERMS.find(x => northStar(x.id, now.schools).schools.length === now.schools.length);
    const base = first && first.id !== t ? northStar(first.id, now.schools) : null;
    now.values.forEach((v, i) => { v.base = base ? base.values[i].value : NaN; });
    return { ...now, baseTerm: base ? first.id : null };
  }
  function fellowship() {
    const t = latestTerm("fellow_pulse");
    const rows = t ? verifiedItems("fellow_pulse", t).filter(x => !x.res.exclRow).map(x => x.row) : [];
    const n = rows.length;
    const fb = verifiedItems("feedback_log").filter(x => !x.res.exclRow).map(x => x.row).sort((a, b) => termIdx(a.period) - termIdx(b.period));
    return {
      term: t, rows, n,
      led: rows.filter(r => r.led_full_test === "Yes").length,
      sponsor: rows.filter(r => r.sponsor_active === "Yes").length,
      learner: rows.filter(r => r.learner_data === "Yes").length,
      m2: rows.filter(r => +r.milestones_done >= 2).length,
      relevant: rows.filter(r => +r.relevance >= 4).length,
      over15: rows.filter(r => +r.hours > 15).length,
      belonging: mean(rows.map(r => +r.belonging)),
      status: ["On track", "Needs support", "Re-sprint"].map(s => [s, rows.filter(r => r.status === s).length]),
      feedback: fb, fbNow: fb[fb.length - 1]
    };
  }
  function events() {
    const rows = verifiedItems("event_attendance").filter(x => !x.res.exclRow).map(x => x.row);
    const groups = [["teachers", "Teachers"], ["school_leaders", "School leaders"], ["county_officials", "County officials"], ["funders", "Funders and partners"], ["fellows", "Fellows"]];
    const att = r => sum(groups, g => +r[g[0]]);
    return {
      rows, groups, att, attendees: sum(rows, att), county: sum(rows, r => +r.county_officials),
      made: sum(rows, r => +r.commitments_made), followed: sum(rows, r => +r.commitments_followed)
    };
  }
  function testbed() {
    const v = verifiedItems("testbed_pilot").filter(x => !x.res.exclRow).map(x => ({ ...x.row, status: "verified" }));
    const p = subsOf("testbed_pilot", "submitted").flatMap(s => s.rows.map(r => ({ ...r, status: "submitted" })));
    return { verified: v, pending: p, learners: sum(v, r => +r.learners), strong: v.filter(r => ["Comparison group", "Randomised trial"].includes(r.evidence)) };
  }
  function trust() {
    let rows = 0, held = 0, flagged = 0;
    state.submissions.forEach(s => { checkRows(s.dataset, s.rows).forEach(r => { rows++; if (r.exclRow || r.exclUse) held++; else if (r.level === "flag") flagged++; }); });
    const total = state.submissions.length, verified = state.submissions.filter(s => s.status === "verified").length;
    return { total, verified, pending: pending().length, returned: state.submissions.filter(s => s.status === "returned").length, rows, held, flagged };
  }

  /* ---------- decision prompts ---------- */
  function prompts() {
    const list = [], onTrack = [];
    const m = innovated();
    if (m) {
      const low = m.useI.filter(x => x.row.delivered_by === "Partner" && +x.row.using_pct < 45);
      if (low.length) list.push({
        id: "partner-use", sev: "decide", route: "programs/innovated",
        title: `${low.length} partner-led InnovatED sites are below 45% use at eight weeks`,
        evidence: low.map(x => `Site ${x.row.site}, ${x.row.county}: ${x.row.using_pct}%`).join(" · "),
        rule: "Agreed rule: partner sites below 45% for two cycles in a row move to Metis-led delivery or a different partner. This is the first cycle.",
        options: ["Pilot Metis co-delivery plus two follow-ups at these sites next term", "Wait one more cycle, then apply the rule", "Move the lowest site now"]
      });
      const small = m.base.filter(x => +x.row.registered < 15);
      if (small.length) list.push({
        id: "small-sessions", sev: "decide", route: "programs/innovated",
        title: `${small.length} InnovatED sessions had fewer than 15 teachers`,
        evidence: small.map(x => `Site ${x.row.site}, ${x.row.county}: ${x.row.registered} registered, ${kes(x.row.cost_per_completer)} per completer`).join(" · "),
        rule: "Agreed rule: cluster nearby schools so every session has at least 15 teachers. Remote counties keep their sessions for equity, with local co-facilitators to cut travel.",
        options: ["Cluster schools for the next cohort", "Train two local co-facilitators in Turkana", "Keep as is and record the equity reason"]
      });
      if (m.heldBack.length) list.push({
        id: "data-held", sev: "watch", route: "review",
        title: `${m.heldBack.length} InnovatED sites have data held back by checks`,
        evidence: m.heldBack.map(x => `Site ${x.row.site}: ${x.res.issues.filter(i => i.excl).map(i => i.msg).join("; ")}`).join(" · "),
        rule: "Rows that fail checks stay out of the affected figures until the source registers are re-checked.",
        options: ["Ask the delivering team to re-check registers", "Call back a sample of teachers at these sites"]
      });
    }
    const f = fellowship();
    if (f.n) {
      if (f.over15 / f.n >= 0.5) list.push({
        id: "workload", sev: f.over15 / f.n > 0.5 ? "decide" : "watch", route: "programs/fellowship",
        title: `${f.over15} of ${f.n} Fellows spent more than 15 hours on the Fellowship last month`,
        evidence: `That is ${pct(f.over15 / f.n)} of the cohort. The commitment we ask for is about 15 hours a month.`,
        rule: "Agreed rule: if most Fellows report well over 15 hours, cut pre-work for the next sprint.",
        options: ["Trim pre-work for Sprint 4", "Check with coaches which tasks take longest", "No change yet; re-check next month"]
      });
      const support = f.rows.filter(r => r.status !== "On track");
      if (support.length) list.push({
        id: "fellow-support", sev: "watch", route: "programs/fellowship",
        title: `${support.length} Fellows need support or are re-sprinting`,
        evidence: support.map(r => `${r.fellow} (${r.status.toLowerCase()})`).join(" · "),
        rule: "Coaching hours move towards Fellows who need them most. Re-sprinting is a legitimate path, not a failure.",
        options: ["Move coaching hours to these Fellows", "Three-way call with sponsors where support is missing"]
      });
      if (f.fbNow) {
        if (+f.fbNow.median_days > 5) list.push({ id: "feedback", sev: "decide", route: "programs/fellowship", title: `Facilitation feedback takes ${f.fbNow.median_days} days (target 5)`, evidence: `${f.fbNow.feedback_items} pieces of feedback in ${termLabel(f.fbNow.period)}.`, rule: "Agreed target: written feedback within five working days, against the facilitation standard.", options: ["Pair coaches to clear the backlog", "Shorten the feedback format"] });
        else onTrack.push(`Facilitation feedback takes ${f.fbNow.median_days} days, inside the five-day target, and ${f.fbNow.against_standard_pct}% is written against the standard.`);
      }
    }
    const ns = northStarNow();
    if (ns) {
      const low = [...ns.values].sort((a, b) => a.value - b.value)[0];
      list.push({
        id: "north-star-low", sev: "watch", route: "programs/schools",
        title: `${low.name} is the lowest North Star outcome in partner schools (${Math.round(low.value)}%)`,
        evidence: `${low.name} was evident in ${Math.round(low.value)}% of observed lessons in ${termLabel(ns.term)}, across ${ns.schools.length} schools.`,
        rule: "Agreed rule: each term, school coaching focuses on the lowest North Star outcome.",
        options: [`Make ${low.name.toLowerCase()} next term's coaching focus`, "Share practice from the school with the highest score"]
      });
    }
    const old = pending().filter(s => (Date.now() - new Date(s.submittedAt + "T00:00:00")) / 864e5 > 3);
    if (old.length) list.push({
      id: "review-queue", sev: "watch", route: "review",
      title: `${old.length} submissions have waited more than three days for review`,
      evidence: old.map(s => s.title).join(" · "),
      rule: "Nothing counts until it is checked, so reviews should happen within three working days.",
      options: ["M&E clears the queue this week"]
    });
    if (m && m.completion >= 0.75) onTrack.push(`InnovatED completion is ${pct(m.completion)} across ${m.sites} sites.`);
    return { list, onTrack };
  }

  /* ---------- donor sentences ---------- */
  function donorSentences() {
    const out = [];
    const ns = northStarNow();
    if (ns && ns.baseTerm) {
      const gains = ns.values.map(v => ({ ...v, gain: v.value - v.base })).sort((a, b) => b.gain - a.gain);
      const allUp = gains.every(g => g.gain > 0);
      out.push({
        program: "Whole Child Schools",
        text: `Across ${ns.schools.length} partner schools, the share of observed lessons where learners clearly showed ${gains[0].name.toLowerCase()} rose from ${Math.round(gains[0].base)}% in ${termLabel(ns.baseTerm)} to ${Math.round(gains[0].value)}% in ${termLabel(ns.term)}${allUp ? ", and all five North Star outcomes rose over the same period" : ""}.`,
        source: "Structured classroom observations by Lead Coaches, checked by M&E", n: `n = ${ns.lessons} lessons observed in ${termLabel(ns.term)}`
      });
    }
    const m = innovated();
    if (m) out.push({
      program: "InnovatED",
      text: `In ${termLabel(m.term)}, ${fmt(m.completed)} of the ${fmt(m.registered)} teachers who registered at ${m.sites} sites across ${m.counties} counties completed InnovatED training (${pct(m.completion)}), and at the ${m.useSites} sites with reliable follow-up data, head teachers reported that ${pct(m.usePct)} of trained teachers were using the tool in their classrooms eight weeks later.`,
      source: "Attendance registers and head-teacher follow-up calls, checked by M&E", n: `n = ${fmt(m.useCompleted)} trained teachers with follow-up data`
    });
    const f = fellowship();
    if (f.n) out.push({
      program: "Metis Fellowship",
      text: `${f.led} of the ${f.n} Fellows in the current cohort have led their teams through a full design test, and ${f.learner} are now collecting evidence directly from learners.`,
      source: "Coach observation and sprint reviews, checked by M&E", n: `n = ${f.n} Fellows`
    });
    const e = events();
    if (e.rows.length) out.push({
      program: "Knowledge Sharing Events",
      text: `${fmt(e.attendees)} people took part in ${e.rows.length} Knowledge Sharing Events, including ${e.county} county education officials, and ${pct(e.followed / e.made)} of the commitments made at those events were followed up within a term.`,
      source: "Event registers and follow-up calls, checked by M&E", n: `n = ${e.made} commitments`
    });
    testbed().strong.forEach(p => out.push({
      program: "Kenya EdTech Testbed",
      text: `In the EdTech Testbed, ${p.pilot.charAt(0).toLowerCase() + p.pilot.slice(1)} was tested in ${p.schools} schools with ${fmt(p.learners)} learners. ${p.result}.`,
      source: `${p.evidence} design, checked by M&E`, n: `n = ${fmt(p.learners)} learners`
    }));
    return out;
  }

  /* ---------- charts ---------- */
  function piecePath(x, y, w, h, k, r, socket, knob) {
    const cy = y + h / 2;
    let d = `M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r}`;
    if (knob) d += ` V${cy - k} A${k},${k} 0 0 1 ${x + w},${cy + k}`;
    d += ` V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r}`;
    if (socket) d += ` V${cy + k} A${k},${k} 0 0 0 ${x},${cy - k}`;
    return d + ` V${y + r} Q${x},${y} ${x + r},${y} Z`;
  }
  let svgSeq = 0;
  function northStarSVG(ns) {
    const w = 150, h = 150, k = 17, r = 18, padX = 4, top = 4, n = ns.values.length;
    const W = n * w + k + padX * 2, H = h + top + 64, sid = "ns" + (++svgSeq);
    let defs = "", body = "";
    ns.values.forEach((o, i) => {
      const x = padX + i * w, y = top, d = piecePath(x, y, w, h, k, r, i > 0, i < n - 1);
      const fh = h * Math.max(0, Math.min(100, o.value)) / 100;
      const by = isFinite(o.base) ? y + h - h * o.base / 100 : null;
      const delta = isFinite(o.base) ? Math.round(o.value) - Math.round(o.base) : null;
      const tip = `${o.name}: evident in ${Math.round(o.value)}% of ${ns.lessons} observed lessons, ${ns.schools.length} schools, ${termLabel(ns.term)}.` +
        (by != null ? ` ${termLabel(ns.baseTerm)}: ${Math.round(o.base)}% for the same schools.` : "") + ` CBE link: ${o.cbe}.`;
      defs += `<clipPath id="${sid}-${i}"><path d="${d}"/></clipPath>`;
      body += `<g class="ns-piece" tabindex="0" data-tip="${esc(tip)}">
        <path d="${d}" class="ns-track"/>
        <rect clip-path="url(#${sid}-${i})" x="${x - 2}" y="${y + h - fh}" width="${w + k + 4}" height="${fh + 2}" class="ns-fill"/>
        ${by != null ? `<line clip-path="url(#${sid}-${i})" x1="${x}" x2="${x + w}" y1="${by}" y2="${by}" class="ns-base"/>` : ""}
        <path d="${d}" class="ns-edge"/>
        <text x="${x + 18}" y="${y + 52}" class="ns-letter">${o.letter}</text>
        <text x="${x + 18}" y="${y + h - 18}" class="ns-value ${fh > 34 ? "on-fill" : ""}">${Math.round(o.value)}%</text>
        <text x="${x + 4}" y="${y + h + 28}" class="ns-name">${o.name}</text>
        ${delta != null ? `<text x="${x + 4}" y="${y + h + 50}" class="ns-delta">${delta >= 0 ? "+" : ""}${delta} pts since ${termLabel(ns.baseTerm).replace(", 2026", "")}</text>` : ""}
      </g>`;
    });
    const label = ns.values.map(o => `${o.name} ${Math.round(o.value)}%`).join(", ");
    return `<div class="ns-scroll"><svg class="ns-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="North Star outcomes: ${esc(label)}"><defs>${defs}</defs>${body}</svg></div>`;
  }

  function dumbbellSVG(items) {
    const rows = items.map(x => ({ s: x.row.site, c: x.row.county, d: x.row.delivered_by, n: +x.row.registered, cpc: +x.row.cost_per_completer, cpu: x.row.cost_per_completer / (x.row.using_pct / 100) }))
      .sort((a, b) => a.cpu - b.cpu);
    const W = 900, left = 205, right = 70, top = 14, rowh = 30, H = top + rows.length * rowh + 36;
    const max = Math.ceil(Math.max(...rows.map(r => r.cpu)) / 4000) * 4000;
    const X = v => left + (W - left - right) * v / max;
    let g = "";
    for (let v = 0; v <= max; v += 4000) g += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 4}" y2="${top + rows.length * rowh}" class="grid"/><text x="${X(v)}" y="${top + rows.length * rowh + 18}" class="axis" text-anchor="middle">${fmt(v)}</text>`;
    rows.forEach((r, i) => {
      const y = top + i * rowh + rowh / 2, cls = r.d === "Metis" ? "s-metis" : "s-partner";
      const tip = `Site ${r.s}, ${r.c} (${r.d}-led): ${kes(r.cpc)} per teacher completed, ${kes(r.cpu)} per teacher using the tool.`;
      g += `<g data-tip="${esc(tip)}" tabindex="0" class="db-row">
        <rect x="0" y="${y - rowh / 2}" width="${W}" height="${rowh}" class="hit"/>
        <text x="${left - 12}" y="${y + 4.5}" text-anchor="end" class="lab"><tspan font-weight="700">${esc(r.s)}</tspan> ${esc(r.c)}${r.n < 10 ? " (" + r.n + " teachers)" : ""}</text>
        <line x1="${X(r.cpc)}" x2="${X(r.cpu)}" y1="${y}" y2="${y}" class="${cls} stem"/>
        <circle cx="${X(r.cpc)}" cy="${y}" r="5.5" class="${cls} hollow"/>
        <circle cx="${X(r.cpu)}" cy="${y}" r="6.5" class="${cls} solid"/>
        <text x="${X(r.cpu) + 11}" y="${y + 4.5}" class="val">${fmt(r.cpu)}</text></g>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Cost per teacher completed and per teacher using the tool, by site">${g}</svg>`;
  }

  function bars(items, opts = {}) {
    const max = opts.max || Math.max(...items.map(i => i.value), 1);
    return `<div class="bars">${items.map(i => `
      <div class="bar-row" data-tip="${esc(i.tip || `${i.label}: ${i.text || i.value}`)}" tabindex="0">
        <span class="bar-label">${esc(i.label)}</span>
        <span class="bar-track">${opts.target != null ? `<span class="bar-target" style="left:${opts.target / max * 100}%"></span>` : ""}<span class="bar-fill ${i.cls || ""}" style="width:${Math.max(1.5, i.value / max * 100)}%"></span></span>
        <span class="bar-val">${esc(i.text != null ? i.text : i.value)}</span>
      </div>`).join("")}</div>`;
  }
  function spark(vals) {
    const w = 96, h = 28, p = 4, min = Math.min(...vals) - 4, max = Math.max(...vals) + 4;
    const pts = vals.map((v, i) => [p + i * (w - 2 * p) / (vals.length - 1), h - p - (v - min) / (max - min) * (h - 2 * p)]);
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.map(q => q.join(",")).join(" ")}"/>${pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${i === pts.length - 1 ? 3.2 : 2.2}"/>`).join("")}</svg>`;
  }
  const heatColor = v => { const t = Math.max(0, Math.min(1, (v - 20) / 65)); const a = [238, 248, 249], b = [95, 182, 192]; return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(",")})`; };

  /* ---------- small UI pieces ---------- */
  const chip = (cls, text, tip) => `<span class="chip ${cls}"${tip ? ` data-tip="${esc(tip)}" tabindex="0"` : ""}>${cls === "ok" ? "✓ " : cls === "bad" ? "✕ " : cls === "warn" ? "! " : ""}${esc(text)}</span>`;
  const statusChip = s => s === "verified" ? chip("ok", "Verified") : s === "submitted" ? chip("wait", "Awaiting review") : chip("bad", "Returned");
  const kpi = (label, value, sub, tip) => `<div class="kpi"${tip ? ` data-tip="${esc(tip)}" tabindex="0"` : ""}><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
  const head = (eyebrow, title, lede) => `<header class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</header>`;
  const empty = (text, action) => `<div class="empty"><p>${text}</p>${action || ""}</div>`;

  /* ---------- views ---------- */
  function viewOverview() {
    const ns = northStarNow(), m = innovated(), f = fellowship(), e = events(), tb = testbed(), t = trust(), pr = prompts();
    const pendingSchools = subsOf("school_obs", "submitted").flatMap(s => s.rows.map(r => r.school));
    const learners = sum(C.SCHOOLS, s => s.learners);
    const estLearners = m ? Math.round(m.users * 45 / 100) * 100 : 0;
    const stageCount = C.STAGES.map(s => [s, C.SCHOOLS.filter(x => x.stage === s).length]).filter(x => x[1]);
    const agencyGain = ns && ns.baseTerm ? Math.round(ns.values[0].value - ns.values[0].base) : null;

    const hero = ns ? `
      <section class="hero card">
        <div class="hero-text">
          <div class="eyebrow">Learner outcomes · ${termLabel(ns.term)} · verified data</div>
          <h1>Are the children we reach thriving as whole people?</h1>
          <p class="lede">Share of observed lessons in Metis partner schools where each North Star outcome was clearly evident: ${ns.schools.length} schools, ${ns.lessons} lessons. ${ns.baseTerm ? `The dashed line marks ${termLabel(ns.baseTerm)} for the same schools.` : ""}</p>
        </div>
        ${northStarSVG(ns)}
        ${pendingSchools.length && !isDonor() ? `<p class="note">${chip("wait", "Awaiting review")} ${termLabel(ns.term)} observations for ${pendingSchools.length} more schools aren't counted yet. <a href="#/review">Review them</a></p>` : ""}
      </section>` : empty("No verified classroom observations yet.");

    const ripple = `
      <section class="ripple" aria-label="How change reaches learners">
        <div class="ripple-step"><div class="ripple-k">Leaders</div><div class="ripple-v">${f.n}</div><div class="ripple-s">Fellows, plus ${C.SCHOOLS.length} school design teams</div></div>
        <div class="ripple-arrow" aria-hidden="true">→</div>
        <div class="ripple-step"><div class="ripple-k">Teachers</div><div class="ripple-v">${m ? fmt(m.users) : "n/a"}</div><div class="ripple-s">${m ? `using InnovatED tools eight weeks after training, of ${fmt(m.useCompleted)} trained with follow-up data` : "No verified InnovatED data yet"}</div></div>
        <div class="ripple-arrow" aria-hidden="true">→</div>
        <div class="ripple-step"><div class="ripple-k">Learners</div><div class="ripple-v">${fmt(learners)}</div><div class="ripple-s">in partner schools${estLearners ? `, plus about ${fmt(estLearners)} taught by teachers using InnovatED tools (estimate at 45 per class)` : ""}</div></div>
      </section>`;

    const tiles = [
      { id: "fellowship", big: f.n ? `${f.led} of ${f.n}` : "n/a", line: "Fellows have led a full design test", sub: f.fbNow ? `Feedback in ${f.fbNow.median_days} days (target 5)` : "" },
      { id: "innovated", big: m ? pct(m.usePct) : "n/a", line: "of trained teachers using the tool at 8 weeks", sub: m ? `${kes(m.costPerActive)} per teacher using it` : "" },
      { id: "schools", big: agencyGain != null ? `${agencyGain >= 0 ? "+" : ""}${agencyGain} pts` : "n/a", line: "agency since Term 1, partner schools", sub: stageCount.map(s => `${s[1]} ${s[0].toLowerCase()}`).join(" · ") },
      { id: "testbed", big: `${tb.verified.length} pilots`, line: `${fmt(tb.learners)} learners in tested products`, sub: `${tb.strong.length} with comparison-group evidence` },
      { id: "events", big: e.made ? pct(e.followed / e.made) : "n/a", line: "of event commitments followed up", sub: `${fmt(e.attendees)} people across ${e.rows.length} events` }
    ].map(x => { const p = C.PROGRAMS.find(q => q.id === x.id); return `
      <a class="tile card" href="#/programs/${x.id}">
        <div class="tile-name">${esc(p.name)}</div>
        <div class="tile-big">${x.big}</div>
        <div class="tile-line">${esc(x.line)}</div>
        <div class="tile-sub">${esc(x.sub)}</div>
        <div class="tile-job">${esc(p.job)}</div>
      </a>`; }).join("");

    const side = isDonor() ? `
      <aside class="card side-card"><h2>About this view</h2><p>You're seeing verified data only. Every figure has passed Metis's data checks and been reviewed by M&E. <a href="#/donor">Open the donor report</a></p></aside>` : `
      <aside class="card side-card">
        <h2>Needs a decision</h2>
        ${pr.list.filter(p => p.sev === "decide").slice(0, 3).map(p => `<a class="prompt-mini" href="#/decide"><span class="sev decide">Decide</span>${esc(p.title)}</a>`).join("") || "<p>No open decisions.</p>"}
        <a class="text-link" href="#/decide">All prompts and the decision log</a>
      </aside>
      <aside class="card side-card">
        <h2>Data trust</h2>
        <div class="trust-meter" data-tip="${t.verified} of ${t.total} submissions verified" tabindex="0"><span style="width:${t.verified / Math.max(1, t.total) * 100}%"></span></div>
        <p class="trust-line"><strong>${t.verified} of ${t.total}</strong> submissions verified. ${t.pending} awaiting review. ${t.held} rows held back by checks.</p>
        <p class="muted small">Nothing counts until it's checked. Held-back rows stay out of the figures they affect.</p>
        <a class="text-link" href="#/review">Review and trust</a>
      </aside>`;

    return `${hero}${ripple}
      <div class="overview-grid">
        <section><h2 class="section-title">Programme areas</h2><div class="tiles">${tiles}</div></section>
        <div class="side">${side}</div>
      </div>`;
  }

  function viewDesign() {
    const D = C.DESIGN_MAP;
    const stage = (letter, name, q, inner) => `<section class="stage-block card"><div class="stage-mark"><span class="stage-letter">${letter}</span><div><div class="stage-name">${name}</div><div class="stage-q">${q}</div></div></div>${inner}</section>`;
    return head("m · Make meaning", "Design map", "Metis's own design process, the METIS Way, applied to Whole Child Learning: why it matters, who it serves, what we build, how we learn and the impact we want to see.") +
      stage("m", "Make meaning", "We are changemakers. What challenge do we care about?", `
        <blockquote class="hmw"><span>How might we</span> ${esc(D.challenge.replace(/^How might we /, ""))}</blockquote>
        <ul class="ticks">${D.smaller.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
        <h3>Metis values as design principles</h3>
        <div class="table-wrap"><table><thead><tr><th>Value</th><th>What it means for the portal</th></tr></thead><tbody>${D.values.map(v => `<tr><th scope="row">${esc(v[0])}</th><td>${esc(v[1])}</td></tr>`).join("")}</tbody></table></div>`) +
      stage("e", "Empathize", "We look and listen to understand. What are the root causes?", `
        <div class="table-wrap"><table><thead><tr><th>Who</th><th>What they need</th><th>What the portal gives them</th></tr></thead><tbody>${D.people.map(p => `<tr><th scope="row">${esc(p[0])}</th><td>${esc(p[1])}</td><td>${esc(p[2])}</td></tr>`).join("")}</tbody></table></div>
        <h3>What the programme data taught us</h3><ol class="insights">${D.insights.map(i => `<li>${esc(i)}</li>`).join("")}</ol>`) +
      stage("t", "Tackle", "We see an opportunity. What do we create?", `
        <div class="objectives">${D.objectives.map(o => `<div class="objective"><h3>${esc(o[0])}</h3><p>${esc(o[1])}</p></div>`).join("")}</div>`) +
      stage("i", "Iterate", "We tried something new. How do we evolve it?", `
        <div class="chain">${D.chain.map((c, i) => `<div class="chain-step"><div class="chain-k">${esc(c[0])}</div><p>${esc(c[1])}</p></div>${i < D.chain.length - 1 ? '<div class="chain-arrow" aria-hidden="true">→</div>' : ""}`).join("")}</div>
        <h3>North Star outcomes and CBE</h3>
        <div class="table-wrap"><table><thead><tr><th>Outcome</th><th>What it looks like in class</th><th>CBE link</th></tr></thead><tbody>${C.NORTH_STAR.map(o => `<tr><th scope="row"><span class="ns-dot">${o.letter}</span> ${o.name}</th><td>${esc(o.looks)}</td><td>${esc(o.cbe)}</td></tr>`).join("")}</tbody></table></div>`) +
      stage("s", "Share", "We share our learning. How do we support others?", `
        <div class="objectives">${D.impact.map(o => `<div class="objective"><h3>${esc(o[0])}</h3><p>${esc(o[1])}</p></div>`).join("")}</div>`) +
      `<section class="card"><h2>The expert council</h2><p class="muted">Each lens set one requirement the portal had to meet.</p>
        <div class="table-wrap"><table><thead><tr><th>Lens</th><th>Requirement</th><th>How the portal meets it</th></tr></thead><tbody>${D.council.map(c => `<tr><th scope="row">${esc(c[0])}</th><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  let voiceFilter = "all";
  function viewVoices() {
    const list = state.voices.filter(v => v.consent && (voiceFilter === "all" || v.tags.includes(voiceFilter)));
    const filters = [["all", "All voices"], ...C.NORTH_STAR.map(o => [o.key, o.name])];
    const form = can.add() ? `
      <section class="card">
        <h2>Add a voice</h2>
        <p class="muted">Use a short quote, no names. For learners under 18, caregiver consent must be recorded before you save.</p>
        <form id="voice-form" class="form-grid" novalidate>
          <label>Who said it<select name="role" required>${["Learner, ECDE", "Learner, Grades 1 to 3", "Learner, Grades 4 to 6", "Learner, Grades 7 to 9", "Teacher", "Caregiver", "School leader", "Fellow", "County officer"].map(r => `<option>${r}</option>`).join("")}</select></label>
          <label>County<select name="county">${C.COUNTIES.map(c => `<option${c === "Nairobi" ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label class="span-2">Quote<textarea name="text" rows="3" maxlength="280" required placeholder="What they said, in their words"></textarea></label>
          <fieldset class="span-2"><legend>North Star outcomes it shows</legend>${C.NORTH_STAR.map(o => `<label class="check"><input type="checkbox" name="tags" value="${o.key}"> ${o.name}</label>`).join("")}</fieldset>
          <label class="check span-2"><input type="checkbox" name="consent" required> Consent is recorded for this quote</label>
          <div class="span-2 form-actions"><button class="btn primary" type="submit">Save voice</button><span class="form-msg" id="voice-msg" role="status"></span></div>
        </form>
      </section>` : "";
    return head("e · Empathize", "Voices", "What learners, teachers, caregivers and Fellows say, tagged by the North Star outcome it shows. Anonymous, and shared only with consent.") +
      `<div class="filter-row" role="group" aria-label="Filter by outcome">${filters.map(f => `<button class="pill${voiceFilter === f[0] ? " on" : ""}" data-action="voice-filter" data-v="${f[0]}" aria-pressed="${voiceFilter === f[0]}">${esc(f[1])}</button>`).join("")}</div>
      <div class="voices">${list.map(v => `<figure class="voice card"><blockquote>${esc(v.text)}</blockquote><figcaption>${esc(v.role)} · ${esc(v.county)}<span class="voice-tags">${v.tags.map(t => C.NORTH_STAR.find(n => n.key === t)).filter(Boolean).map(o => `<span class="ns-dot" title="${o.name}">${o.letter}</span>`).join("")}</span></figcaption></figure>`).join("") || empty("No voices for this outcome yet.")}</div>${form}`;
  }

  function programTabs(cur) {
    return `<nav class="tabs" aria-label="Programme areas">${C.PROGRAMS.map(p => `<a href="#/programs/${p.id}" class="tab${p.id === cur ? " on" : ""}"${p.id === cur ? ' aria-current="page"' : ""}>${esc(p.short)}</a>`).join("")}</nav>`;
  }

  function viewFellowship() {
    const f = fellowship();
    if (!f.n) return empty("No verified Fellowship data yet.", `<a class="btn" href="#/add">Add data</a>`);
    const sprints = [["See", "Term 1"], ["Try", "Term 2"], ["Embed", "Term 3"], ["Share and sustain", "Nov to Dec"]];
    const cur = Math.max(0, termIdx(f.term));
    const guskey = [
      { label: "1 Reaction: sessions feel relevant", value: f.relevant, text: `${f.relevant} of ${f.n}` },
      { label: "2 Learning: Milestone 2 met", value: f.m2, text: `${f.m2} of ${f.n}` },
      { label: "3 Organisation: sponsor active", value: f.sponsor, text: `${f.sponsor} of ${f.n}` },
      { label: "4 Use: led a full design test", value: f.led, text: `${f.led} of ${f.n}` },
      { label: "5 Learners: collecting learner evidence", value: f.learner, text: `${f.learner} of ${f.n}` }
    ];
    const statusCls = s => s === "On track" ? "ok" : s === "Needs support" ? "warn" : "bad";
    return programTabs("fellowship") + head("t · Tackle", "Metis Fellowship", `${f.n} Fellows designing for the whole child in their own organisations. ${termLabel(f.term)}, verified.`) +
      `<div class="kpis">${kpi("Fellows", f.n, f.status.map(s => `${s[1]} ${s[0].toLowerCase()}`).join(" · "))}
        ${kpi("Milestone 2 met", `${f.m2}<small>/${f.n}</small>`, "Prototype Portfolio")}
        ${kpi("Led a full design test", pct(f.led / f.n), `${f.led} of ${f.n} Fellows`)}
        ${f.fbNow ? kpi("Feedback turnaround", `${f.fbNow.median_days}<small> days</small>`, `target 5 · ${f.fbNow.against_standard_pct}% against the standard`) : ""}</div>
      <section class="card"><h2>Where the cohort is</h2>
        <ol class="sprints">${sprints.map((s, i) => `<li class="${i < cur ? "done" : i === cur ? "now" : ""}"><span class="sprint-n">Sprint ${i + 1}</span><span class="sprint-name">${s[0]}</span><span class="sprint-when">${s[1]}</span></li>`).join("")}</ol></section>
      <div class="two-col">
        <section class="card"><h2>From reaction to learners</h2><p class="muted">Guskey's five levels. Each level is harder to reach than the one before.</p>${bars(guskey, { max: f.n })}</section>
        <section class="card"><h2>Feedback turnaround</h2><p class="muted">Median days from a Fellow's facilitation to written feedback. The line marks the five-day target.</p>
          ${bars(f.feedback.map(r => ({ label: termLabel(r.period), value: +r.median_days, text: `${r.median_days} days`, cls: +r.median_days > 5 ? "warn-fill" : "", tip: `${termLabel(r.period)}: ${r.median_days} days median across ${r.feedback_items} pieces of feedback; ${r.against_standard_pct}% written against the standard` })), { max: 10, target: 5 })}
          <p class="small muted">The facilitation standard came in at the start of Term 3.</p></section>
      </div>
      <section class="card"><h2>Fellows</h2><p class="muted">Coded, never named. ${f.over15} of ${f.n} spent more than 15 hours last month.</p>
        <div class="fellow-grid">${f.rows.map(r => `<div class="fellow ${statusCls(r.status)}" tabindex="0" data-tip="${esc(`${r.fellow}: ${r.org_type}, ${r.county}. ${r.status}. ${r.hours} hours last month. Attendance ${r.attendance_pct}%.`)}"><span class="fellow-code">${esc(r.fellow)}</span><span class="fellow-status">${esc(r.status)}</span></div>`).join("")}</div></section>`;
  }

  function viewInnovated() {
    const m = innovated();
    if (!m) return programTabs("innovated") + empty("No verified InnovatED data yet.", `<a class="btn" href="#/add">Add data</a>`);
    const cmpRow = (label, a) => `<tr><th scope="row">${label}</th><td>${pct(a.completion)}</td><td>${pct(a.usePct)}</td><td>${fmt(a.per100)}</td><td>${kes(a.costPerCompleter)}</td><td>${kes(a.costPerActive)}</td></tr>`;
    const byCounty = [...new Set(m.useI.map(x => x.row.county))].map(c => { const a = innovatedAgg(m.useI.filter(x => x.row.county === c)); return { label: c, value: a.usePct * 100, text: pct(a.usePct), tip: `${c}: ${pct(a.usePct)} of ${a.useCompleted} trained teachers using the tool` }; }).sort((a, b) => b.value - a.value);
    return programTabs("innovated") + head("t · Tackle", "InnovatED", `Teacher training with AI-supported tools. ${termLabel(m.term)}, eight weeks after training. Follow-up for Term 3 training arrives eight weeks after each session.`) +
      `<div class="kpis">${kpi("Teachers registered", fmt(m.registered), `${m.sites} sites, ${m.counties} counties`)}
        ${kpi("Completed", pct(m.completion), `${fmt(m.completed)} teachers`)}
        ${kpi("Using the tool at 8 weeks", pct(m.usePct), `${m.useSites} sites with reliable follow-up`)}
        ${kpi("Per teacher completed", kes(m.costPerCompleter), "total cost ÷ completers")}
        ${kpi("Per teacher using the tool", kes(m.costPerActive), "the measure we budget on", "Cost per completer divided by the share using the tool. It counts drop-out and non-use, which cost per completer hides.")}</div>
      <section class="card"><h2>Metis-led and partner-led delivery</h2>
        <div class="table-wrap"><table class="num"><thead><tr><th></th><th>Completion</th><th>Using at 8 weeks</th><th>Using, per 100 registered</th><th>Per teacher completed</th><th>Per teacher using</th></tr></thead><tbody>
          ${cmpRow("Metis-led, all sites", m.metis)}${cmpRow("Partner-led, all sites", m.partner)}
          ${m.sameCounties.length ? cmpRow(`Metis-led, ${m.sameCounties.join(" and ")}`, m.metisSame) + cmpRow(`Partner-led, ${m.sameCounties.join(" and ")}`, m.partnerSame) : ""}
        </tbody></table></div>
        <p class="small muted">The same-county rows compare like with like: counties where both models have usable data. Sites weren't randomly assigned, so treat the gap as a strong signal, not proof.</p></section>
      <section class="card"><h2>Cost per teacher completed, and per teacher actually using the tool</h2>
        <p class="legend"><span class="key s-metis"></span>Metis-led <span class="key s-partner"></span>Partner-led <span class="key hollow-key"></span>per teacher completed <span class="key solid-key"></span>per teacher using the tool (KES)</p>
        ${dumbbellSVG(m.useI)}
        <p class="small muted">Sites held back by data checks aren't shown. ${m.heldBack.map(x => `Site ${x.row.site}`).join(", ")}: see the table below.</p></section>
      <div class="two-col">
        <section class="card"><h2>Use at 8 weeks by county</h2>${bars(byCounty, { max: 100 })}</section>
        <section class="card"><h2>What the confidence score tells us</h2><p>Confidence on the last day sits between ${Math.min(...m.base.filter(x => +x.row.registered >= 10).map(x => +x.row.confidence))} and ${Math.max(...m.base.filter(x => +x.row.registered >= 10).map(x => +x.row.confidence))} at every site with ten or more teachers, while use at eight weeks ranges from ${Math.min(...m.useI.map(x => +x.row.using_pct))}% to ${Math.max(...m.useI.filter(x => +x.row.registered >= 10).map(x => +x.row.using_pct))}%. Teachers leave feeling ready; the drop happens in the weeks after. That's why the portal tracks use at eight weeks, not confidence.</p></section>
      </div>
      <section class="card"><h2>Sites</h2><div class="table-wrap"><table class="num"><thead><tr><th>Site</th><th>County</th><th>Delivered by</th><th>Registered</th><th>Completed</th><th>Completion</th><th>Confidence</th><th>Using at 8 wks</th><th>Per completer</th><th>Checks</th></tr></thead><tbody>
        ${m.items.map(x => { const r = x.row, cl = checkLabel(x.res); return `<tr><th scope="row">${esc(r.site)}</th><td>${esc(r.county)}</td><td>${esc(r.delivered_by)}</td><td>${r.registered}</td><td>${r.completed}</td><td>${r.registered ? pct(r.completed / r.registered) : "n/a"}</td><td>${r.confidence}</td><td>${r.using_pct === "" ? "not recorded" : r.using_pct + "%"}</td><td>${fmt(r.cost_per_completer)}</td><td>${chip(cl.cls, cl.text, x.res.issues.map(i => i.msg).join(". ") || "All checks passed")}</td></tr>`; }).join("")}
      </tbody></table></div></section>`;
  }

  function viewSchools() {
    const terms = C.TERMS.map(t => t.id);
    const latestBySchool = C.SCHOOLS.map(s => {
      let found = null;
      terms.forEach(t => { const it = verifiedItems("school_obs", t).find(x => x.row.school === s.id && !x.res.exclRow); if (it) found = { term: t, row: it.row }; });
      const waiting = subsOf("school_obs", "submitted").some(sub => sub.rows.some(r => r.school === s.id));
      return { s, found, waiting };
    });
    const ns = northStarNow();
    const matched = ns ? ns.schools : [];
    const trend = C.NORTH_STAR.map(o => ({ o, vals: terms.map(t => northStar(t, matched)).filter(x => x.schools.length === matched.length).map(x => x.values.find(v => v.key === o.key).value) }));
    const learners = sum(C.SCHOOLS, s => s.learners);
    return programTabs("schools") + head("t · Tackle", "Whole Child Schools", `Six school design teams making whole child learning part of everyday practice. ${fmt(learners)} learners.`) +
      `<div class="kpis">${kpi("Partner schools", C.SCHOOLS.length, C.STAGES.map(st => `${C.SCHOOLS.filter(x => x.stage === st).length} ${st.toLowerCase()}`).filter(x => !x.startsWith("0")).join(" · "))}
        ${kpi("Learners", fmt(learners), "enrolled in partner schools")}
        ${ns ? kpi(`Lessons observed, ${termLabel(ns.term).replace(", 2026", "")}`, ns.lessons, `${ns.schools.length} schools verified so far`) : ""}
        ${ns ? kpi("Lowest outcome", [...ns.values].sort((a, b) => a.value - b.value)[0].name, "next term's coaching focus") : ""}</div>
      <section class="card"><h2>North Star by school</h2><p class="muted">Share of observed lessons where each outcome was clearly evident. Latest verified term for each school.</p>
        <div class="table-wrap"><table class="heat"><thead><tr><th>School</th>${C.NORTH_STAR.map(o => `<th><span class="ns-dot">${o.letter}</span> ${o.name}</th>`).join("")}<th>Stage</th></tr></thead><tbody>
        ${latestBySchool.map(({ s, found, waiting }) => `<tr><th scope="row"><div>${esc(s.label)}</div><div class="small muted">${esc(s.type)}, ${esc(s.county)} · ${found ? termLabel(found.term) : "no data"}</div>${waiting && !isDonor() ? chip("wait", "New term awaiting review") : ""}</th>
          ${C.NORTH_STAR.map(o => { const v = found ? +found.row[o.key + "_pct"] : NaN; return `<td class="cell" style="background:${isFinite(v) ? heatColor(v) : "transparent"};color:var(--navy)" data-tip="${esc(`${s.label}, ${o.name}: ${isFinite(v) ? v + "%" : "no data"}${found ? ` of ${found.row.lessons_observed} lessons, ${termLabel(found.term)}` : ""}`)}" tabindex="0">${isFinite(v) ? v + "%" : "n/a"}</td>`; }).join("")}
          <td><span class="stage-chip">${esc(s.stage)}</span></td></tr>`).join("")}
        </tbody></table></div></section>
      <section class="card"><h2>Change over the year</h2><p class="muted">The ${matched.length} schools with verified data in every term, so the comparison is like for like.</p>
        <div class="trend">${trend.map(t => `<div class="trend-item"><div class="trend-name"><span class="ns-dot">${t.o.letter}</span> ${t.o.name}</div>${t.vals.length > 1 ? spark(t.vals) : ""}<div class="trend-vals">${t.vals.map(v => Math.round(v) + "%").join(" → ")}</div></div>`).join("")}</div></section>
      <section class="card"><h2>How far practice has spread</h2>
        <div class="stage-track">${C.SCHOOLS.map(s => `<div class="st-row"><span class="st-school">${esc(s.label)}</span>${C.STAGES.map((st, i) => `<span class="st-step${i <= C.STAGES.indexOf(s.stage) ? " on" : ""}${st === s.stage ? " cur" : ""}">${st}</span>`).join("")}</div>`).join("")}</div></section>`;
  }

  function viewTestbed() {
    const tb = testbed();
    const card = (p) => { const si = C.PILOT_STAGES.indexOf(p.stage); return `<article class="card pilot"><div class="pilot-top"><h2>${esc(p.pilot)}</h2>${statusChip(p.status)}</div>
      <ol class="pilot-stages">${C.PILOT_STAGES.map((s, i) => `<li class="${i < si ? "done" : i === si ? "now" : ""}">${s}</li>`).join("")}</ol>
      <p class="pilot-result">${esc(p.result)}</p>
      <p class="small muted">${fmt(p.schools)} schools · ${fmt(p.learners)} learners · Evidence: ${esc(p.evidence)}</p></article>`; };
    return programTabs("testbed") + head("t · Tackle", "Kenya EdTech Testbed", "Products move up the evidence ladder only when the evidence is there. Self-report is a start, not a result.") +
      `<div class="kpis">${kpi("Verified pilots", tb.verified.length, `${tb.pending.length} awaiting review`)}${kpi("Learners in tested products", fmt(tb.learners), "verified pilots")}${kpi("Comparison-group evidence", tb.strong.length, "pilots")}</div>
      <div class="pilots">${tb.verified.map(card).join("")}${isDonor() ? "" : tb.pending.map(card).join("")}</div>`;
  }

  function viewEvents() {
    const e = events();
    return programTabs("events") + head("t · Tackle", "Knowledge Sharing Events", "Where Fellows, teachers, county officials and funders share what works. The test of an event is what people do afterwards.") +
      `<div class="kpis">${kpi("Events with verified data", e.rows.length, "")}${kpi("People taking part", fmt(e.attendees), `${e.county} county officials`)}${kpi("Commitments followed up", e.made ? pct(e.followed / e.made) : "n/a", `${e.followed} of ${e.made}, within a term`)}</div>
      ${e.rows.map(r => `<section class="card"><h2>${esc(r.event)}</h2><p class="muted">${esc(r.county)} · ${fmt(e.att(r))} people</p>
        <div class="two-col"><div>${bars(e.groups.map(g => ({ label: g[1], value: +r[g[0]], text: fmt(r[g[0]]) })), { max: Math.max(...e.rows.flatMap(x => e.groups.map(g => +x[g[0]]))) })}</div>
        <div class="follow"><div class="kpi-label">Commitments followed up</div><div class="kpi-value">${pct(r.commitments_followed / r.commitments_made)}</div><div class="kpi-sub">${r.commitments_followed} of ${r.commitments_made}</div></div></div></section>`).join("")}
      ${isDonor() ? "" : `<section class="card notice"><h2>KSE Term 3: Fellows showcase</h2><p>Attendance and commitments haven't been submitted yet.</p><a class="btn" href="#/add" data-action="pick-ds-link" data-ds="event_attendance">Add event data</a></section>`}`;
  }

  /* ----- add data ----- */
  const add = { ds: null, term: "2026-T3", rows: [], notes: [], blocked: "" };
  function viewAdd() {
    if (!add.ds) {
      return head("i · Iterate", "Add data", "Pick what you're reporting. Every row is checked as you add it, and nothing counts until M&E has reviewed it.") +
        `<div class="ds-grid">${Object.entries(C.DATASETS).map(([k, d]) => `<button class="ds-card card" data-action="pick-ds" data-ds="${k}"><span class="ds-prog">${esc(C.PROGRAMS.find(p => p.id === d.program).short)}</span><span class="ds-name">${esc(d.label)}</span><span class="ds-meta">${esc(d.who)} · ${esc(d.when)}</span></button>`).join("")}</div>
        <section class="card guard"><h2>Children's privacy</h2><p>The portal holds aggregate figures only. Uploads with columns such as name, phone, UPI, NEMIS or admission number are blocked, and so are values that look like phone numbers or email addresses.</p></section>`;
    }
    const d = C.DATASETS[add.ds];
    const results = checkRows(add.ds, add.rows);
    const counts = { pass: results.filter(r => r.level === "pass").length, flag: results.filter(r => r.level === "flag").length, fail: results.filter(r => r.level === "fail").length };
    const input = f => {
      const id = `f-${f.key}`;
      if (f.type === "select") return `<label for="${id}">${esc(f.label)}<select id="${id}" name="${f.key}">${f.options.map(o => `<option${String(o) === String(f.example) ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
      const num = ["int", "num", "pct"].includes(f.type);
      return `<label for="${id}">${esc(f.label)}${f.required ? "" : " (optional)"}<input id="${id}" name="${f.key}" ${num ? `type="number" step="${f.type === "int" ? "1" : "any"}" inputmode="decimal"` : 'type="text"'} placeholder="${esc(f.example)}"></label>`;
    };
    return head("i · Iterate", esc(d.label), `${esc(d.who)} · ${esc(d.when)}. One row per ${esc(d.unit)}.`) +
      `<p><button class="text-link as-btn" data-action="pick-ds" data-ds="">← Choose a different dataset</button></p>
      <div class="two-col add-cols">
        <section class="card"><h2>Upload a CSV</h2><p class="muted">Start from the template so the columns match. Works offline in any spreadsheet app.</p>
          <div class="form-actions"><button class="btn" data-action="template">Download template</button>
          <label class="btn primary file-btn">Upload CSV<input type="file" accept=".csv,text/csv" id="csv-input" hidden></label></div>
          ${add.blocked ? `<p class="alert bad" role="alert">${esc(add.blocked)}</p>` : ""}
          ${add.notes.map(n => `<p class="alert info">${esc(n)}</p>`).join("")}
        </section>
        <section class="card"><h2>Or add one row</h2><form id="row-form" class="form-grid">${d.fields.map(input).join("")}<div class="span-2 form-actions"><button class="btn" type="submit">Add row</button></div></form></section>
      </div>
      <section class="card"><div class="row-between"><h2>Rows ready to submit (${add.rows.length})</h2>
        <div class="check-sum">${chip("ok", counts.pass + " passed")} ${chip("warn", counts.flag + " flagged")} ${chip("bad", counts.fail + " failing")}</div></div>
        ${add.rows.length ? `<div class="table-wrap"><table class="num"><thead><tr>${d.fields.map(f => `<th>${esc(f.label)}</th>`).join("")}<th>Checks</th><th></th></tr></thead><tbody>
          ${add.rows.map((r, i) => { const cl = checkLabel(results[i]); return `<tr>${d.fields.map(f => `<td>${esc(r[f.key])}</td>`).join("")}<td>${chip(cl.cls, cl.text, results[i].issues.map(x => x.msg).join(". ") || "All checks passed")}${results[i].issues.length ? `<div class="issue-list">${results[i].issues.map(x => esc(x.msg)).join("<br>")}</div>` : ""}</td><td><button class="icon-btn" data-action="drop-row" data-i="${i}" aria-label="Remove row ${i + 1}">✕</button></td></tr>`; }).join("")}
        </tbody></table></div>` : empty("No rows yet. Upload a CSV or add a row above.")}
        <div class="submit-bar"><label>Reporting period<select id="add-term">${C.TERMS.map(t => `<option value="${t.id}"${t.id === add.term ? " selected" : ""}>${t.label}</option>`).join("")}</select></label>
          <label class="grow">Title<input id="add-title" type="text" value="${esc(d.label + ", " + termLabel(add.term))}"></label>
          <button class="btn primary" data-action="submit-rows"${add.rows.length && !add.blocked ? "" : " disabled"}>Submit for review</button></div>
        ${counts.fail ? `<p class="small muted">You can still submit. Failing rows stay out of the figures they affect until they're fixed.</p>` : ""}
      </section>`;
  }
  function normHeader(h) { return String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ""));
  }
  function ingestCSV(text) {
    const d = C.DATASETS[add.ds];
    add.blocked = ""; add.notes = [];
    const grid = parseCSV(text.replace(/^﻿/, ""));
    if (grid.length < 2) { add.blocked = "That file has no data rows. Add at least one row under the header."; return; }
    const headers = grid[0].map(normHeader);
    const pii = headers.find(h => PII_HEADER.test(h));
    if (pii) { add.blocked = `Upload blocked: the column "${pii}" looks like personal data. Remove it and upload again. The portal only holds aggregate figures.`; return; }
    const map = headers.map(h => d.fields.find(f => f.key === h || normHeader(f.label) === h));
    const missing = d.fields.filter(f => f.required && !map.includes(f));
    if (missing.length) { add.blocked = `Missing columns: ${missing.map(f => f.key).join(", ")}. Download the template to see the expected headers.`; return; }
    const ignored = headers.filter((h, i) => !map[i]);
    if (ignored.length) add.notes.push(`Ignored columns the portal doesn't use: ${ignored.join(", ")}.`);
    let added = 0;
    grid.slice(1).forEach(cells => {
      const r = {};
      map.forEach((f, i) => { if (!f) return; let v = (cells[i] || "").trim(); if (["int", "num", "pct"].includes(f.type) && v !== "") { const n = Number(v.replace(/[,%\s]/g, "").replace(/^KES/i, "")); v = isFinite(n) ? n : v; } r[f.key] = v; });
      add.rows.push(r); added++;
    });
    add.notes.push(`Added ${added} rows from the file. Check the results below before you submit.`);
  }
  function downloadText(name, text, type) {
    const blob = new Blob([text], { type }); const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csvCell = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

  /* ----- review ----- */
  let reviewFilter = "all";
  const openSubs = new Set();
  function viewReview() {
    const t = trust();
    const subs = state.submissions.filter(s => reviewFilter === "all" || s.status === reviewFilter)
      .sort((a, b) => (a.status === "submitted" ? -1 : 0) - (b.status === "submitted" ? -1 : 0) || (b.submittedAt || "").localeCompare(a.submittedAt || ""));
    const filters = [["all", "All"], ["submitted", "Awaiting review"], ["verified", "Verified"], ["returned", "Returned"]];
    return head("i · Iterate", "Review and trust", "Every submission is checked automatically. M&E then verifies it, or returns it with a note. Only verified data reaches the dashboard and the donor report.") +
      `<div class="kpis">${kpi("Verified", `${t.verified}<small>/${t.total}</small>`, "submissions")}${kpi("Awaiting review", t.pending, "")}${kpi("Rows held back", t.held, "by failing checks")}${kpi("Rows flagged", t.flagged, "counted, with a caution")}</div>
      ${can.verify() ? "" : `<p class="alert info">You're viewing as ${esc(roleOf().label)}. Switch to M&E (top right) to verify or return submissions.</p>`}
      <div class="filter-row" role="group" aria-label="Filter submissions">${filters.map(f => `<button class="pill${reviewFilter === f[0] ? " on" : ""}" data-action="review-filter" data-v="${f[0]}" aria-pressed="${reviewFilter === f[0]}">${f[1]}</button>`).join("")}</div>
      <div class="subs">${subs.map(s => {
        const d = C.DATASETS[s.dataset], res = checkRows(s.dataset, s.rows), open = openSubs.has(s.id);
        const c = { pass: res.filter(r => r.level === "pass").length, flag: res.filter(r => r.level === "flag").length, fail: res.filter(r => r.level === "fail").length };
        return `<article class="card sub">
          <div class="sub-head"><div><div class="eyebrow">${esc(C.PROGRAMS.find(p => p.id === d.program).short)} · ${esc(termLabel(s.term))}</div><h2>${esc(s.title)}</h2>
            <p class="small muted">${s.rows.length} rows · from ${esc(s.submittedBy)} on ${prettyDate(s.submittedAt)}${s.reviewedAt ? ` · reviewed by ${esc(s.reviewedBy)} on ${prettyDate(s.reviewedAt)}` : ""}</p></div>
            <div class="sub-status">${statusChip(s.status)}<div class="check-sum">${chip("ok", c.pass + " passed")} ${c.flag ? chip("warn", c.flag + " flagged") : ""} ${c.fail ? chip("bad", c.fail + " failing") : ""}</div></div></div>
          ${s.note ? `<p class="sub-note">${esc(s.note)}</p>` : ""}
          <div class="sub-actions"><button class="btn" data-action="toggle-sub" data-id="${esc(s.id)}" aria-expanded="${open}">${open ? "Hide rows" : "Show rows and checks"}</button>
            ${can.verify() && s.status !== "verified" ? `<button class="btn primary" data-action="verify" data-id="${esc(s.id)}">Verify</button>` : ""}
            ${can.verify() && s.status === "submitted" ? `<button class="btn" data-action="return" data-id="${esc(s.id)}">Return with a note</button>` : ""}
            ${state.role === "staff" && s.status === "returned" ? `<button class="btn" data-action="resubmit" data-id="${esc(s.id)}">Resubmit</button>` : ""}</div>
          ${open ? `<div class="table-wrap"><table class="num"><thead><tr>${d.fields.map(f => `<th>${esc(f.label)}</th>`).join("")}<th>Checks</th></tr></thead><tbody>${s.rows.map((r, i) => { const cl = checkLabel(res[i]); return `<tr>${d.fields.map(f => `<td>${esc(r[f.key])}</td>`).join("")}<td>${chip(cl.cls, cl.text)}${res[i].issues.length ? `<div class="issue-list">${res[i].issues.map(x => esc(x.msg)).join("<br>")}</div>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
        </article>`; }).join("") || empty("Nothing here.")}</div>`;
  }

  /* ----- decisions ----- */
  function viewDecide() {
    const pr = prompts();
    return head("i · Iterate", "Pause and adapt", "Prompts come from rules agreed in advance, so decisions happen at the right moment, not when a funder asks. Record what was decided, who owns it and when to look again.") +
      `${can.decide() ? "" : `<p class="alert info">You're viewing as ${esc(roleOf().label)}. Switch to Decision maker (top right) to record decisions.</p>`}
      <div class="prompts">${pr.list.map(p => `<article class="card prompt ${p.sev}">
        <div class="prompt-top"><span class="sev ${p.sev}">${p.sev === "decide" ? "Decide" : "Watch"}</span><a class="small" href="#/${p.route}">See the data</a></div>
        <h2>${esc(p.title)}</h2><p class="evidence">${esc(p.evidence)}</p><p class="rule">${esc(p.rule)}</p>
        <div class="options"><span class="small muted">Options</span><ul>${p.options.map(o => `<li>${esc(o)}</li>`).join("")}</ul></div>
        ${can.decide() ? `<button class="btn primary" data-action="record" data-id="${p.id}">Record a decision</button>` : ""}</article>`).join("")}</div>
      ${pr.onTrack.length ? `<section class="card"><h2>On track</h2><ul class="ticks">${pr.onTrack.map(o => `<li>${esc(o)}</li>`).join("")}</ul></section>` : ""}
      <section class="card"><h2>Decision log</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Decision</th><th>Owner</th><th>Look again</th></tr></thead><tbody>
        ${state.decisions.map(d => `<tr><td class="nowrap">${prettyDate(d.date)}</td><td><strong>${esc(d.title)}</strong><div class="small">${esc(d.decision)}</div></td><td>${esc(d.owner)}</td><td class="nowrap">${prettyDate(d.review)}</td></tr>`).join("")}
      </tbody></table></div></section>`;
  }

  /* ----- donor report ----- */
  function viewDonor() {
    const ns = northStarNow(), s = donorSentences(), t = trust();
    const voices = state.voices.filter(v => v.consent).slice(0, 4);
    return `<div class="donor">
      <header class="page-head donor-head"><div><div class="eyebrow">s · Share · Prepared for funders and partners</div><h1>Whole Child Learning impact report</h1>
        <p class="lede">Built only from verified data, as of ${prettyDate(today())}. Every statement carries its source and sample size.</p></div>
        <button class="btn primary no-print" data-action="print">Print or save as PDF</button></header>
      ${ns ? `<section class="card"><h2>Are the children we reach thriving as whole people?</h2><p class="muted">Share of observed lessons where each North Star outcome was clearly evident, ${termLabel(ns.term)}.</p>${northStarSVG(ns)}</section>` : ""}
      <section class="card"><h2>What we can say with confidence</h2>
        <div class="sentences">${s.map(x => `<div class="sentence"><div class="eyebrow">${esc(x.program)}</div><p>${esc(x.text)}</p><p class="small muted">${esc(x.source)} · ${esc(x.n)}</p><button class="text-link as-btn no-print" data-action="copy" data-text="${esc(x.text)}">Copy sentence</button></div>`).join("")}</div></section>
      <section class="card"><h2>In their words</h2><div class="voices donor-voices">${voices.map(v => `<figure class="voice"><blockquote>${esc(v.text)}</blockquote><figcaption>${esc(v.role)} · ${esc(v.county)}</figcaption></figure>`).join("")}</div></section>
      <section class="card"><h2>How we know</h2><ul class="ticks">
        <li>Figures come only from submissions verified by M&E: ${t.verified} of ${t.total} so far. Anything awaiting review is left out.</li>
        <li>Rows that fail checks (for example more completers than registrants, or impossible percentages) are held back from the figures they affect.</li>
        <li>Teacher use is reported by head teachers and checked through call-backs to a sample of teachers. We don't yet claim learning gains from InnovatED.</li>
        <li>No child is named. Quotes are shared only with recorded consent.</li></ul></section>
    </div>`;
  }

  /* ---------- shell ---------- */
  const NAV = [
    { route: "overview", label: "Impact overview" },
    { stage: "m", name: "Make meaning" }, { route: "design", label: "Design map" },
    { stage: "e", name: "Empathize" }, { route: "voices", label: "Voices" },
    { stage: "t", name: "Tackle" }, ...C.PROGRAMS.map(p => ({ route: "programs/" + p.id, label: p.name, sub: true })),
    { stage: "i", name: "Iterate", internal: true }, { route: "add", label: "Add data", internal: true }, { route: "review", label: "Review and trust", internal: true, badge: () => pending().length }, { route: "decide", label: "Pause and adapt", internal: true, badge: () => prompts().list.filter(p => p.sev === "decide").length },
    { stage: "s", name: "Share" }, { route: "donor", label: "Donor report" }
  ];
  function renderNav(cur) {
    $("#nav").innerHTML = NAV.filter(n => !(n.internal && isDonor())).map(n => {
      if (n.stage) return `<div class="nav-stage"><span class="nav-letter">${n.stage}</span>${n.name}</div>`;
      const on = cur === n.route || (n.route === "programs/fellowship" && cur === "programs");
      const b = n.badge ? n.badge() : 0;
      return `<a href="#/${n.route}" class="nav-link${n.sub ? " sub" : ""}${on ? " on" : ""}"${on ? ' aria-current="page"' : ""}>${esc(n.label)}${b ? `<span class="badge">${b}</span>` : ""}</a>`;
    }).join("");
    $("#role").value = state.role;
    $("#role-hint").textContent = roleOf().hint;
    $("#role").setAttribute("data-tip", roleOf().hint);
    document.body.dataset.role = state.role;
  }
  const VIEWS = { overview: viewOverview, design: viewDesign, voices: viewVoices, add: viewAdd, review: viewReview, decide: viewDecide, donor: viewDonor };
  const PROGRAM_VIEWS = { fellowship: viewFellowship, innovated: viewInnovated, schools: viewSchools, testbed: viewTestbed, events: viewEvents };
  function route() {
    let h = location.hash.replace(/^#\/?/, "") || "overview";
    let [page, sub] = h.split("/");
    if (isDonor() && ["add", "review", "decide"].includes(page)) { location.hash = "#/overview"; return; }
    let html;
    if (page === "programs") { sub = PROGRAM_VIEWS[sub] ? sub : "fellowship"; html = PROGRAM_VIEWS[sub](); h = "programs/" + sub; }
    else html = (VIEWS[page] || viewOverview)();
    renderNav(h);
    const main = $("#view");
    main.innerHTML = html;
    main.focus({ preventScroll: true });
    document.title = (main.querySelector("h1") ? main.querySelector("h1").textContent + " · " : "") + "Metis Whole Child Impact Portal";
    document.body.classList.remove("nav-open");
    window.scrollTo(0, 0);
  }
  const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0, y); };

  /* ---------- feedback UI ---------- */
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 3200);
  }
  function dialog(title, bodyHTML, okLabel, onOk) {
    const d = $("#dlg");
    d.innerHTML = `<form method="dialog" class="dlg-form"><h2>${esc(title)}</h2>${bodyHTML}<div class="form-actions"><button class="btn" value="cancel" type="button" data-close>Cancel</button><button class="btn primary" value="ok" type="submit">${esc(okLabel)}</button></div></form>`;
    const form = d.querySelector("form");
    d.querySelector("[data-close]").onclick = () => d.close();
    form.onsubmit = ev => { ev.preventDefault(); if (onOk(new FormData(form)) !== false) d.close(); };
    d.showModal();
    const first = form.querySelector("input,textarea,select"); if (first) first.focus();
  }

  /* tooltip */
  const tip = $("#tip");
  function showTip(el, x, y) {
    tip.textContent = el.getAttribute("data-tip"); tip.hidden = false;
    const r = tip.getBoundingClientRect(), vw = window.innerWidth;
    tip.style.left = Math.max(8, Math.min(vw - r.width - 8, x + 14)) + "px";
    tip.style.top = Math.max(8, y - r.height - 12) + "px";
  }
  document.addEventListener("mousemove", e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) showTip(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener("focusin", e => { const el = e.target.closest && e.target.closest("[data-tip]"); if (el) { const r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); } });
  document.addEventListener("focusout", () => { tip.hidden = true; });
  window.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-action]");
    if (!a) return;
    const act = a.dataset.action;
    if (act === "pick-ds") { add.ds = a.dataset.ds || null; add.rows = []; add.notes = []; add.blocked = ""; rerender(); }
    else if (act === "pick-ds-link") { add.ds = a.dataset.ds; add.rows = []; add.notes = []; add.blocked = ""; }
    else if (act === "drop-row") { add.rows.splice(+a.dataset.i, 1); rerender(); }
    else if (act === "template") {
      const d = C.DATASETS[add.ds];
      downloadText(`metis-${add.ds}-template.csv`, d.fields.map(f => f.key).join(",") + "\n" + d.fields.map(f => csvCell(f.example)).join(",") + "\n", "text/csv");
      toast("Template downloaded");
    }
    else if (act === "submit-rows") {
      const title = ($("#add-title").value || "").trim() || C.DATASETS[add.ds].label;
      state.submissions.push({ id: uid("sub"), dataset: add.ds, term: add.term, title, submittedBy: roleOf().label, submittedAt: today(), status: "submitted", note: "", rows: add.rows });
      save(); add.ds = null; add.rows = []; add.notes = []; reviewFilter = "all";
      toast("Submitted for review"); location.hash = "#/review";
    }
    else if (act === "voice-filter") { voiceFilter = a.dataset.v; rerender(); }
    else if (act === "review-filter") { reviewFilter = a.dataset.v; rerender(); }
    else if (act === "toggle-sub") { const id = a.dataset.id; openSubs.has(id) ? openSubs.delete(id) : openSubs.add(id); rerender(); }
    else if (act === "verify") {
      const s = state.submissions.find(x => x.id === a.dataset.id);
      Object.assign(s, { status: "verified", reviewedBy: "M&E", reviewedAt: today() });
      save(); rerender(); toast("Verified. The figures now include this submission");
    }
    else if (act === "return") {
      const s = state.submissions.find(x => x.id === a.dataset.id);
      dialog("Return with a note", `<label>What needs fixing<textarea name="note" rows="4" required placeholder="For example: re-check the attendance register for Site M"></textarea></label>`, "Return submission", fd => {
        const note = String(fd.get("note") || "").trim(); if (!note) return false;
        Object.assign(s, { status: "returned", note, reviewedBy: "M&E", reviewedAt: today() }); save(); rerender(); toast("Returned to the submitter");
      });
    }
    else if (act === "resubmit") { const s = state.submissions.find(x => x.id === a.dataset.id); Object.assign(s, { status: "submitted", submittedAt: today() }); save(); rerender(); toast("Resubmitted for review"); }
    else if (act === "record") {
      const p = prompts().list.find(x => x.id === a.dataset.id);
      const owners = ["Programs Manager", "Director of Programs", "Lead Coach", "Associate", "M&E", "Codifier"];
      const inTwo = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      dialog("Record a decision", `<label>Decision on<input name="title" value="${esc(p ? p.title : "")}" required></label>
        <label>What we decided<textarea name="decision" rows="3" required>${esc(p ? p.options[0] : "")}</textarea></label>
        <div class="form-grid"><label>Owner<select name="owner">${owners.map(o => `<option>${o}</option>`).join("")}</select></label><label>Look again on<input type="date" name="review" value="${inTwo}" required></label></div>`, "Save decision", fd => {
        const title = String(fd.get("title") || "").trim(), decision = String(fd.get("decision") || "").trim();
        if (!title || !decision) return false;
        state.decisions.unshift({ id: uid("d"), date: today(), title, decision, owner: fd.get("owner"), review: fd.get("review") }); save(); rerender(); toast("Decision saved to the log");
      });
    }
    else if (act === "print") window.print();
    else if (act === "copy") { const txt = a.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Sentence copied"), () => toast("Select the sentence to copy it")); }
    else if (act === "export") downloadText("metis-whole-child-portal-data.json", JSON.stringify(state, null, 2), "application/json");
    else if (act === "import") $("#import-input").click();
    else if (act === "reset") dialog("Reset to sample data", "<p>This replaces everything saved in this browser with the original sample data. Export first if you want to keep your changes.</p>", "Reset data", () => { state = fresh(); save(); add.ds = null; rerender(); toast("Sample data restored"); });
    else if (act === "menu") document.body.classList.toggle("nav-open");
  });

  document.addEventListener("submit", e => {
    if (e.target.id === "row-form") {
      e.preventDefault();
      const d = C.DATASETS[add.ds], fd = new FormData(e.target), r = {};
      d.fields.forEach(f => { let v = String(fd.get(f.key) == null ? "" : fd.get(f.key)).trim(); if (["int", "num", "pct"].includes(f.type) && v !== "") v = Number(v); r[f.key] = v; });
      add.rows.push(r); add.blocked = ""; rerender(); toast("Row added and checked");
    }
    if (e.target.id === "voice-form") {
      e.preventDefault();
      const fd = new FormData(e.target), msg = $("#voice-msg");
      const text = String(fd.get("text") || "").trim();
      if (!text) { msg.textContent = "Add the quote first."; return; }
      if (PII_VALUE.test(text)) { msg.textContent = "Remove the phone number or email address, then save."; return; }
      if (!fd.get("consent")) { msg.textContent = "Record consent before saving this quote."; return; }
      state.voices.unshift({ id: uid("v"), role: fd.get("role"), county: fd.get("county"), text, tags: fd.getAll("tags"), consent: true, added: today() });
      save(); voiceFilter = "all"; rerender(); toast("Voice saved");
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "role") { state.role = e.target.value; save(); route(); toast(`Viewing as ${roleOf().label}`); }
    if (e.target.id === "add-term") { add.term = e.target.value; const t = $("#add-title"); if (t) t.value = C.DATASETS[add.ds].label + ", " + termLabel(add.term); }
    if (e.target.id === "csv-input" && e.target.files[0]) {
      const r = new FileReader(); r.onload = () => { ingestCSV(String(r.result)); rerender(); }; r.readAsText(e.target.files[0]);
    }
    if (e.target.id === "import-input" && e.target.files[0]) {
      const r = new FileReader();
      r.onload = () => {
        try { const p = JSON.parse(String(r.result)); if (!p || !Array.isArray(p.submissions) || !Array.isArray(p.voices)) throw new Error("shape"); p.submissions = p.submissions.filter(x => x && C.DATASETS[x.dataset] && Array.isArray(x.rows)); p.voices = p.voices.filter(v => v && typeof v.text === "string").map(v => ({ ...v, tags: Array.isArray(v.tags) ? v.tags : [] })); p.role = C.ROLES.some(r => r.id === p.role) ? p.role : "staff"; p.version = C.version; p.decisions = p.decisions || []; state = p; save(); route(); toast("Data imported"); }
        catch (err) { toast("That file isn't a portal export. Nothing was changed"); }
        e.target.value = "";
      };
      r.readAsText(e.target.files[0]);
    }
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") document.body.classList.remove("nav-open"); });

  window.addEventListener("hashchange", route);
  $("#role").innerHTML = C.ROLES.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("");
  route();
})();
