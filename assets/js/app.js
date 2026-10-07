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
      if (raw) {
        const p = JSON.parse(raw);
        if (p && (p.version === C.version || p.version === 2) && Array.isArray(p.submissions)) {
          if (p.role === "donor") p.role = "partner";
          p.version = C.version;
          return p;
        }
      }
    } catch (e) { /* storage unavailable: fall back to sample data */ }
    return null;
  }
  let state = load() || fresh();
  function sigOf(s) { return JSON.stringify([s.submissions, s.voices, s.decisions]); }
  let dataSig = sigOf(state);
  function save() {
    const sg = sigOf(state);
    if (sg !== dataSig) { dataSig = sg; state.updatedAt = new Date().toISOString(); }
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ }
    liveStamp();
  }

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
  const isPartner = () => state.role === "partner";
  const isTeacher = () => state.role === "teacher";
  const can = { add: () => !["partner", "teacher"].includes(state.role), verify: () => state.role === "me", decide: () => state.role === "lead", review: () => ["staff", "me", "lead"].includes(state.role) };
  const CURRENT_TERM = C.TERMS[C.TERMS.length - 1].id;
  const NAME_PHRASE = /\b(my name is|naitwa|jina langu ni)\b/i;
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
      const given = v => v !== "" && v !== null && v !== undefined;
      if (dsKey === "innovated_sites" && given(row.female_completed) && Number(row.female_completed) > Number(row.completed)) {
        issues.push({ level: "flag", excl: null, msg: "More women recorded than teachers who completed" });
      }
      if (dsKey === "teacher_checkin") {
        const g = Number(row.girls), b = Number(row.boys), size = Number(row.class_size);
        if (given(row.girls) && given(row.boys) && isFinite(g) && isFinite(b) && isFinite(size) && g + b !== size) issues.push({ level: "flag", excl: null, msg: `Girls and boys add up to ${g + b}, not the class size of ${size}` });
        if (given(row.with_disability) && Number(row.with_disability) > size) issues.push({ level: "flag", excl: null, msg: "More learners with disabilities than learners in the class" });
        if (NAME_PHRASE.test(String(row.what_worked || ""))) issues.push({ level: "fail", excl: "row", msg: "The note looks like it names someone. Remove the name" });
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
    const wRows = base.filter(x => x.row.female_completed !== "" && x.row.female_completed != null && +x.row.female_completed <= +x.row.completed);
    return {
      base, useI, sites: base.length, useSites: useI.length, registered, completed, completion: completed / registered,
      costPerCompleter: cost / completed, useCompleted, useRegistered, users, usePct: users / useCompleted,
      per100: users / useRegistered * 100, costPerActive: useCost / users, counties: new Set(base.map(x => x.row.county)).size,
      women: wRows.length ? sum(wRows, x => +x.row.female_completed) / sum(wRows, x => +x.row.completed) : NaN, womenSites: wRows.length
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

  /* ---------- teacher check-ins ---------- */
  const RECENT = ["This week", "Last week"];
  function teacherReport() {
    const term = latestTerm("teacher_checkin");
    const rows = term ? verifiedItems("teacher_checkin", term).filter(x => !x.res.exclRow).map(x => x.row) : [];
    const given = v => v !== "" && v !== null && v !== undefined && isFinite(Number(v));
    const mins = rows.filter(r => given(r.minutes_saved) && +r.minutes_saved > 0).map(r => +r.minutes_saved);
    const mk = rows.filter(r => given(r.girls) && given(r.boys));
    return {
      term, rows, n: rows.length,
      recent: rows.filter(r => RECENT.includes(r.last_used)).length,
      lastUsed: C.LAST_USED.map(o => [o, rows.filter(r => r.last_used === o).length]),
      support: C.SUPPORT.map(o => [o, rows.filter(r => r.support === o).length]),
      minutes: median(mins), minutesN: mins.length,
      outcomes: C.NORTH_STAR.map(o => [o, rows.filter(r => String(r.outcomes_seen || "").toLowerCase().split(/[;,]/).map(x => x.trim()).includes(o.key)).length]),
      girls: sum(mk, r => +r.girls), boys: sum(mk, r => +r.boys),
      swd: sum(rows.filter(r => given(r.with_disability)), r => +r.with_disability), learners: sum(rows, r => +r.class_size || 0)
    };
  }
  function schoolMeeting() {
    const t = latestTerm("school_obs");
    if (!t) return null;
    const rows = verifiedItems("school_obs", t).filter(x => !x.res.exclRow && x.row.meeting_pct !== "" && x.row.meeting_pct != null).map(x => x.row);
    return rows.length ? { term: t, value: mean(rows.map(r => +r.meeting_pct)), n: rows.length } : null;
  }

  /* ---------- audit trail and decisions ---------- */
  function historyOf(sub) {
    if (Array.isArray(sub.history) && sub.history.length) return sub.history;
    const h = [{ at: sub.submittedAt, who: sub.submittedBy, what: "Submitted" }];
    if (sub.reviewedAt) h.push({ at: sub.reviewedAt, who: sub.reviewedBy || "M&E", what: sub.status === "returned" ? "Returned with a note" : "Verified" });
    return h;
  }
  function logEvent(sub, what, who) { sub.history = historyOf(sub).slice(); sub.history.push({ at: today(), who: who || roleOf().label, what }); }
  const isDue = d => !d.reviewedOn && d.review && d.review <= today();
  const decisionFor = id => state.decisions.find(d => d.promptId === id && !d.reviewedOn);

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
        options: ["Pilot Metis co-delivery plus two follow-ups at these sites next term", "Wait one more cycle, then apply the rule", "Move the lowest site now"],
        learn: "Partner-led training is turning fewer trained teachers into regular users than Metis-led training. Next term we're testing Metis co-delivery and two follow-up visits at those sites."
      });
      const small = m.base.filter(x => +x.row.registered < 15);
      if (small.length) list.push({
        id: "small-sessions", sev: "decide", route: "programs/innovated",
        title: `${small.length} InnovatED sessions had fewer than 15 teachers`,
        evidence: small.map(x => `Site ${x.row.site}, ${x.row.county}: ${x.row.registered} registered, ${kes(x.row.cost_per_completer)} per completer`).join(" · "),
        rule: "Agreed rule: cluster nearby schools so every session has at least 15 teachers. Remote counties keep their sessions for equity, with local co-facilitators to cut travel.",
        options: ["Cluster schools for the next cohort", "Train two local co-facilitators in Turkana", "Keep as is and record the equity reason"],
        learn: "Very small and remote sessions cost far more per teacher. We're grouping nearby schools and training local co-facilitators, so remote counties keep their place."
      });
      if (m.heldBack.length) list.push({
        id: "data-held", sev: "watch", route: "review",
        title: `${m.heldBack.length} InnovatED sites have data held back by checks`,
        evidence: m.heldBack.map(x => `Site ${x.row.site}: ${x.res.issues.filter(i => i.excl).map(i => i.msg).join("; ")}`).join(" · "),
        rule: "Rows that fail checks stay out of the affected figures until the source registers are re-checked.",
        options: ["Ask the delivering team to re-check registers", "Call back a sample of teachers at these sites"],
        learn: "Some site records failed our checks. They stay out of these figures until the registers have been re-checked."
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
        options: [`Make ${low.name.toLowerCase()} next term's coaching focus`, "Share practice from the school with the highest score"],
        learn: `${low.name} is the North Star outcome children show least often, so it's the focus of next term's school coaching.`
      });
    }
    const tr = teacherReport();
    if (tr.n) {
      const visits = tr.support.find(x => x[0] === "Coaching visit")[1], help = tr.support.find(x => x[0] === "Help with the tool")[1];
      if (visits + help >= 5) list.push({
        id: "teacher-support", sev: "watch", route: "programs/innovated",
        title: `${visits + help} teachers asked for support in their check-ins`,
        evidence: `${visits} asked for a coaching visit and ${help} for help with the tool, out of ${tr.n} check-ins in ${termLabel(tr.term)}.`,
        rule: "Agreed rule: every teacher who asks for support hears back within a week, and coaches plan visits around the requests.",
        options: ["Schedule coaching visits this month", "Run a short tool clinic for teachers asking for help"],
        learn: `In their own check-ins, ${visits + help} of ${tr.n} teachers asked for more support. Coaches are planning visits and a short tool clinic around those requests.`
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

  /* ---------- partner sentences ---------- */
  function partnerSentences() {
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
    const tr = teacherReport();
    if (tr.n) out.push({
      program: "InnovatED, teachers' own reports",
      text: `In ${termLabel(tr.term)} check-ins, ${tr.recent} of ${tr.n} teachers said they had used the InnovatED tool in a lesson in the past two weeks${tr.minutesN ? `, and those who gave a figure reported saving a median of ${Math.round(tr.minutes)} minutes that week` : ""}.`,
      source: "Teacher check-ins (self-reported), checked by M&E", n: `n = ${tr.n} check-ins`
    });
    testbed().strong.forEach(p => out.push({
      program: "Kenya EdTech Testbed",
      text: `In the EdTech Testbed, the "${p.pilot}" pilot ran in ${p.schools} schools with ${fmt(p.learners)} learners. Result: ${p.result.charAt(0).toLowerCase() + p.result.slice(1)}.`,
      source: `${p.evidence} design, checked by M&E`, n: `n = ${fmt(p.learners)} learners`
    }));
    return out;
  }

  const dataTable = (headers, rows) => `<details class="data-table"><summary>View the data</summary><div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  const PRIVACY_HTML = `<p>This is a concept prototype. Everything you add stays in this browser until you export it. Nothing is sent to a server.</p>
    <ul class="ticks">
      <li><strong>What it holds:</strong> aggregate figures for sites, schools, events and pilots; coded Fellow records; teacher check-ins without names; anonymous quotes with recorded consent.</li>
      <li><strong>What it never holds:</strong> learners' names, phone numbers, email addresses, UPI, NEMIS or admission numbers, or photos of children. Uploads and notes that contain them are blocked.</li>
      <li><strong>Photos:</strong> the five photos are Metis's own, from metiscollective.org, and show adults only. The portal never stores photos of learners.</li>
      <li><strong>Children's data:</strong> Kenya's Data Protection Act (2019) requires a parent or guardian's consent to process a child's data. Learner quotes therefore need caregiver consent and the learner's own agreement.</li>
      <li><strong>Keeping and deleting:</strong> Export saves a copy and Reset sample data clears this browser. A production version would set retention periods in Metis's data protection policy.</li>
    </ul>`;
  function verifiedFigures() {
    const rows = [["Programme", "Measure", "Value", "Sample", "Source", "Period"]];
    const ns = northStarNow();
    if (ns) ns.values.forEach(v => rows.push(["Whole Child Schools", `${v.name} evident in observed lessons`, Math.round(v.value) + "%", `${ns.lessons} lessons, ${ns.schools.length} schools`, "Classroom observation", termLabel(ns.term)]));
    const sm = schoolMeeting();
    if (sm) rows.push(["Whole Child Schools", "Learners meeting or exceeding expectations", Math.round(sm.value) + "%", `${sm.n} schools`, "School-based assessment", termLabel(sm.term)]);
    const m = innovated();
    if (m) {
      rows.push(["InnovatED", "Completion", pct(m.completion), `${m.registered} registered, ${m.sites} sites`, "Attendance registers", termLabel(m.term)]);
      rows.push(["InnovatED", "Using the tool at 8 weeks", pct(m.usePct), `${m.useCompleted} trained teachers, ${m.useSites} sites`, "Head-teacher follow-up", termLabel(m.term)]);
      rows.push(["InnovatED", "Cost per teacher using the tool (KES)", Math.round(m.costPerActive), `${m.useSites} sites`, "Finance ledger and use data", termLabel(m.term)]);
    }
    const tr = teacherReport();
    if (tr.n) rows.push(["InnovatED", "Teachers who used the tool this week or last", pct(tr.recent / tr.n), `${tr.n} check-ins`, "Teacher check-in (self-report)", termLabel(tr.term)]);
    const f = fellowship();
    if (f.n) rows.push(["Metis Fellowship", "Fellows who led a full design test", `${f.led} of ${f.n}`, `${f.n} Fellows`, "Coach observation", termLabel(f.term)]);
    const e = events();
    if (e.rows.length) rows.push(["Knowledge Sharing Events", "Commitments followed up", pct(e.followed / e.made), `${e.made} commitments`, "Follow-up calls", `${e.rows.length} events`]);
    return rows;
  }

  /* ---------- charts ---------- */
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
  const heatColor = v => { const t = Math.max(0, Math.min(1, (v - 20) / 65)); const a = [238, 248, 249], b = [95, 182, 192]; return `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * t)).join(",")})`; };

  /* ---------- small UI pieces ---------- */
  const chip = (cls, text, tip) => `<span class="chip ${cls}"${tip ? ` data-tip="${esc(tip)}" tabindex="0"` : ""}>${cls === "ok" ? "✓ " : cls === "bad" ? "✕ " : cls === "warn" ? "! " : ""}${esc(text)}</span>`;
  const statusChip = s => s === "verified" ? chip("ok", "Verified") : s === "submitted" ? chip("wait", "Awaiting review") : chip("bad", "Returned");
  const kpi = (label, value, sub, tip) => `<div class="kpi"${tip ? ` data-tip="${esc(tip)}" tabindex="0"` : ""}><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ""}</div>`;
  const head = (eyebrow, title, lede) => `<header class="page-head"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</header>`;
  const empty = (text, action) => `<div class="empty"><p>${text}</p>${action || ""}</div>`;

  /* ---------- views ---------- */
  /* ---------- dashboard (landing page) ---------- */
  /* Label nudges for small or crowded counties: [dx, dy, anchor, leader line] */
  const MAP_LABEL = { "Nairobi": [-72, 28, "end", true], "Kiambu": [-6, -12, "middle"], "Kajiado": [0, 8, "middle"], "Kisumu": [-8, -15, "middle"], "Machakos": [30, 4, "middle"] };
  const MAP_BINS = [[1000, "1,000 or more", "#13808d"], [100, "100 to 999", "#6dbcc6"], [1, "Under 100", "#c6e6ea"]];
  /* One colour per North Star outcome; validated as a set for colour-blind readers. */
  const NS_COLOR = { belonging: "#1699a8", delight: "#eb6834", expertise: "#5b6fd6", creativity: "#e0a100", agency: "#c9508a" };

  function latestSchoolObs() {
    return C.SCHOOLS.map(s => {
      let found = null;
      C.TERMS.forEach(t => { const it = verifiedItems("school_obs", t.id).find(x => x.row.school === s.id && !x.res.exclRow); if (it) found = { term: t.id, row: it.row }; });
      return { s, found, waiting: subsOf("school_obs", "submitted").some(sub => sub.rows.some(r => r.school === s.id)) };
    });
  }
  function footprint() {
    const out = {};
    const put = (c, k, v) => { if (!c) return; out[c] = out[c] || { teachers: 0, learners: 0, fellows: 0, events: 0 }; out[c][k] += v; };
    const m = innovated(); if (m) m.base.forEach(x => put(x.row.county, "teachers", +x.row.completed));
    C.SCHOOLS.forEach(s => put(s.county, "learners", s.learners));
    fellowship().rows.forEach(r => put(r.county, "fellows", 1));
    events().rows.forEach(r => put(r.county, "events", 1));
    return out;
  }

  function ring(frac, size, stroke, label) {
    const f = Math.max(0, Math.min(1, frac)), r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label)}">
      <circle cx="${h}" cy="${h}" r="${r}" class="ring-track" stroke-width="${stroke}"/>
      <circle cx="${h}" cy="${h}" r="${r}" class="ring-fill" style="--len:${(c * f).toFixed(1)}" stroke-width="${stroke}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${h} ${h})"/>
      <text x="${h}" y="${h}" dominant-baseline="central" text-anchor="middle" class="ring-text">${Math.round(f * 100)}%</text></svg>`;
  }

  /* Outcome progress: one row per North Star outcome. The bar runs from the first to the latest term,
     with a marker for each term between. The scale fits the data, so small gains are still visible. */
  function progressRows(series, terms, o) {
    const all = series.flatMap(sr => sr.vals).concat(Object.values(o.targets || {}));
    const min = Math.max(0, Math.floor((Math.min(...all) - 4) / 10) * 10), max = Math.min(100, Math.ceil((Math.max(...all) + 4) / 10) * 10);
    const X = v => (Math.max(min, Math.min(max, v)) - min) / (max - min) * 100;
    const ticks = [];
    for (let v = min; v <= max; v += 10) ticks.push(v);
    const grid = `background-size:${100 / (ticks.length - 1)}% 100%`;
    const rows = series.map((sr, i) => {
      const a = sr.vals[0], z = sr.vals[sr.vals.length - 1], d = Math.round(z) - Math.round(a), tg = o.targets && o.targets[sr.key];
      const tip = `${sr.name}: ${sr.vals.map((v, k) => `${terms[k]} ${Math.round(v)}%`).join(", ")}${tg ? `. Target ${tg}%` : ""}`;
      return `<div class="prog-row" role="listitem" tabindex="0" data-tip="${esc(tip)}" style="--c:${sr.color};--delay:${i * 90}ms">
        <span class="prog-badge">${kid(sr.key, true)}</span>
        <span class="prog-name">${esc(sr.name)}</span>
        <span class="prog-val">${Math.round(z)}%</span>
        <div class="prog-track" style="${grid}">
          <span class="prog-range" style="left:${X(Math.min(a, z))}%;width:${Math.abs(X(z) - X(a))}%"></span>
          ${tg ? `<span class="prog-target" style="left:${X(tg)}%"></span>` : ""}
          <span class="prog-dot start" style="left:${X(a)}%"></span>
          ${sr.vals.slice(1, -1).map(v => `<span class="prog-dot mid" style="left:${X(v)}%"></span>`).join("")}
          <span class="prog-dot end" style="left:${X(z)}%"></span>
        </div>
        <span class="prog-delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${d} pts</span>
      </div>`;
    }).join("");
    return `<div class="prog" role="list" aria-label="${esc(o.label)}">
      <div class="prog-axis" aria-hidden="true"><div class="prog-ticks">${ticks.map(v => `<span style="left:${X(v)}%">${v}%</span>`).join("")}</div></div>
      ${rows}
      <div class="prog-legend"><span><i class="key-dot start"></i>${esc(terms[0])}</span>${terms.length > 2 ? `<span><i class="key-dot mid"></i>${esc(terms.slice(1, -1).join(", "))}</span>` : ""}<span><i class="key-dot end"></i>${esc(terms[terms.length - 1])}</span>${o.targets ? `<span><i class="key-target"></i>Target</span>` : ""}</div>
    </div>`;
  }

  function funnelSVG(groups) {
    const W = 560, colW = W / groups.length, rowH = 66, top = 44, h = 30, maxBar = colW - 84;
    let g = "";
    groups.forEach((gr, gi) => {
      const cx = gi * colW + colW / 2 - 16;
      g += `<text class="fun-title" x="${cx}" y="16" text-anchor="middle">${esc(gr.name)}</text>`;
      gr.stages.forEach((s, si) => {
        const w = Math.max(4, maxBar * s.value / 100), y = top + si * rowH;
        if (si > 0) {
          const pw = Math.max(4, maxBar * gr.stages[si - 1].value / 100), py = top + (si - 1) * rowH + h;
          g += `<polygon class="fun-link" style="fill:${gr.color}" points="${cx - pw / 2},${py} ${cx + pw / 2},${py} ${cx + w / 2},${y} ${cx - w / 2},${y}"/>`;
        }
        g += `<text class="fun-stage" x="${cx}" y="${y - 7}" text-anchor="middle">${esc(s.label)}</text>
          <g tabindex="0" data-tip="${esc(`${gr.name}: ${s.label.toLowerCase()}, ${Math.round(s.value)} of every 100 who registered (${s.note})`)}">
          <rect class="fun-bar" x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:${gr.color}"/>
          <text class="fun-val" x="${cx + w / 2 + 8}" y="${y + h / 2 + 5}">${Math.round(s.value)}</text></g>`;
      });
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${top + groups[0].stages.length * rowH - 20}" role="img" aria-label="Registration to classroom use, per 100 teachers who register">${g}</svg>`;
  }

  function bubbleSVG(items) {
    const W = 560, H = 330, l = 62, r = 22, t = 30, b = 48;
    const pts = items.map(x => ({ s: x.row.site, c: x.row.county, d: x.row.delivered_by, n: +x.row.registered, u: +x.row.using_pct, cpu: x.row.cost_per_completer / (x.row.using_pct / 100) }));
    const yMax = Math.ceil(Math.max(...pts.map(p => p.cpu)) / 4000) * 4000;
    const X = v => l + (W - l - r) * v / 100, Y = v => t + (H - t - b) * (1 - v / yMax);
    let g = "";
    for (let v = 0; v <= yMax; v += 4000) g += `<line class="grid" x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${l - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
    for (let v = 0; v <= 100; v += 20) g += `<text class="axis" x="${X(v)}" y="${H - b + 18}" text-anchor="middle">${v}%</text>`;
    const mu = median(pts.map(p => p.u)), mc = median(pts.map(p => p.cpu));
    g += `<line class="ref" x1="${X(mu)}" x2="${X(mu)}" y1="${t}" y2="${H - b}"/><line class="ref" x1="${l}" x2="${W - r}" y1="${Y(mc)}" y2="${Y(mc)}"/>
      <text class="quad" x="${W - r - 4}" y="${H - b - 8}" text-anchor="end">Higher use, lower cost</text>
      <text class="ax-title" x="${l}" y="14">KES per teacher using the tool</text>
      <text class="ax-title" x="${(l + W - r) / 2}" y="${H - 8}" text-anchor="middle">Teachers using the tool at 8 weeks</text>`;
    const crowded = p => pts.some(q => q !== p && Math.hypot(X(q.u) - X(p.u), Y(q.cpu) - Y(p.cpu)) < 30);
    pts.sort((a, b) => b.n - a.n).forEach(p => {
      const rad = 4 + Math.sqrt(p.n) * 1.7, cls = p.d === "Metis" ? "s-metis" : "s-partner";
      g += `<g tabindex="0" class="bub-g" data-tip="${esc(`Site ${p.s}, ${p.c} (${p.d}-led): ${p.u}% using the tool, ${kes(p.cpu)} per teacher using it, ${p.n} registered`)}">
        <circle class="bub ${cls}" cx="${X(p.u)}" cy="${Y(p.cpu)}" r="${rad}"/>${crowded(p) ? "" : `<text class="bub-lab" x="${X(p.u) + rad + 3}" y="${Y(p.cpu) + 4}">${esc(p.s)}</text>`}</g>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Use at eight weeks against cost per teacher using the tool, by site">${g}</svg>`;
  }

  function countyMap(fp) {
    const K = window.KENYA_MAP;
    if (!K) return empty("Map data didn't load.");
    const total = v => v.teachers + v.learners + v.fellows;
    const bin = n => MAP_BINS.find(b => n >= b[0]);
    let shapes = "", labels = "";
    Object.entries(K.counties).sort((a, b) => (fp[a[0]] ? 1 : 0) - (fp[b[0]] ? 1 : 0)).forEach(([name, c]) => {
      const v = fp[name], n = v ? total(v) : 0, b = n ? bin(n) : null;
      const parts = v ? [v.learners && `${fmt(v.learners)} learners in partner schools`, v.teachers && `${v.teachers} teachers trained`, v.fellows && `${v.fellows} Fellow${v.fellows > 1 ? "s" : ""}`, v.events && `${v.events} Knowledge Sharing Event`].filter(Boolean).join(", ") : "no Metis activity in this data";
      shapes += `<path class="cty-shape${b ? " on" : ""}" d="${c.d}" style="fill:${b ? b[2] : "var(--map-off)"}" tabindex="${b ? 0 : -1}" data-tip="${esc(`${name}: ${parts}`)}"${b ? ` data-action="county" data-county="${esc(name)}" role="button" aria-label="${esc(`${name}. ${parts}. Open the county profile`)}"` : ""}/>`;
      if (b) {
        const o = MAP_LABEL[name] || [0, 4, "middle"], lx = c.cx + o[0], ly = c.cy + o[1];
        if (o[3]) labels += `<line class="map-leader" x1="${c.cx}" y1="${c.cy}" x2="${lx + 3}" y2="${ly - 4}"/><circle class="map-pin" cx="${c.cx}" cy="${c.cy}" r="2.6"/>`;
        labels += `<text class="map-lab" x="${lx}" y="${ly}" text-anchor="${o[2]}">${esc(name)}</text>`;
      }
    });
    const legend = `<div class="lg">${MAP_BINS.map(b => swatch(b[2], b[1])).join("")}${swatch("var(--map-off)", "No activity in this data")}</div>`;
    return `<svg class="chart map" viewBox="0 0 ${K.w} ${K.h}" role="img" aria-label="Map of Kenya's 47 counties shaded by people Metis reaches">${shapes}${K.outline ? `<path class="ken-outline" d="${K.outline}"/>` : ""}${labels}</svg>${legend}<div class="county-detail" aria-live="polite"><p class="small muted">Select a shaded county to see what Metis does there.</p></div>
      ${dataTable(["County", "Learners in partner schools", "Teachers trained", "Fellows"], Object.entries(fp).filter(([c]) => K.counties[c]).sort((a, b) => total(b[1]) - total(a[1])).map(([c, v]) => [c, fmt(v.learners), fmt(v.teachers), fmt(v.fellows)]))}
      <p class="map-src">Learners, teachers and Fellows reached per county. Boundaries: ${esc(K.source)}.</p>`;
  }
  function countyDetail(name) {
    const fp = footprint()[name];
    if (!fp) return "";
    const m = innovated(), sites = m ? m.items.filter(x => x.row.county === name) : [];
    const schools = C.SCHOOLS.filter(x => x.county === name), fellows = fellowship().rows.filter(r => r.county === name);
    const ev = events().rows.filter(r => r.county === name), tc = teacherReport().rows.filter(r => r.county === name);
    return `<h3>${esc(name)} County</h3><ul class="county-list">
      ${schools.length ? `<li><strong>Whole Child Schools:</strong> ${schools.map(x => `${esc(x.label)} (${esc(x.stage.toLowerCase())}, ${fmt(x.learners)} learners)`).join("; ")}</li>` : ""}
      ${sites.length ? `<li><strong>InnovatED:</strong> ${sites.length} site${sites.length > 1 ? "s" : ""} (${sites.map(x => `${esc(x.row.site)}${x.res.exclRow || x.res.exclUse || x.row.using_pct === "" ? ", held back" : `, ${x.row.using_pct}% using`}`).join("; ")}), ${fmt(fp.teachers)} teachers trained</li>` : ""}
      ${tc.length ? `<li><strong>Teacher check-ins:</strong> ${tc.length} this term</li>` : ""}
      ${fellows.length ? `<li><strong>Fellows:</strong> ${fellows.length} (${[...new Set(fellows.map(r => r.org_type.toLowerCase()))].join(", ")})</li>` : ""}
      ${ev.length ? `<li><strong>Knowledge Sharing:</strong> ${ev.map(r => esc(r.event)).join("; ")}</li>` : ""}
    </ul>`;
  }

  function staircase(levels, n) {
    const W = 360, H = 210, l = 6, t = 22, b = 46, k = levels.length, slot = (W - 2 * l) / k, bw = 24;
    const Y = v => t + (H - t - b) * (1 - v / n);
    let g = `<line class="grid" x1="${l}" x2="${W - l}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    levels.forEach((lv, i) => {
      const cx = l + slot * i + slot / 2, y = Y(lv.value);
      g += `<g tabindex="0" data-tip="${esc(`Level ${i + 1}, ${lv.label}: ${lv.value} of ${n} Fellows`)}"><path class="col-bar" d="M${cx - bw / 2},${Y(0)} V${y + 4} Q${cx - bw / 2},${y} ${cx - bw / 2 + 4},${y} H${cx + bw / 2 - 4} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + 4} V${Y(0)} Z"/>
        <text class="cap" x="${cx}" y="${y - 6}" text-anchor="middle">${lv.value}</text></g>
        <text class="col-lab" x="${cx}" y="${H - b + 18}" text-anchor="middle">${i + 1} ${esc(lv.short)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H - 18}" role="img" aria-label="Guskey levels for the Fellowship cohort">${g}</svg>`;
  }

  function bullet(rows, target, max) {
    const W = 370, H = 104, l = 6, r = 10, ty = 40, th = 26, X = v => l + (W - l - r) * v / max;
    const now = rows[rows.length - 1], prev = rows.slice(0, -1);
    let g = `<rect class="band-a" x="${X(0)}" y="${ty}" width="${X(target) - X(0)}" height="${th}" rx="4"/>
      <rect class="band-b" x="${X(target)}" y="${ty}" width="${X(8) - X(target)}" height="${th}"/>
      <rect class="band-c" x="${X(8)}" y="${ty}" width="${X(max) - X(8)}" height="${th}" rx="4"/>
      <text class="bul-band" x="${X(target / 2)}" y="${ty + th + 16}" text-anchor="middle">on target</text>
      <text class="bul-band" x="${X(6.5)}" y="${ty + th + 16}" text-anchor="middle">watch</text>
      <text class="bul-band" x="${X(10)}" y="${ty + th + 16}" text-anchor="middle">slow</text>
      <rect class="bul-bar" x="${X(0)}" y="${ty + 8}" width="${X(+now.median_days) - X(0)}" height="10" rx="3" tabindex="0" data-tip="${esc(`${termLabel(now.period)}: ${now.median_days} days median, target ${target}`)}"/>
      <line class="bul-target" x1="${X(target)}" x2="${X(target)}" y1="${ty - 5}" y2="${ty + th + 5}"/>`;
    prev.forEach(p => { const x = X(+p.median_days); g += `<path class="bul-prev" d="M${x - 6},${ty - 14} L${x + 6},${ty - 14} L${x},${ty - 5} Z" tabindex="0" data-tip="${esc(`${termLabel(p.period)}: ${p.median_days} days`)}"/><text class="bul-lab" x="${x}" y="${ty - 19}" text-anchor="middle">${esc(termLabel(p.period).replace(", 2026", ""))}</text>`; });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Feedback turnaround against the five-day target">${g}</svg>`;
  }

  function ladderSVG(pilots) {
    const W = 560, rowH = 56, t = 26, l = 18, r = 70, S = C.PILOT_STAGES, H = t + pilots.length * rowH + 4;
    const X = i => l + (W - l - r) * i / (S.length - 1);
    let g = S.map((s, i) => `<text class="lad-stage" x="${X(i)}" y="12" text-anchor="middle">${s}</text>`).join("");
    pilots.forEach((p, i) => {
      const si = Math.max(0, S.indexOf(p.stage)), y = t + i * rowH + 34, rad = 6 + Math.sqrt(+p.learners) / 9;
      g += `<text class="lad-name" x="${l}" y="${y - 16}">${esc(p.pilot)}${p.status === "submitted" ? " (awaiting review)" : ""}</text>
        <line class="lad-rest" x1="${X(0)}" x2="${X(S.length - 1)}" y1="${y}" y2="${y}"/>
        ${S.map((_, k) => `<circle class="lad-tick" cx="${X(k)}" cy="${y}" r="3"/>`).join("")}
        <line class="lad-track" x1="${X(0)}" x2="${X(si)}" y1="${y}" y2="${y}"/>
        <circle class="lad-dot${p.status === "submitted" ? " pending" : ""}" cx="${X(si)}" cy="${y}" r="${rad}" tabindex="0" data-tip="${esc(`${p.pilot}: ${p.stage}. ${fmt(p.learners)} learners in ${p.schools} schools. ${p.result}. Evidence: ${p.evidence}.`)}"/>
        <text class="lad-n" x="${X(S.length - 1) + 16}" y="${y + 4}">${fmt(p.learners)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="EdTech pilots by evidence stage">${g}</svg>`;
  }

  const swatch = (color, label) => `<span class="lg-item"><span class="sw" style="background:${color}"></span>${esc(label)}</span>`;

  /* ---------- the North Star as children ---------- */
  const KID_ARMS = {
    agency: '<path d="M8.8 13.6 L5.4 20.2"/><path d="M15.2 13.2 L18.6 3.2"/>',
    belonging: '<path d="M8.6 14.2 L0.4 16.4"/><path d="M15.4 14.2 L23.6 16.4"/>',
    creativity: '<path d="M8.8 13.6 L5.4 20.2"/><path d="M15.2 13.2 L19.2 7.4"/>',
    delight: '<path d="M9 13 L4 4.2"/><path d="M15 13 L20 4.2"/>',
    expertise: '<path d="M8.8 13.6 L7.2 17.8"/><path d="M15.2 13.6 L16.8 17.8"/>'
  };
  const KID_EXTRA = {
    creativity: '<polygon class="k-acc" points="19.6,0.6 20.5,2.6 22.6,2.8 21,4.2 21.5,6.3 19.6,5.2 17.7,6.3 18.2,4.2 16.6,2.8 18.7,2.6"/>',
    expertise: '<rect class="k-acc" x="5.6" y="15.6" width="12.8" height="7" rx="1.2"/><path class="k-spine" d="M12 15.6 V22.6"/>'
  };
  const KID_HINT = { agency: "chooses and acts", belonging: "feels they matter", creativity: "imagines and solves", delight: "finds joy", expertise: "masters skills" };
  const kid = (key, lit) => `<svg class="kid${lit ? " lit" : ""}" viewBox="0 0 24 32" aria-hidden="true"><g class="k-arms">${KID_ARMS[key]}</g><circle cx="12" cy="5.6" r="4.1"/><rect x="8" y="10.8" width="8" height="11.6" rx="3.6"/><rect x="8.6" y="20.6" width="2.7" height="9.4" rx="1.35"/><rect x="12.7" y="20.6" width="2.7" height="9.4" rx="1.35"/>${KID_EXTRA[key] || ""}</svg>`;

  /* Ten children per outcome: lit children are lessons (or classrooms) where the outcome showed up. */
  function childRows(items, o) {
    const rows = items.map((it, r) => {
      const n = Math.max(0, Math.min(10, Math.round(it.value / 10)));
      const hasBase = isFinite(it.base), b = hasBase ? Math.max(0, Math.min(10, Math.round(it.base / 10))) : n;
      const d = hasBase ? Math.round(it.value) - Math.round(it.base) : null;
      const kids = Array.from({ length: 10 }, (_, i) => `<span class="kid-slot${i < n && i >= b ? " new" : ""}" style="--i:${i}">${kid(it.key, i < n)}</span>`).join("");
      return `<div class="kid-row ${it.key}" role="listitem" tabindex="0" data-tip="${esc(`${it.name}: ${o.tip(it)}`)}" style="--c:${it.color};--row:${r}"${o.go ? ` data-action="go" data-to="${o.go}"` : ""}>
        <div class="kid-name"><span class="kid-badge">${kid(it.key, true)}</span><span>${esc(it.name)}<small>${esc(KID_HINT[it.key])}</small></span></div>
        <div class="kid-line">${kids}</div>
        <div class="kid-val"><b><span data-count="${n}">${n}</span><i>/10</i></b>${d != null ? `<span class="kid-delta ${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : ""}${d} pts</span>` : `<span class="kid-pct">${Math.round(it.value)}%</span>`}</div>
      </div>`;
    }).join("");
    return `<div class="kids" role="list" aria-label="${esc(o.label)}">${rows}
      <div class="kid-legend"><span><span class="kid-key">${kid("delight", true)}</span>${esc(o.unit)}</span>${items.some(it => isFinite(it.base)) ? `<span><i class="spark">✦</i>new since ${esc(o.baseLabel)}</span>` : ""}</div></div>`;
  }

  /* A small child badge stands in for the old A to E letters wherever an outcome is named. */
  const nsKid = (key, title) => `<span class="ns-kid" style="--c:${NS_COLOR[key]}"${title ? ` title="${esc(title)}"` : ""}>${kid(key, true)}</span>`;
  const nsKids = (ns, go) => childRows(ns.values.map(v => ({ key: v.key, name: v.name, color: NS_COLOR[v.key], value: v.value, base: v.base })),
    { label: "North Star outcomes as children", unit: "a lesson where children clearly showed it, out of 10", baseLabel: ns.baseTerm ? termLabel(ns.baseTerm).replace(", 2026", "") : "Term 1", go,
      tip: it => `clearly evident in ${Math.round(it.value)}% of observed lessons${isFinite(it.base) ? ` (${ns.baseTerm ? termLabel(ns.baseTerm).replace(", 2026", "") : "Term 1"}: ${Math.round(it.base)}%)` : ""}` });

  /* ---------- small dashboard pieces ---------- */
  const MARK = `<svg class="cap-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M16 14h12v-2a5 5 0 0 1 10 0v2h12v12h-2a5 5 0 0 0 0 10h2v14H38v-2a5 5 0 0 0-10 0v2H16V36h2a5 5 0 0 0 0-10h-2z"/></svg>`;
  const CAP = {
    north: "A world where learners thrive starts one lesson at a time.",
    progress: "Small steps, every term. We go further together.",
    funnel: "Training is the start. A tool in a teacher's hands is the win.",
    cost: "Value for money is counted in classrooms, not certificates.",
    map: "Proximate leaders, from Turkana to Kajiado.",
    heat: "Every school is writing its own whole child story.",
    waffle: "Every Fellow on their own path, none walking alone.",
    guskey: "From a good session to a changed classroom.",
    feedback: "Feedback within five days: small things, done with great love.",
    events: "If you want to go far, go together.",
    ladder: "Evidence before scale. That's how we redefine excellence.",
    teachers: "Teachers know what's working. We listen and learn.",
    decisions: "Listen, learn, then decide.",
    voice: "Listen and learn: their words come first.",
    activity: "Every check-in and every review, as it happens.",
    todo: "Do small things with great love, starting with these.",
    queue: "Nothing counts until it's checked.",
    held: "Honest data is kind data.",
    fresh: "Fresh data, fair decisions.",
    checks: "Redefining excellence, one row at a time.",
    hello: "We are the ones we've been waiting for.",
    ideas: "Ideas from classrooms like yours.",
    time: "Time saved is time given back to children.",
    report: "Honest numbers and real voices, ready to share."
  };
  const card = o => `<section class="dcard span-${o.span || 6}${o.cls ? " " + o.cls : ""}" data-card="${o.id}" data-sig="${esc(o.sig == null ? "" : String(o.sig))}">
      <div class="dcard-head"><h2>${o.title}</h2>${o.link ? `<a class="more" href="${o.link}" aria-label="Details: ${esc(o.title)}">Details</a>` : ""}</div>
      ${o.meta ? `<p class="dmeta">${o.meta}</p>` : ""}
      <div class="dbody">${o.body}</div>
      ${o.cap ? capLine(o.cap) : ""}
    </section>`;
  const capLine = text => `<p class="dcap">${MARK}<span>${esc(text)}</span></p>`;
  const numOut = (v, f) => (f === "pct" ? Math.round(v) + "%" : f === "kes" ? kes(v) : f === "dec" ? String(Math.round(v * 10) / 10) : f === "m" ? Math.round(v / 1e5) / 10 + "M" : fmt(v));
  const num = (v, f) => (isFinite(v) ? `<span data-count="${v}" data-fmt="${f || "int"}">${numOut(v, f)}</span>` : "n/a");
  const tile = o => `<div class="stat${o.side ? " stat-row" : ""}" data-card="tile-${o.id}" data-sig="${esc(String(o.sig == null ? o.value : o.sig))}"${o.tip ? ` data-tip="${esc(o.tip)}" tabindex="0"` : ""}>
      ${o.side ? "<div>" : ""}<div class="stat-label">${esc(o.label)}</div><div class="stat-value">${num(o.value, o.fmt)}${o.of != null ? `<small>/${fmt(o.of)}</small>` : ""}</div>${o.side ? "" : o.mini || ""}<div class="stat-sub">${o.sub || ""}</div>${o.side ? `</div>${o.side}` : ""}
    </div>`;
  const ago = d => {
    if (!d) return "";
    const days = Math.round((Date.parse(today()) - Date.parse(String(d).slice(0, 10))) / 864e5);
    return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : prettyDate(String(d).slice(0, 10));
  };
  function activity(limit) {
    const ev = [];
    state.submissions.forEach(s => historyOf(s).forEach(h => ev.push({ at: h.at, what: h.what, title: s.title, who: h.who, kind: /^Verified/.test(h.what) ? "ok" : /^Returned/.test(h.what) ? "bad" : "wait" })));
    state.decisions.forEach(d => ev.push({ at: d.date, what: "Decision recorded", title: d.title, who: d.owner, kind: "dec" }));
    state.voices.forEach(v => ev.push({ at: v.added, what: "New voice", title: `${v.role}, ${v.county}`, who: "", kind: "voice" }));
    return ev.filter(e => e.at).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
  }

  function dashData() {
    const ns = northStarNow(), m = innovated(), f = fellowship(), e = events(), tb = testbed(), t = trust(), pr = prompts(), tr = teacherReport();
    const learners = sum(C.SCHOOLS, s => s.learners), estLearners = m ? Math.round(m.users * 45 / 100) * 100 : 0;
    const matched = ns ? ns.schools : [];
    const termsWith = C.TERMS.filter(x => matched.length && northStar(x.id, matched).schools.length === matched.length);
    const series = C.NORTH_STAR.map(o => ({ key: o.key, letter: o.letter, name: o.name, color: NS_COLOR[o.key], vals: termsWith.map(x => northStar(x.id, matched).values.find(v => v.key === o.key).value) }));
    return { ns, m, f, e, tb, t, pr, tr, learners, estLearners, matched, termsWith, series, fp: footprint() };
  }

  /* ---------- dashboard cards ---------- */
  const DC = {
    north: (D, span) => D.ns ? card({ id: "north", span, cls: "kid-card", title: "How whole are the children we reach?", link: "#/programs/schools",
      meta: `${termLabel(D.ns.term)} · ${D.ns.schools.length} schools · ${D.ns.lessons} lessons observed`, cap: CAP.north, sig: D.ns.values.map(v => Math.round(v.value)).join(","),
      body: nsKids(D.ns, "#/programs/schools") }) : "",
    progress: (D, span) => card({ id: "progress", span, title: "Term by term", link: "#/programs/schools", meta: `Same ${D.matched.length} schools, ${D.termsWith.length} terms`, cap: CAP.progress, sig: D.series.map(s => s.vals.map(Math.round).join("-")).join(","),
      body: D.termsWith.length > 1 ? progressRows(D.series, D.termsWith.map(x => x.label.replace(", 2026", "")), { targets: { agency: C.TARGETS.agency }, label: "How each North Star outcome moved by term" }) + dataTable(["Outcome", ...D.termsWith.map(x => x.label)], D.series.map(sr => [sr.name, ...sr.vals.map(v => Math.round(v) + "%")])) : empty("Trends appear once two terms are verified.") }),
    funnel: (D, span) => D.m ? card({ id: "funnel", span, title: "From training to the classroom", link: "#/programs/innovated", meta: `Per 100 teachers registered · ${termLabel(D.m.term)}`, cap: CAP.funnel, sig: `${Math.round(D.m.metis.per100)}-${Math.round(D.m.partner.per100)}`,
      body: funnelSVG([["Metis-led", D.m.metis, "var(--teal)"], ["Partner-led", D.m.partner, "var(--orange)"]].map(([name, a, color]) => ({ name, color, stages: [
        { label: "Registered", value: 100, note: `${fmt(a.useRegistered)} teachers` },
        { label: "Completed", value: a.useCompleted / a.useRegistered * 100, note: `${fmt(a.useCompleted)} teachers` },
        { label: "Using at 8 weeks", value: a.per100, note: `about ${fmt(a.users)} teachers` }] }))) +
        dataTable(["Delivery", "Registered", "Completed", "Using at 8 weeks"], [["Metis-led", D.m.metis], ["Partner-led", D.m.partner]].map(([n, a]) => [n, `100 (${fmt(a.useRegistered)} teachers)`, `${Math.round(a.useCompleted / a.useRegistered * 100)} (${fmt(a.useCompleted)})`, `${Math.round(a.per100)} (about ${fmt(a.users)})`])) }) : "",
    cost: (D, span) => D.m ? card({ id: "cost", span, title: "Cost against results", link: "#/programs/innovated", meta: "Each bubble is a site · size = teachers registered", cap: CAP.cost, sig: Math.round(D.m.costPerActive),
      body: bubbleSVG(D.m.useI) + `<div class="lg">${swatch("var(--teal)", "Metis-led")}${swatch("var(--orange)", "Partner-led")}</div>` + dataTable(["Site", "County", "Delivered by", "Registered", "Using at 8 weeks", "KES per teacher using"], D.m.useI.map(x => [x.row.site, x.row.county, x.row.delivered_by, x.row.registered, x.row.using_pct + "%", fmt(x.row.cost_per_completer / (x.row.using_pct / 100))])) }) : "",
    map: (D, span) => card({ id: "map", span, title: "Where we work", meta: `${Object.keys(D.fp).length} counties · tap one`, cap: CAP.map, sig: Object.entries(D.fp).map(([c, v]) => c + (v.teachers + v.learners + v.fellows)).join(","), body: countyMap(D.fp) }),
    heat: (D, span) => card({ id: "heat", span, title: "School by school", link: "#/programs/schools", meta: "Latest verified term per school", cap: CAP.heat, sig: latestSchoolObs().map(x => x.found ? x.found.term : "").join(","),
      body: `<div class="table-wrap"><table class="heat compact"><thead><tr><th>School</th>${C.NORTH_STAR.map(o => `<th>${nsKid(o.key, o.name)}</th>`).join("")}</tr></thead><tbody>
        ${latestSchoolObs().map(({ s, found, waiting }) => `<tr><th scope="row">${esc(s.label.replace("Partner ", ""))}<span class="small muted"> · ${esc(s.county)}${found && D.ns && found.term !== D.ns.term ? ` · ${termLabel(found.term).replace(", 2026", "")}` : ""}</span>${waiting && can.review() ? ` ${chip("wait", "New data waiting")}` : ""}</th>
          ${C.NORTH_STAR.map(o => { const v = found ? +found.row[o.key + "_pct"] : NaN; return `<td class="cell" style="background:${isFinite(v) ? heatColor(v) : "transparent"}" tabindex="0" data-tip="${esc(`${s.label}, ${o.name}: ${isFinite(v) ? v + "%" : "no data"}`)}">${isFinite(v) ? v : "n/a"}</td>`; }).join("")}</tr>`).join("")}
        </tbody></table></div>` }),
    waffle: (D, span) => { const f = D.f, order = { "On track": 0, "Needs support": 1, "Re-sprint": 2 }, cl = { "On track": ["ok", "✓"], "Needs support": ["warn", "!"], "Re-sprint": ["bad", "↺"] };
      return card({ id: "waffle", span, title: "The Fellowship cohort", link: "#/programs/fellowship", meta: `${f.n} Fellows · ${termLabel(f.term)}`, cap: CAP.waffle, sig: f.status.map(s => s[1]).join("-"),
        body: `<div class="wf" role="img" aria-label="${esc(f.status.map(s => `${s[1]} ${s[0]}`).join(", "))}">${[...f.rows].sort((a, b) => order[a.status] - order[b.status]).map((r, i) => `<span class="wf-cell wf-${cl[r.status][0]}" style="--i:${i}" tabindex="0" data-tip="${esc(`${r.fellow}: ${r.status}, ${r.org_type}, ${r.county}`)}">${cl[r.status][1]}</span>`).join("")}</div>
          <div class="lg">${f.status.map(s => `<span class="lg-item"><span class="wf-key wf-${cl[s[0]][0]}">${cl[s[0]][1]}</span>${esc(s[0])} <strong>${s[1]}</strong></span>`).join("")}</div>` }); },
    guskey: (D, span) => card({ id: "guskey", span, title: "From reaction to learners", link: "#/programs/fellowship", meta: "Fellows reaching each Guskey level", cap: CAP.guskey, sig: [D.f.relevant, D.f.m2, D.f.sponsor, D.f.led, D.f.learner].join("-"),
      body: staircase([{ label: "sessions feel relevant", short: "Reaction", value: D.f.relevant }, { label: "Milestone 2 met", short: "Learning", value: D.f.m2 }, { label: "sponsor actively supporting", short: "Support", value: D.f.sponsor }, { label: "led a full design test", short: "Use", value: D.f.led }, { label: "collecting learner evidence", short: "Learners", value: D.f.learner }], D.f.n) }),
    feedback: (D, span) => card({ id: "feedback", span, title: "Feedback turnaround", link: "#/programs/fellowship", meta: "Median days · target 5", cap: CAP.feedback, sig: D.f.fbNow ? D.f.fbNow.median_days : "",
      body: D.f.feedback.length ? `<div class="bullet-wrap"><div class="bullet-big"><span>${num(+D.f.fbNow.median_days, "dec")}</span> days</div>${bullet(D.f.feedback, 5, 12)}</div>` : empty("No feedback data yet.") }),
    events: (D, span) => { const e = D.e, per = 5;
      return card({ id: "events", span, title: "Who comes to Knowledge Sharing", link: "#/programs/events", meta: `${fmt(e.attendees)} people · ${e.rows.length} events · each dot is ${per} people`, cap: CAP.events, sig: `${e.attendees}-${e.followed}`,
        body: e.rows.length ? `<div class="picto-wrap"><div class="picto">${e.groups.map(gp => { const v = sum(e.rows, r => +r[gp[0]]), full = Math.floor(v / per), part = v % per >= per / 2; return `<div class="picto-row" tabindex="0" data-tip="${esc(`${gp[1]}: ${v} people across ${e.rows.length} events`)}"><span class="picto-label">${esc(gp[1])}</span><span class="picto-dots">${Array.from({ length: full }, (_, i) => `<i style="--i:${i}"></i>`).join("")}${part ? `<i class="half" style="--i:${full}"></i>` : ""}</span><span class="picto-n">${v}</span></div>`; }).join("")}</div>
          <div class="picto-side">${ring(e.followed / e.made, 96, 11, "Commitments followed up")}<div class="small">commitments followed up</div></div></div>` : empty("No verified event data yet.") }); },
    ladder: (D, span) => { const pilots = [...D.tb.verified, ...(can.review() ? D.tb.pending : [])];
      return card({ id: "ladder", span, title: "EdTech evidence ladder", link: "#/programs/testbed", meta: "Dot size = learners reached", cap: CAP.ladder, sig: pilots.map(p => p.stage + p.status).join(","), body: pilots.length ? ladderSVG(pilots) : empty("No pilots yet.") }); },
    teachers: (D, span) => D.tr.n ? card({ id: "teachers", span, title: "What teachers report", link: "#/programs/innovated", meta: `${D.tr.n} verified check-ins · ${termLabel(D.tr.term)}`, cap: CAP.teachers, sig: `${D.tr.n}-${D.tr.recent}`, body: teacherPanel(D.tr) }) : "",
    decisions: (D, span) => { const due = state.decisions.filter(isDue).length;
      return card({ id: "decisions", span, title: "Needs a decision", link: "#/decide", meta: "From rules agreed in advance", cap: CAP.decisions, sig: `${due}-${D.pr.list.length}`,
        body: `${due ? `<a class="prompt-mini" href="#/decide"><span class="sev decide">Due</span>${due} decision${due > 1 ? "s" : ""} due for another look</a>` : ""}${D.pr.list.slice(0, 4).map(p => `<a class="prompt-mini" href="#/decide"><span class="sev ${p.sev}">${p.sev === "decide" ? "Decide" : "Watch"}</span>${esc(p.title)}</a>`).join("")}` }); },
    voice: (D, span) => { const voice = state.voices.filter(v => v.consent); const spot = voice.length ? voice[new Date().getDate() % voice.length] : null;
      return spot ? card({ id: "voice", span, title: "In their words", link: "#/voices", cap: CAP.voice, sig: spot.id,
        body: `<figure class="spot"><blockquote>${esc(spot.text)}</blockquote><figcaption>${esc(spot.role)} · ${esc(spot.county)} <span class="voice-tags">${spot.tags.filter(t => KID_ARMS[t]).map(t => `<span class="voice-kid" style="--c:${NS_COLOR[t]}" title="${esc(C.NORTH_STAR.find(n => n.key === t).name)}">${kid(t, true)}</span>`).join("")}</span></figcaption></figure>` }) : ""; },
    activity: (D, span) => { const ev = activity(7);
      return card({ id: "activity", span, cls: "activity-card", title: `<span class="live-dot"></span>Just in`, meta: "Latest data, reviews and decisions", cap: CAP.activity, sig: ev.length ? ev[0].at + ev[0].what : "",
        body: `<ol class="feed">${ev.map(x => `<li class="feed-${x.kind}"><span class="feed-dot"></span><div><strong>${esc(x.what)}</strong> <span class="muted">${esc(x.title)}</span><div class="small muted">${esc(ago(x.at))}${x.who ? ` · ${esc(x.who)}` : ""}</div></div></li>`).join("")}</ol>` }); },
    todo: (D, span) => { const items = [];
      state.submissions.filter(s => s.status === "returned").forEach(s => items.push(["bad", `Fix and resubmit: ${s.title}`, "#/review", "Open"]));
      if (D.t.pending) items.push(["wait", `${D.t.pending} submission${D.t.pending > 1 ? "s" : ""} waiting for M&E review`, "#/review", "See"]);
      if (D.e.rows.length < 3) items.push(["warn", "Add attendance for KSE Term 3: Fellows showcase", "#/add", "Add", "event_attendance"]);
      const sup = D.f.status.filter(s => s[0] !== "On track").reduce((a, s) => a + s[1], 0);
      if (sup) items.push(["warn", `${sup} Fellows need support or are re-sprinting`, "#/programs/fellowship", "See"]);
      if (D.tr.n) { const v = D.tr.support.filter(x => ["Coaching visit", "Help with the tool"].includes(x[0])).reduce((a, x) => a + x[1], 0); if (v) items.push(["wait", `Plan support for ${v} teachers who asked in check-ins`, "#/programs/innovated", "See"]); }
      return card({ id: "todo", span, title: "Your list this week", cap: CAP.todo, sig: items.length,
        body: `<ul class="todo">${items.map(i => `<li class="todo-${i[0]}"><span class="todo-box" aria-hidden="true"></span><span>${esc(i[1])}</span><a class="btn small" href="${i[2]}"${i[4] ? ` data-action="pick-ds-link" data-ds="${i[4]}"` : ""}>${i[3]}</a></li>`).join("") || "<li>Nothing waiting. Lovely.</li>"}</ul>` }); },
    queue: (D, span) => { const q = pending();
      return card({ id: "queue", span, title: "Waiting for review", link: "#/review", meta: `${q.length} submission${q.length === 1 ? "" : "s"}`, cap: CAP.queue, sig: q.map(s => s.id + s.rows.length).join(","),
        body: q.length ? `<ul class="queue">${q.map(s => { const res = checkRows(s.dataset, s.rows), fail = res.filter(r => r.level === "fail").length, flag = res.filter(r => r.level === "flag").length; return `<li><div><strong>${esc(s.title)}</strong><div class="small muted">${esc(C.PROGRAMS.find(p => p.id === C.DATASETS[s.dataset].program).short)} · ${s.rows.length} row${s.rows.length === 1 ? "" : "s"} · ${esc(ago(s.submittedAt))}</div></div><div class="check-sum">${chip("ok", (s.rows.length - fail - flag) + " passed")}${flag ? chip("warn", flag + " flagged") : ""}${fail ? chip("bad", fail + " failing") : ""}</div><button class="btn small primary" data-action="open-review" data-id="${esc(s.id)}">Review</button></li>`; }).join("")}</ul>` : empty("Nothing waiting. Every submission has been reviewed.") }); },
    held: (D, span) => { const rows = [];
      state.submissions.filter(s => s.status === "verified").forEach(s => checkRows(s.dataset, s.rows).forEach((r, i) => { if (r.exclRow || r.exclUse || r.level === "flag") rows.push([s, s.rows[i], r]); }));
      return card({ id: "held", span, title: "Held back or flagged", link: "#/review", meta: `${rows.length} rows in verified data`, cap: CAP.held, sig: rows.length,
        body: `<ul class="held">${rows.slice(0, 8).map(([s, row, r]) => { const cl = checkLabel(r); return `<li>${chip(cl.cls, cl.text)}<div><strong>${esc(row.site || row.school || row.fellow || row.event || row.pilot || "")}</strong> <span class="muted small">${esc(C.DATASETS[s.dataset].label)}</span><div class="small">${esc(r.issues.map(x => x.msg).join(". "))}</div></div></li>`; }).join("")}</ul>` }); },
    fresh: (D, span) => { const items = Object.entries(C.DATASETS).map(([k, d]) => { const v = subsOf(k, "verified").map(s => s.reviewedAt || s.submittedAt).sort().pop(); const days = v ? Math.max(0, Math.round((Date.parse(today()) - Date.parse(v)) / 864e5)) : 99; return { label: d.label, value: Math.min(days, 90), text: v ? `${days} days` : "none yet", cls: days > 45 ? "warn-fill" : "", tip: `${d.label}: last verified ${v ? prettyDate(v) : "never"}` }; }).sort((a, b) => b.value - a.value);
      return card({ id: "fresh", span, title: "How fresh is each dataset?", meta: "Days since last verified · amber after 45", cap: CAP.fresh, sig: items.map(i => i.text).join(","), body: bars(items, { max: 90 }) }); },
    checks: (D, span) => { const t = D.t, pass = t.rows - t.held - t.flagged;
      return card({ id: "checks", span, title: "What the checks found", meta: `${fmt(t.rows)} rows checked`, cap: CAP.checks, sig: `${pass}-${t.flagged}-${t.held}`,
        body: `<div class="stack-bar" role="img" aria-label="${pass} passed, ${t.flagged} flagged, ${t.held} held back"><span class="sb-ok" style="flex:${pass}" data-tip="${pass} rows passed every check" tabindex="0"></span>${t.flagged ? `<span class="sb-warn" style="flex:${t.flagged}" data-tip="${t.flagged} rows flagged: counted, with a caution" tabindex="0"></span>` : ""}${t.held ? `<span class="sb-bad" style="flex:${t.held}" data-tip="${t.held} rows held back from the figures they affect" tabindex="0"></span>` : ""}</div>
          <div class="lg">${swatch("var(--teal)", `✓ Passed ${pass}`)}${swatch("#fab219", `! Flagged ${t.flagged}`)}${swatch("#ec835a", `✕ Held back ${t.held}`)}</div>
          <div class="trust-big">${num(t.rows ? pass / t.rows * 100 : 0, "pct")}<span>of rows clean on arrival</span></div>` }); },
    hello: (D, span) => card({ id: "hello", span, cls: "hello-card", title: "Your fortnightly check-in", cap: CAP.hello, sig: state.myCheckins || 0,
      body: `<div class="hello"><div class="hello-kids" aria-hidden="true">${C.NORTH_STAR.map((o, i) => `<span style="--c:${NS_COLOR[o.key]};--i:${i}">${kid(o.key, true)}</span>`).join("")}</div>
        <div><p class="hello-lead">Two minutes, in English or Kiswahili. No learner is ever named.</p><p class="small muted">${state.myCheckins ? `You've sent ${state.myCheckins} check-in${state.myCheckins > 1 ? "s" : ""} from this device${state.myLastCheckin ? `, the last one ${ago(state.myLastCheckin)}` : ""}.` : "You haven't sent a check-in from this device yet."}</p>
        <a class="btn primary big" href="#/checkin">Send a check-in</a></div></div>` }),
    teacherKids: (D, span) => D.tr.n ? card({ id: "tkids", span, cls: "kid-card", title: "What teachers are seeing", meta: `${D.tr.n} classrooms checked in · ${termLabel(D.tr.term)}`, cap: CAP.teachers, sig: D.tr.outcomes.map(x => x[1]).join("-"),
      body: childRows(D.tr.outcomes.map(([o, v]) => ({ key: o.key, name: o.name, color: NS_COLOR[o.key], value: v / D.tr.n * 100 })), { label: "Outcomes teachers saw this week", unit: "a classroom where teachers saw it this week, out of 10", tip: it => `seen in ${Math.round(it.value)}% of classrooms that checked in` }) }) : "",
    time: (D, span) => D.tr.n ? card({ id: "time", span, title: "Time given back", meta: "From teachers using the tool", cap: CAP.time, sig: `${D.tr.minutes}-${D.tr.recent}`,
      body: `<div class="time-card"><div class="time-big">${num(Math.round(D.tr.minutes || 0))}<span>minutes a week, median</span></div>${ring(D.tr.recent / D.tr.n, 104, 12, "Teachers who used the tool this week or last")}<div class="small muted">used the tool this week or last</div></div>` }) : "",
    ideas: (D, span) => { const ideas = D.tr.rows.filter(r => String(r.what_worked || "").trim()).slice(-5).reverse();
      return card({ id: "ideas", span, title: "Ideas from other teachers", cap: CAP.ideas, sig: ideas.length,
        body: `<ul class="ideas">${ideas.map(r => `<li><span class="idea-q">“</span><div><strong>${esc(r.what_worked)}</strong><div class="small muted">${esc(r.grade_band)} · ${esc(r.county)}</div></div></li>`).join("")}</ul>` }); },
    support: (D, span) => D.tr.n ? card({ id: "support", span, title: "Support teachers asked for", meta: `${D.tr.n} check-ins`, cap: "Ask, and a coach will answer within a week.", sig: D.tr.support.map(x => x[1]).join("-"),
      body: bars(D.tr.support.filter(x => x[0] !== "None right now").map(([k, v]) => ({ label: k, value: v, text: String(v), cls: "slate-fill" })), { max: D.tr.n }) }) : "",
    report: (D, span) => card({ id: "report", span, cls: "report-card", title: "Your partner report", cap: CAP.report, sig: "report",
      body: `<p class="hello-lead">Verified results, the sentences behind them and the voices that bring them to life, ready to print or download.</p><a class="btn primary big" href="#/report">Open the partner report</a>` })
  };

  /* Two shorter cards stacked in one column, so a tall card (the map) has a partner of the same height. */
  const stack = (span, ...cards) => `<div class="dstack span-${span}">${cards.join("")}</div>`;
  const ROLE_DASH = {
    lead: { eyebrow: "Leadership view", title: "Whole Child Learning at a glance",
      tiles: D => [
        { id: "learners", label: "Learners reached", value: D.learners, sub: `+ about ${fmt(D.estLearners)} through InnovatED (estimate)`, mini: `<div class="mini-stack"><span class="solid" style="flex:${D.learners}"></span><span class="est" style="flex:${D.estLearners || 1}"></span></div>` },
        { id: "users", label: "Teachers using tools", value: D.m ? Math.round(D.m.users) : NaN, sub: `of ${D.m ? fmt(D.m.useCompleted) : 0} trained · target ${pct(C.TARGETS.use8)}`, side: D.m ? ring(D.m.usePct, 64, 8, "Share of trained teachers using the tool") : "" },
        { id: "led", label: "Fellows who led a full test", value: D.f.led, of: D.f.n, sub: "Guskey level 4: practice", mini: `<div class="mini-dots" aria-hidden="true">${D.f.rows.map(r => `<i class="${r.led_full_test === "Yes" ? "on" : ""}"></i>`).join("")}</div>` },
        { id: "commit", label: "Event commitments kept", value: D.e.made ? D.e.followed / D.e.made * 100 : NaN, fmt: "pct", sub: `target ${pct(C.TARGETS.commitments)}`, mini: `<div class="mini-cols">${D.e.rows.map((r, i) => `<div class="mini-col"><span style="height:${Math.round(r.commitments_followed / r.commitments_made * 40)}px"></span>KSE ${i + 1}</div>`).join("")}</div>` },
        { id: "cpa", label: "Cost per teacher using", value: D.m ? D.m.costPerActive : NaN, fmt: "kes", sub: `target ${kes(C.TARGETS.costPerActive)} or less`, mini: D.m ? `<div class="target-bar"><span style="width:${Math.min(100, D.m.costPerActive / 12000 * 100)}%"></span><i style="left:${C.TARGETS.costPerActive / 12000 * 100}%"></i></div>` : "" }],
      cards: D => [DC.north(D, 7), DC.progress(D, 5), DC.funnel(D, 6), DC.cost(D, 6), DC.map(D, 6), stack(6, DC.heat(D, 12), DC.feedback(D, 12)), DC.waffle(D, 6), DC.guskey(D, 6), DC.teachers(D, 12), DC.decisions(D, 6), DC.activity(D, 6), DC.events(D, 6), DC.ladder(D, 6)] },
    staff: { eyebrow: "Programme view", title: "This week across our programmes",
      tiles: D => { const ret = state.submissions.filter(s => s.status === "returned").length, tc = sum(state.submissions.filter(s => s.dataset === "teacher_checkin" && s.term === CURRENT_TERM), s => s.rows.length), sup = D.f.status.filter(s => s[0] !== "On track").reduce((a, s) => a + s[1], 0);
        return [
          { id: "pend", label: "Awaiting review", value: D.t.pending, sub: "submissions with M&E" },
          { id: "ret", label: "Returned to fix", value: ret, sub: ret ? "open the review page" : "nothing returned" },
          { id: "tc", label: "Teacher check-ins", value: tc, sub: termLabel(CURRENT_TERM) },
          { id: "sup", label: "Fellows needing support", value: sup, of: D.f.n, sub: "needs support or re-sprint" },
          { id: "fb", label: "Feedback turnaround", value: D.f.fbNow ? +D.f.fbNow.median_days : NaN, fmt: "dec", sub: "days, median · target 5" }]; },
      cards: D => [DC.todo(D, 6), DC.activity(D, 6), DC.teachers(D, 12), DC.waffle(D, 6), DC.guskey(D, 6), DC.map(D, 6), stack(6, DC.north(D, 12), DC.feedback(D, 12)), DC.events(D, 6), DC.ladder(D, 6)] },
    me: { eyebrow: "Data trust view", title: "Is our data ready to share?",
      tiles: D => { const q = pending(), oldest = q.length ? Math.max(...q.map(s => Math.round((Date.parse(today()) - Date.parse(s.submittedAt)) / 864e5))) : 0;
        return [
          { id: "ver", label: "Submissions verified", value: D.t.verified, of: D.t.total, sub: "only verified data counts", mini: `<div class="seg-bar"><span class="v" style="flex:${D.t.verified}"></span>${D.t.pending ? `<span class="w" style="flex:${D.t.pending}"></span>` : ""}${D.t.returned ? `<span class="r" style="flex:${D.t.returned}"></span>` : ""}</div>` },
          { id: "pend", label: "Awaiting review", value: D.t.pending, sub: "target: within 3 days" },
          { id: "old", label: "Oldest waiting", value: oldest, sub: "days" },
          { id: "held", label: "Rows held back", value: D.t.held, sub: "out of the figures they affect" },
          { id: "flag", label: "Rows flagged", value: D.t.flagged, sub: "counted, with a caution" }]; },
      cards: D => [DC.queue(D, 7), DC.checks(D, 5), DC.held(D, 6), DC.fresh(D, 6), DC.activity(D, 5), DC.progress(D, 7)] },
    teacher: { eyebrow: "My classroom", title: "Karibu, mwalimu. Here's what we're learning together.",
      tiles: D => [
        { id: "mine", label: "Your check-ins", value: state.myCheckins || 0, sub: "sent from this device" },
        { id: "tc", label: "Teachers checking in", value: D.tr.n, sub: termLabel(D.tr.term || CURRENT_TERM) },
        { id: "min", label: "Time saved, median", value: Math.round(D.tr.minutes || 0), sub: "minutes a week" },
        { id: "recent", label: "Used the tool lately", value: D.tr.n ? D.tr.recent / D.tr.n * 100 : NaN, fmt: "pct", sub: "this week or last" }],
      cards: D => [DC.hello(D, 12), DC.teacherKids(D, 7), DC.time(D, 5), DC.ideas(D, 6), DC.support(D, 6), DC.voice(D, 12)] },
    partner: { eyebrow: "Partner view", title: "What our partnership is making possible",
      tiles: D => [
        { id: "learners", label: "Learners reached", value: D.learners, sub: `+ about ${fmt(D.estLearners)} through InnovatED (estimate)` },
        { id: "users", label: "Teachers using tools", value: D.m ? Math.round(D.m.users) : NaN, sub: "eight weeks after training", side: D.m ? ring(D.m.usePct, 64, 8, "Share of trained teachers using the tool") : "" },
        { id: "counties", label: "Counties", value: Object.keys(D.fp).length, sub: "with Metis activity" },
        { id: "fellows", label: "Fellows", value: D.f.n, sub: "designing for the whole child" },
        { id: "commit", label: "Event commitments kept", value: D.e.made ? D.e.followed / D.e.made * 100 : NaN, fmt: "pct", sub: "followed up within a term" }],
      cards: D => [DC.north(D, 7), DC.progress(D, 5), DC.map(D, 6), stack(6, DC.teacherKids(D, 12), DC.voice(D, 12)), DC.events(D, 6), DC.ladder(D, 6), DC.report(D, 12)] }
  };

  /* One Metis photo and a short intro per role: who the page is for and what they'll find. Photos: metiscollective.org. */
  const ROLE_INTRO = {
    lead: { alt: "Educators with their arms raised at Metis's Reimagined 2023 education summit",
      intro: "For the Programs Manager and Director. Everything Metis runs, from the Fellowship to InnovatED, comes back to one question: are the children we reach thriving? Start with the children, see what needs a decision, then open any programme.",
      points: ["The children first, as five North Star outcomes", "Cost, reach and quality side by side", "Decisions due under rules we agreed"] },
    staff: { alt: "Coaches and Fellows in Further Together shirts talking outdoors at a Metis Fellowship session",
      intro: "For Lead Coaches, the Codifier and Associates. Your list for the week comes first: what to fix, what to add and who needs support. Below it sit the Fellowship, teacher check-ins and events as they stand today.",
      points: ["Your to-do list for the week", "Fellows and teachers who need support", "Events and pilots as they stand"] },
    me: { alt: "Two educators checking information on their phones during a Metis session",
      intro: "For the M&E team. Nothing reaches a dashboard or a partner until you've checked it. Here's what's waiting, what the automatic checks caught, and which datasets are getting stale.",
      points: ["Submissions waiting for review", "What the checks caught", "Datasets going stale"] },
    teacher: { alt: "Teachers working on laptops during InnovatED training at Amal Labs",
      intro: "For teachers using InnovatED tools. Two minutes every fortnight tells us how the tools work in your class. In return, you see what teachers across Kenya are noticing, and ideas you can borrow on Monday morning.",
      points: ["A two-minute check-in, in English or Kiswahili", "What other teachers are seeing", "Ideas to borrow on Monday"] },
    partner: { alt: "Educators at a Metis event holding signs that read I am inspired, I am motivated and I am loved",
      intro: "For funders and partners. Every number here has been checked by our M&E team and carries its source. The children come first, then the teachers and leaders making the change, then the stories behind the numbers.",
      points: ["Checked results, each with its source", "The people behind the numbers", "A report to print or download"] }
  };
  const ABOUT_KEY = "metis-wcl-about-hidden";
  const aboutHidden = () => { try { return localStorage.getItem(ABOUT_KEY) === "1"; } catch (e) { return false; } };
  const WHY = [
    ["letter", "m", "Built the METIS Way", "The menu follows our own design process: make meaning, empathize, tackle, iterate, share."],
    ["kid", "agency", "The whole child, not a test score", "Agency, belonging, creativity, delight and expertise: the North Star we hold ourselves to."],
    ["kid", "belonging", "Proximate leaders, proximate data", "Fellows, coaches and teachers report from the field, on a phone, in English or Kiswahili."],
    ["kid", "expertise", "Honest by design", "Nothing counts until M&E has checked it, and partners only ever see verified results."]
  ];
  function aboutBand() {
    if (aboutHidden()) return "";
    return `<section class="about-band" aria-labelledby="about-h">
      <button class="ab-hide" data-action="about-toggle" aria-label="Hide the introduction to this portal">Hide</button>
      <div class="ab-hook"><div class="eyebrow">About this portal</div>
        <h2 id="about-h">Four million learners. One question: are they thriving?</h2>
        <p>This is where Metis's work comes together: the leaders we equip, the teachers they train and the children in their classrooms, in one live picture measured against the outcomes we care about most.</p></div>
      <ul class="ab-why">${WHY.map(([t, k, h, s]) => `<li><span class="ab-icon${t === "letter" ? " letter" : ""}"${t === "kid" ? ` style="--c:${NS_COLOR[k]}"` : ""}>${t === "letter" ? k : kid(k, true)}</span><div><strong>${esc(h)}</strong><span>${esc(s)}</span></div></li>`).join("")}</ul>
      <div class="ab-stats">${[[4e6, "m", "learners impacted"], [160, "int", "Fellows equipped"], [47, "int", "counties reached"], [1500, "int", "stakeholders convened"]].map(([v, f, l]) => `<div class="ab-stat"><b>${num(v, f)}</b><span>${l}</span></div>`).join("")}
        <p class="ab-src">Metis to date, from metiscollective.org. The dashboard below uses fictional sample data.</p></div>
    </section>`;
  }

  function viewOverview() {
    const D = dashData(), R = ROLE_DASH[state.role] || ROLE_DASH.lead, I = ROLE_INTRO[state.role] || ROLE_INTRO.lead;
    const pendingNote = D.t.pending && can.review() ? `<p class="note">${chip("wait", "Awaiting review")} ${D.t.pending} submission${D.t.pending > 1 ? "s" : ""} not counted yet · <a href="#/review">Review</a></p>` : "";
    return `<header class="role-hero">
        <img class="rh-bg" src="assets/img/photos/${state.role}.webp" alt="${esc(I.alt)}">
        <span class="rh-credit">Photo: Metis</span>
        <div class="rh-text"><div class="eyebrow">${R.eyebrow}</div><h1>${esc(R.title)}</h1>
          <p class="rh-intro">${esc(I.intro)}</p>
          <ul class="rh-points">${I.points.map((p, i) => `<li style="--c:${NS_COLOR[C.NORTH_STAR[i % 5].key]}">${kid(C.NORTH_STAR[i % 5].key, true)}${esc(p)}</li>`).join("")}</ul>
          <div class="rh-foot">${pendingNote}${aboutHidden() ? `<button class="pill" data-action="about-toggle">About this portal</button>` : ""}</div></div>
      </header>
      ${aboutBand()}
      <div class="dash-kpis">${R.tiles(D).map(tile).join("")}</div>
      <div class="dash">${R.cards(D).join("")}</div>`;
  }

  /* Live touches: count-up numbers and a pulse on cards whose data changed since this tab last showed them. */
  const lastSig = {};
  function liveTouches(root) {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll("[data-card]").forEach(el => {
      const id = el.getAttribute("data-card"), sig = el.getAttribute("data-sig");
      if (lastSig[id] != null && lastSig[id] !== sig) { el.classList.add("updated"); setTimeout(() => el.classList.remove("updated"), 4200); }
      lastSig[id] = sig;
    });
    if (reduce) return;
    root.querySelectorAll("[data-count]").forEach(el => {
      const to = Number(el.getAttribute("data-count")), f = el.getAttribute("data-fmt") || "int";
      if (!isFinite(to)) return;
      const out = v => numOut(v, f);
      const t0 = performance.now(), dur = 700;
      const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = out(to * e); if (k < 1) requestAnimationFrame(step); };
      el.textContent = out(0); requestAnimationFrame(step);
    });
  }

  function teacherPanel(tr) {
    const none = (tr.support.find(x => x[0] === "None right now") || [0, 0])[1];
    return `<div class="tr-grid">
      <div class="tr-col"><div class="tr-ring">${ring(tr.recent / tr.n, 96, 11, "Teachers who used the tool in the last two weeks")}<div><div class="stat-value">${tr.recent}<small>/${tr.n}</small></div><div class="small muted">used the tool this week or last · target ${pct(C.TARGETS.recentUse)}</div></div></div>
        ${tr.minutesN ? `<p class="small">Median time saved: <strong>${Math.round(tr.minutes)} minutes</strong> a week, from ${tr.minutesN} teachers who gave a figure.</p>` : ""}
        ${tr.girls + tr.boys ? `<p class="small">In their classes: <strong>${pct(tr.girls / (tr.girls + tr.boys))}</strong> girls and <strong>${fmt(tr.swd)}</strong> learners with disabilities, across ${fmt(tr.learners)} learners.</p>` : ""}</div>
      <div class="tr-col"><h3>North Star outcomes teachers saw this week</h3>${bars(tr.outcomes.map(([o, v]) => ({ label: o.name, value: v, text: `${v} of ${tr.n}` })), { max: tr.n })}</div>
      <div class="tr-col"><h3>Support they asked for</h3>${bars(tr.support.filter(x => x[0] !== "None right now").map(([k, v]) => ({ label: k, value: v, text: String(v), cls: "slate-fill" })), { max: tr.n })}<p class="small muted">${none} said they need nothing right now.</p></div>
    </div>`;
  }

  let lang = "en", lastCheckin = null;
  const L = {
    en: { title: "Teacher check-in", lede: "Two minutes, every two weeks. It helps Metis see how the tools are working in real classrooms. Please don't write any learner's name.", school: "School or training site code", county: "County", grade: "Class you teach", size: "Learners in the class", makeup: "Who is in your class? (optional)", girls: "Girls", boys: "Boys", swd: "Learners with disabilities", last: "When did you last use the InnovatED tool in a lesson?", usedFor: "What did you use it for?", minutes: "Minutes it saved you this week", outcomes: "What did your learners show this week?", worked: "One thing that worked (no names)", support: "What support would help?", send: "Send check-in", sent: "Thank you. Your check-in is saved and the M&E team will review it.", another: "Send another check-in", optional: "optional", missing: "Please fill in the school code, class size, when you last used the tool and the support you need.", names: "Please remove any names, phone numbers or email addresses from your note." },
    sw: { title: "Ripoti fupi ya mwalimu", lede: "Dakika mbili, kila wiki mbili. Inasaidia Metis kuona jinsi zana zinavyofanya kazi darasani. Tafadhali usiandike jina la mwanafunzi yeyote.", school: "Msimbo wa shule au kituo cha mafunzo", county: "Kaunti", grade: "Darasa unalofundisha", size: "Idadi ya wanafunzi darasani", makeup: "Darasa lako lina nani? (si lazima)", girls: "Wasichana", boys: "Wavulana", swd: "Wanafunzi wenye ulemavu", last: "Ulitumia lini zana ya InnovatED katika somo mara ya mwisho?", usedFor: "Uliitumia kwa nini?", minutes: "Dakika ulizookoa wiki hii", outcomes: "Wanafunzi wako walionyesha nini wiki hii?", worked: "Jambo moja lililofanikiwa (bila majina)", support: "Ungependa msaada gani?", send: "Tuma ripoti", sent: "Asante. Ripoti yako imehifadhiwa na timu ya M&E itaikagua.", another: "Tuma ripoti nyingine", optional: "si lazima", missing: "Tafadhali jaza msimbo wa shule, idadi ya wanafunzi, mara ya mwisho ulipotumia zana na msaada unaohitaji.", names: "Tafadhali ondoa majina, nambari za simu au barua pepe kwenye maelezo yako." }
  };
  const OPT_SW = { "This week": "Wiki hii", "Last week": "Wiki iliyopita", "2 to 4 weeks ago": "Wiki 2 hadi 4 zilizopita", "More than a month ago": "Zaidi ya mwezi mmoja uliopita", "Not yet": "Bado sijaitumia", "None right now": "Hakuna kwa sasa", "Coaching visit": "Ziara ya mkufunzi", "Help with the tool": "Msaada wa kutumia zana", "Peer group": "Kikundi cha walimu wenzangu", "Materials": "Vifaa vya kufundishia", "ECDE": "Elimu ya awali (ECDE)", "Grades 1 to 3": "Gredi 1 hadi 3", "Grades 4 to 6": "Gredi 4 hadi 6", "Grades 7 to 9": "Gredi 7 hadi 9", "Lesson plan": "Andalio la somo", "Scheme of work": "Maazimio ya kazi", "Assessment": "Tathmini", "Teaching strategy": "Mbinu ya kufundisha" };
  const NS_SW = { agency: "Kujiamulia", belonging: "Kuhisi kukubalika", creativity: "Ubunifu", delight: "Furaha", expertise: "Umahiri" };
  const tx = k => L[lang][k], opt = o => (lang === "sw" ? OPT_SW[o] || o : o);
  const USES = ["Lesson plan", "Scheme of work", "Assessment", "Teaching strategy"];

  function viewCheckin() {
    const tr = teacherReport();
    const codes = [...new Set([...state.submissions.filter(x => x.dataset === "innovated_sites").flatMap(x => x.rows.map(r => r.site)), ...C.SCHOOLS.map(x => x.id)])].sort();
    const choice = (name, opts, type) => `<div class="choices">${opts.map(o => `<label class="choice"><input type="${type}" name="${name}" value="${esc(o)}"><span>${esc(opt(o))}</span></label>`).join("")}</div>`;
    const done = lastCheckin ? `<section class="card checkin-done" role="status"><h2>${tx("sent")}</h2><p class="muted">${esc(lastCheckin)}</p><button class="btn" data-action="checkin-again">${tx("another")}</button></section>` : "";
    const form = `<form id="checkin-form" class="card checkin" novalidate>
      <div class="ci-grid">
        <label>${tx("school")}<input type="text" name="school" list="site-codes" autocomplete="off" placeholder="A, D, S1"><datalist id="site-codes">${codes.map(c => `<option value="${esc(c)}"></option>`).join("")}</datalist></label>
        <label>${tx("county")}<select name="county">${C.COUNTIES.map(c => `<option${c === "Nakuru" ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
        <label>${tx("grade")}<select name="grade_band">${C.GRADE_BANDS.map(g => `<option value="${esc(g)}">${esc(opt(g))}</option>`).join("")}</select></label>
        <label>${tx("size")}<input type="number" name="class_size" min="1" max="150" inputmode="numeric"></label>
      </div>
      <fieldset><legend>${tx("makeup")}</legend><div class="ci-grid three">
        <label>${tx("girls")}<input type="number" name="girls" min="0" inputmode="numeric"></label>
        <label>${tx("boys")}<input type="number" name="boys" min="0" inputmode="numeric"></label>
        <label>${tx("swd")}<input type="number" name="with_disability" min="0" inputmode="numeric"></label></div></fieldset>
      <fieldset><legend>${tx("last")}</legend>${choice("last_used", C.LAST_USED, "radio")}</fieldset>
      <fieldset><legend>${tx("usedFor")} <span class="muted">(${tx("optional")})</span></legend>${choice("used_for", USES, "checkbox")}</fieldset>
      <label class="ci-narrow">${tx("minutes")} <span class="muted">(${tx("optional")})</span><input type="number" name="minutes_saved" min="0" max="900" inputmode="numeric"></label>
      <fieldset><legend>${tx("outcomes")}</legend><div class="choices">${C.NORTH_STAR.map(o => `<label class="choice"><input type="checkbox" name="outcomes_seen" value="${o.key}"><span>${nsKid(o.key)} ${lang === "sw" ? `${NS_SW[o.key]} (${o.name})` : o.name}</span></label>`).join("")}</div></fieldset>
      <label>${tx("worked")}<textarea name="what_worked" rows="2" maxlength="200"></textarea></label>
      <fieldset><legend>${tx("support")}</legend>${choice("support", C.SUPPORT, "radio")}</fieldset>
      <div class="form-actions"><button class="btn primary big" type="submit">${tx("send")}</button><span class="form-msg" id="ci-msg" role="status"></span></div>
    </form>`;
    return `<div class="checkin-wrap">${head("i · Iterate", tx("title"), tx("lede"))}
      <div class="lang-toggle" role="group" aria-label="Language"><button class="pill${lang === "en" ? " on" : ""}" data-action="lang" data-v="en" aria-pressed="${lang === "en"}">English</button><button class="pill${lang === "sw" ? " on" : ""}" data-action="lang" data-v="sw" aria-pressed="${lang === "sw"}">Kiswahili</button></div>
      ${done || form}
      ${isTeacher() ? "" : `<p class="small muted">Staff can also enter a check-in for a teacher during a visit. Check-ins go to M&E for review like any other data.${tr.n ? ` ${tr.n} verified check-ins so far in ${termLabel(tr.term)}.` : ""}</p>`}</div>`;
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
        <div class="table-wrap"><table><thead><tr><th>Outcome</th><th>What it looks like in class</th><th>CBE link</th></tr></thead><tbody>${C.NORTH_STAR.map(o => `<tr><th scope="row">${nsKid(o.key)} ${o.name}</th><td>${esc(o.looks)}</td><td>${esc(o.cbe)}</td></tr>`).join("")}</tbody></table></div>
        <h3 id="indicators">How each indicator is measured</h3>
        <div class="table-wrap"><table><thead><tr><th>Level</th><th>Indicator</th><th>Definition</th><th>Source</th><th>How often</th><th>Target</th></tr></thead><tbody>${D.indicators.map(r => `<tr><td>${esc(r[0])}</td><th scope="row">${esc(r[1])}</th><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td></tr>`).join("")}</tbody></table></div>`) +
      stage("s", "Share", "We share our learning. How do we support others?", `
        <div class="objectives">${D.impact.map(o => `<div class="objective"><h3>${esc(o[0])}</h3><p>${esc(o[1])}</p></div>`).join("")}</div>`) +
      `<section class="card"><h2>The expert council</h2><p class="muted">Each lens set one requirement the portal had to meet.</p>
        <div class="table-wrap"><table><thead><tr><th>Lens</th><th>Requirement</th><th>How the portal meets it</th></tr></thead><tbody>${D.council.map(c => `<tr><th scope="row">${esc(c[0])}</th><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="card"><h2>Expert review, round two: gaps found and fixed</h2><p class="muted">After the first version went live, each lens reviewed it again. Every gap below is now built into the portal.</p>
        <div class="table-wrap"><table><thead><tr><th>Lens</th><th>Gap found</th><th>What changed</th></tr></thead><tbody>${D.review2.map(c => `<tr><th scope="row">${esc(c[0])}</th><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join("")}</tbody></table></div>
        <h3>Still to come</h3><ul class="ticks">${D.next.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
      <section class="card"><h2>Expert review, round three: one portal, five experiences</h2><p class="muted">The third review asked a simpler question: does each person see what they need, at a glance, the moment data arrives?</p>
        <div class="table-wrap"><table><thead><tr><th>Lens</th><th>What we saw</th><th>What changed</th></tr></thead><tbody>${D.review3.map(c => `<tr><th scope="row">${esc(c[0])}</th><td>${esc(c[1])}</td><td>${esc(c[2])}</td></tr>`).join("")}</tbody></table></div></section>`;
  }

  let voiceFilter = "all";
  function viewVoices() {
    const list = state.voices.filter(v => v.consent && (voiceFilter === "all" || v.tags.includes(voiceFilter)));
    const filters = [["all", "All voices"], ...C.NORTH_STAR.map(o => [o.key, o.name])];
    const form = can.add() ? `
      <section class="card">
        <h2>Add a voice</h2>
        <p class="muted">Use a short quote with no names. A learner's quote needs a parent or caregiver's consent and the learner's own agreement. <button class="text-link as-btn" type="button" data-action="privacy">How data is handled</button></p>
        <form id="voice-form" class="form-grid" novalidate>
          <label>Who said it<select name="role" required>${["Learner, ECDE", "Learner, Grades 1 to 3", "Learner, Grades 4 to 6", "Learner, Grades 7 to 9", "Teacher", "Caregiver", "School leader", "Fellow", "County officer"].map(r => `<option>${r}</option>`).join("")}</select></label>
          <label>County<select name="county">${C.COUNTIES.map(c => `<option${c === "Nairobi" ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label class="span-2">Quote<textarea name="text" rows="3" maxlength="280" required placeholder="What they said, in their words"></textarea></label>
          <fieldset class="span-2"><legend>North Star outcomes it shows</legend>${C.NORTH_STAR.map(o => `<label class="check"><input type="checkbox" name="tags" value="${o.key}"> ${o.name}</label>`).join("")}</fieldset>
          <label class="check span-2"><input type="checkbox" name="consent"> Consent is recorded (for a learner, from a parent or caregiver)</label>
          <label class="check span-2"><input type="checkbox" name="assent"> For a learner: they agreed to share their words</label>
          <div class="span-2 form-actions"><button class="btn primary" type="submit">Save voice</button><span class="form-msg" id="voice-msg" role="status"></span></div>
        </form>
      </section>` : "";
    return head("e · Empathize", "Voices", "What learners, teachers, caregivers and Fellows say, tagged by the North Star outcome it shows. Anonymous, and shared only with consent.") +
      `<div class="filter-row" role="group" aria-label="Filter by outcome">${filters.map(f => `<button class="pill${voiceFilter === f[0] ? " on" : ""}" data-action="voice-filter" data-v="${f[0]}" aria-pressed="${voiceFilter === f[0]}">${esc(f[1])}</button>`).join("")}</div>
      <div class="voices">${list.map(v => `<figure class="voice card"><blockquote>${esc(v.text)}</blockquote><figcaption>${esc(v.role)} · ${esc(v.county)}<span class="voice-tags">${v.tags.map(t => C.NORTH_STAR.find(n => n.key === t)).filter(Boolean).map(o => nsKid(o.key, o.name)).join("")}</span></figcaption></figure>`).join("") || empty("No voices for this outcome yet.")}</div>${form}`;
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
        <section class="card"><h2>From reaction to learners</h2><p class="muted">Guskey's five levels. The drop from organisational support to learner evidence is where coaching matters most.</p>${bars(guskey, { max: f.n })}</section>
        <section class="card"><h2>Feedback turnaround</h2><p class="muted">Median days from a Fellow's facilitation to written feedback. The line marks the five-day target.</p>
          ${bars(f.feedback.map(r => ({ label: termLabel(r.period), value: +r.median_days, text: `${r.median_days} days`, cls: +r.median_days > 5 ? "warn-fill" : "", tip: `${termLabel(r.period)}: ${r.median_days} days median across ${r.feedback_items} pieces of feedback; ${r.against_standard_pct}% written against the standard` })), { max: 10, target: 5 })}
          <p class="small muted">The facilitation standard came in at the start of Term 3.</p></section>
      </div>
      ${isPartner() ? "" : `<section class="card"><h2>Fellows</h2><p class="muted">Coded, never named. ${f.over15} of ${f.n} spent more than 15 hours last month.</p>
        <div class="fellow-grid">${f.rows.map(r => `<div class="fellow ${statusCls(r.status)}" tabindex="0" data-tip="${esc(`${r.fellow}: ${r.org_type}, ${r.county}. ${r.status}. ${r.hours} hours last month. Attendance ${r.attendance_pct}%.`)}"><span class="fellow-code">${esc(r.fellow)}</span><span class="fellow-status">${esc(r.status)}</span></div>`).join("")}</div></section>`}`;
  }

  function viewInnovated() {
    const m = innovated();
    if (!m) return programTabs("innovated") + empty("No verified InnovatED data yet.", `<a class="btn" href="#/add">Add data</a>`);
    const cmpRow = (label, a) => `<tr><th scope="row">${label}</th><td>${pct(a.completion)}</td><td>${pct(a.usePct)}</td><td>${fmt(a.per100)}</td><td>${kes(a.costPerCompleter)}</td><td>${kes(a.costPerActive)}</td></tr>`;
    const byCounty = [...new Set(m.useI.map(x => x.row.county))].map(c => { const a = innovatedAgg(m.useI.filter(x => x.row.county === c)); return { label: c, value: a.usePct * 100, text: pct(a.usePct), tip: `${c}: ${pct(a.usePct)} of ${a.useCompleted} trained teachers using the tool` }; }).sort((a, b) => b.value - a.value);
    return programTabs("innovated") + head("t · Tackle", "InnovatED", `Teacher training with AI-supported tools. ${termLabel(m.term)}, eight weeks after training. Follow-up for Term 3 training arrives eight weeks after each session.`) +
      `<div class="kpis">${kpi("Teachers registered", fmt(m.registered), `${m.sites} sites, ${m.counties} counties`)}
        ${kpi("Completed", pct(m.completion), `${fmt(m.completed)} teachers`)}
        ${kpi("Using the tool at 8 weeks", pct(m.usePct), `${m.useSites} sites with reliable follow-up · target ${pct(C.TARGETS.use8)}`)}
        ${kpi("Per teacher completed", kes(m.costPerCompleter), "total cost ÷ completers")}
        ${kpi("Per teacher using the tool", kes(m.costPerActive), `the measure we budget on · target ${kes(C.TARGETS.costPerActive)} or less`, "Cost per completer divided by the share using the tool. It counts drop-out and non-use, which cost per completer hides.")}
        ${kpi("Per learner reached (estimate)", kes(m.costPerActive / 45), "assumes a class of 45", "Cost per teacher using the tool divided by an average class of 45 learners. A rough guide, not a measured figure.")}
        ${isFinite(m.women) ? kpi("Women among completers", pct(m.women), `${m.womenSites} sites reporting`) : ""}</div>
      ${(() => { const tr = teacherReport(); return tr.n ? `<section class="card"><h2>What teachers tell us</h2><p class="muted">From teachers' own check-ins, ${termLabel(tr.term)}. Head teachers reported ${pct(m.usePct)} using the tool eight weeks after ${termLabel(m.term)} training; ${pct(tr.recent / tr.n)} of teachers checking in this term say they used it in the last two weeks. Different groups and terms, so read them side by side, not as a trend.</p>${teacherPanel(tr)}${can.add() || isTeacher() ? `<p><a class="btn" href="#/checkin">Send a teacher check-in</a></p>` : ""}</section>` : ""; })()}
      ${isPartner() ? "" : `<section class="card"><h2>Metis-led and partner-led delivery</h2>
        <div class="table-wrap"><table class="num"><thead><tr><th></th><th>Completion</th><th>Using at 8 weeks</th><th>Using, per 100 registered</th><th>Per teacher completed</th><th>Per teacher using</th></tr></thead><tbody>
          ${cmpRow("Metis-led, all sites", m.metis)}${cmpRow("Partner-led, all sites", m.partner)}
          ${m.sameCounties.length ? cmpRow(`Metis-led, ${m.sameCounties.join(" and ")}`, m.metisSame) + cmpRow(`Partner-led, ${m.sameCounties.join(" and ")}`, m.partnerSame) : ""}
        </tbody></table></div>
        <p class="small muted">The same-county rows compare like with like: counties where both models have usable data. Sites weren't randomly assigned, so treat the gap as a strong signal, not proof.</p></section>
      <section class="card"><h2>Cost per teacher completed, and per teacher actually using the tool</h2>
        <p class="legend"><span class="key s-metis"></span>Metis-led <span class="key s-partner"></span>Partner-led <span class="key hollow-key"></span>per teacher completed <span class="key solid-key"></span>per teacher using the tool (KES)</p>
        ${dumbbellSVG(m.useI)}
        <p class="small muted">Sites held back by data checks aren't shown. ${m.heldBack.map(x => `Site ${x.row.site}`).join(", ")}: see the table below.</p></section>`}
      <div class="two-col">
        <section class="card"><h2>Use at 8 weeks by county</h2>${bars(byCounty, { max: 100 })}</section>
        <section class="card"><h2>What the confidence score tells us</h2><p>Confidence on the last day sits between ${Math.min(...m.base.filter(x => +x.row.registered >= 10).map(x => +x.row.confidence))} and ${Math.max(...m.base.filter(x => +x.row.registered >= 10).map(x => +x.row.confidence))} at every site with ten or more teachers, while use at eight weeks ranges from ${Math.min(...m.useI.map(x => +x.row.using_pct))}% to ${Math.max(...m.useI.filter(x => +x.row.registered >= 10).map(x => +x.row.using_pct))}%. Teachers leave feeling ready; the drop happens in the weeks after. That's why the portal tracks use at eight weeks, not confidence.</p></section>
      </div>
      ${isPartner() ? "" : `<section class="card"><h2>Sites</h2><div class="table-wrap"><table class="num"><thead><tr><th>Site</th><th>County</th><th>Delivered by</th><th>Registered</th><th>Completed</th><th>Completion</th><th>Confidence</th><th>Using at 8 wks</th><th>Per completer</th><th>Checks</th></tr></thead><tbody>
        ${m.items.map(x => { const r = x.row, cl = checkLabel(x.res); return `<tr><th scope="row">${esc(r.site)}</th><td>${esc(r.county)}</td><td>${esc(r.delivered_by)}</td><td>${r.registered}</td><td>${r.completed}</td><td>${r.registered ? pct(r.completed / r.registered) : "n/a"}</td><td>${r.confidence}</td><td>${r.using_pct === "" ? "not recorded" : r.using_pct + "%"}</td><td>${fmt(r.cost_per_completer)}</td><td>${chip(cl.cls, cl.text, x.res.issues.map(i => i.msg).join(". ") || "All checks passed")}</td></tr>`; }).join("")}
      </tbody></table></div></section>`}`;
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
    const matchedTerms = C.TERMS.filter(x => matched.length && northStar(x.id, matched).schools.length === matched.length);
    const trendSeries = C.NORTH_STAR.map(o => ({ key: o.key, letter: o.letter, name: o.name, color: NS_COLOR[o.key], vals: matchedTerms.map(x => northStar(x.id, matched).values.find(v => v.key === o.key).value) }));
    const learners = sum(C.SCHOOLS, s => s.learners);
    return programTabs("schools") + head("t · Tackle", "Whole Child Schools", `Six school design teams making whole child learning part of everyday practice. ${fmt(learners)} learners.`) +
      `<div class="kpis">${kpi("Partner schools", C.SCHOOLS.length, C.STAGES.map(st => `${C.SCHOOLS.filter(x => x.stage === st).length} ${st.toLowerCase()}`).filter(x => !x.startsWith("0")).join(" · "))}
        ${kpi("Learners", fmt(learners), "enrolled in partner schools")}
        ${ns ? kpi(`Lessons observed, ${termLabel(ns.term).replace(", 2026", "")}`, ns.lessons, `${ns.schools.length} schools verified so far`) : ""}
        ${ns ? kpi("Lowest outcome", [...ns.values].sort((a, b) => a.value - b.value)[0].name, `next term's coaching focus · agency target ${C.TARGETS.agency}% by Term 3, 2027`) : ""}
        ${(() => { const sm = schoolMeeting(); return sm ? kpi("Meeting or exceeding expectations", Math.round(sm.value) + "%", `CBE school-based assessment, ${sm.n} schools · target ${C.TARGETS.meeting}%`) : ""; })()}</div>
      <section class="card"><h2>North Star by school</h2><p class="muted">Share of observed lessons where each outcome was clearly evident. Latest verified term for each school.</p>
        <div class="table-wrap"><table class="heat"><thead><tr><th>School</th>${C.NORTH_STAR.map(o => `<th>${nsKid(o.key)} ${o.name}</th>`).join("")}<th>Stage</th></tr></thead><tbody>
        ${latestBySchool.map(({ s, found, waiting }) => `<tr><th scope="row"><div>${esc(s.label)}</div><div class="small muted">${esc(s.type)}, ${esc(s.county)} · ${found ? termLabel(found.term) : "no data"}</div>${waiting && can.review() ? chip("wait", "New term awaiting review") : ""}</th>
          ${C.NORTH_STAR.map(o => { const v = found ? +found.row[o.key + "_pct"] : NaN; return `<td class="cell" style="background:${isFinite(v) ? heatColor(v) : "transparent"};color:var(--navy)" data-tip="${esc(`${s.label}, ${o.name}: ${isFinite(v) ? v + "%" : "no data"}${found ? ` of ${found.row.lessons_observed} lessons, ${termLabel(found.term)}` : ""}`)}" tabindex="0">${isFinite(v) ? v + "%" : "n/a"}</td>`; }).join("")}
          <td><span class="stage-chip">${esc(s.stage)}</span></td></tr>`).join("")}
        </tbody></table></div></section>
      <section class="card"><h2>Change over the year</h2><p class="muted">The ${matched.length} schools with verified data in every term, so the comparison is like for like.</p>
        ${matchedTerms.length > 1 ? progressRows(trendSeries, matchedTerms.map(x => x.label.replace(", 2026", "")), { targets: { agency: C.TARGETS.agency }, label: "How each North Star outcome moved by term" }) : empty("Change appears once two terms are verified.")}</section>
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
      <div class="pilots">${tb.verified.map(card).join("")}${isPartner() ? "" : tb.pending.map(card).join("")}</div>`;
  }

  function viewEvents() {
    const e = events();
    return programTabs("events") + head("t · Tackle", "Knowledge Sharing Events", "Where Fellows, teachers, county officials and funders share what works. The test of an event is what people do afterwards.") +
      `<div class="kpis">${kpi("Events with verified data", e.rows.length, "")}${kpi("People taking part", fmt(e.attendees), `${e.county} county officials`)}${kpi("Commitments followed up", e.made ? pct(e.followed / e.made) : "n/a", `${e.followed} of ${e.made}, within a term`)}</div>
      ${e.rows.map(r => `<section class="card"><h2>${esc(r.event)}</h2><p class="muted">${esc(r.county)} · ${fmt(e.att(r))} people</p>
        <div class="two-col"><div>${bars(e.groups.map(g => ({ label: g[1], value: +r[g[0]], text: fmt(r[g[0]]) })), { max: Math.max(...e.rows.flatMap(x => e.groups.map(g => +x[g[0]]))) })}</div>
        <div class="follow"><div class="kpi-label">Commitments followed up</div><div class="kpi-value">${pct(r.commitments_followed / r.commitments_made)}</div><div class="kpi-sub">${r.commitments_followed} of ${r.commitments_made}</div></div></div></section>`).join("")}
      ${!can.add() ? "" : `<section class="card notice"><h2>KSE Term 3: Fellows showcase</h2><p>Attendance and commitments haven't been submitted yet.</p><a class="btn" href="#/add" data-action="pick-ds-link" data-ds="event_attendance">Add event data</a></section>`}`;
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
    const piiIgnored = headers.filter((h, i) => !map[i] && grid.slice(1).some(r => PII_VALUE.test(r[i] || "")));
    if (piiIgnored.length) add.notes.push(`The column ${piiIgnored.join(", ")} held what looks like a phone number or email address. It was not saved. Please remove it from your working copy too.`);
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
    return head("i · Iterate", "Review and trust", "Every submission is checked automatically. M&E then verifies it, or returns it with a note. Only verified data reaches the dashboards and the partner report.") +
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
          ${open ? `<ol class="history" aria-label="History">${historyOf(s).map(h => `<li><span class="h-date">${prettyDate(h.at)}</span>${esc(h.what)} <span class="muted">by ${esc(h.who)}</span></li>`).join("")}</ol>` : ""}
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
        <h2>${esc(p.title)}</h2>${decisionFor(p.id) ? `<p>${chip("ok", `Decision recorded ${prettyDate(decisionFor(p.id).date)}`)}</p>` : ""}<p class="evidence">${esc(p.evidence)}</p><p class="rule">${esc(p.rule)}</p>
        <div class="options"><span class="small muted">Options</span><ul>${p.options.map(o => `<li>${esc(o)}</li>`).join("")}</ul></div>
        ${can.decide() ? `<button class="btn primary" data-action="record" data-id="${p.id}">Record a decision</button>` : ""}</article>`).join("")}</div>
      ${pr.onTrack.length ? `<section class="card"><h2>On track</h2><ul class="ticks">${pr.onTrack.map(o => `<li>${esc(o)}</li>`).join("")}</ul></section>` : ""}
      <section class="card"><h2>Decision log</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Decision</th><th>Owner</th><th>Look again</th><th>Status</th></tr></thead><tbody>
        ${state.decisions.map(d => `<tr><td class="nowrap">${prettyDate(d.date)}</td><td><strong>${esc(d.title)}</strong><div class="small">${esc(d.decision)}</div></td><td>${esc(d.owner)}</td><td class="nowrap">${prettyDate(d.review)}</td>
          <td>${d.reviewedOn ? chip("ok", `Reviewed ${prettyDate(d.reviewedOn)}`) : isDue(d) ? `${chip("warn", "Review due")}${can.decide() ? ` <button class="text-link as-btn small" data-action="mark-reviewed" data-id="${esc(d.id)}">Mark reviewed</button>` : ""}` : chip("wait", "Open")}</td></tr>`).join("")}
      </tbody></table></div></section>`;
  }

  /* ----- partner report ----- */
  function viewReport() {
    const ns = northStarNow(), s = partnerSentences(), t = trust();
    const voices = state.voices.filter(v => v.consent).slice(0, 4);
    return `<div class="partner-report">
      <header class="page-head report-head"><div><div class="eyebrow">s · Share · Prepared for our partners</div><h1>Whole Child Learning impact report</h1>
        <p class="lede">Built only from verified data, as of ${prettyDate(today())}. Every statement carries its source and sample size.</p></div>
        <div class="report-actions no-print"><button class="btn primary" data-action="print">Print or save as PDF</button><button class="btn" data-action="csv-figures">Download verified figures (CSV)</button></div></header>
      ${ns ? `<section class="card kid-card"><h2>How whole are the children we reach?</h2><p class="dmeta">${termLabel(ns.term)} · ${ns.schools.length} schools · ${ns.lessons} lessons observed</p>${nsKids(ns)}${capLine(CAP.north)}</section>` : ""}
      <section class="card"><h2>What we can say with confidence</h2>
        <div class="sentences">${s.map(x => `<div class="sentence"><div class="eyebrow">${esc(x.program)}</div><p>${esc(x.text)}</p><p class="small muted">${esc(x.source)} · ${esc(x.n)}</p><button class="text-link as-btn no-print" data-action="copy" data-text="${esc(x.text)}">Copy sentence</button></div>`).join("")}</div></section>
      ${(() => { const learn = prompts().list.filter(p => p.learn).map(p => p.learn); return learn.length ? `<section class="card"><h2>What we're learning</h2><p class="muted">Where results are weaker than we want, and what we're doing about it.</p><ul class="ticks">${learn.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""; })()}
      <section class="card"><h2>In their words</h2><div class="voices report-voices">${voices.map(v => `<figure class="voice"><blockquote>${esc(v.text)}</blockquote><figcaption>${esc(v.role)} · ${esc(v.county)}<span class="voice-tags">${v.tags.filter(tg => NS_COLOR[tg]).map(tg => nsKid(tg, C.NORTH_STAR.find(n => n.key === tg).name)).join("")}</span></figcaption></figure>`).join("")}</div>${capLine(CAP.voice)}</section>
      <section class="card"><h2>How we know</h2><ul class="ticks">
        <li>Figures come only from submissions verified by M&E: ${t.verified} of ${t.total} so far. Anything awaiting review is left out.</li>
        <li>Rows that fail checks (for example more completers than registrants, or impossible percentages) are held back from the figures they affect.</li>
        <li>Teacher use is reported by head teachers and checked through call-backs to a sample of teachers. We don't yet claim learning gains from InnovatED.</li>
        <li>No child is named. Learner quotes are shared only with a caregiver's consent and the learner's own agreement.</li>
        <li>Every indicator has a written definition, source and target. <a href="#/design">See how each one is measured</a>.</li></ul></section>
    </div>`;
  }

  /* ---------- shell ---------- */
  const INTERNAL = ["staff", "me", "lead"];
  const NAV = [
    { route: "overview", label: "Dashboard" },
    { stage: "m", name: "Make meaning", hide: ["teacher"] }, { route: "design", label: "Design map", hide: ["teacher"] },
    { stage: "e", name: "Empathize" }, { route: "voices", label: "Voices" },
    { stage: "t", name: "Tackle", hide: ["teacher"] }, ...C.PROGRAMS.map(p => ({ route: "programs/" + p.id, label: p.name, sub: true, hide: ["teacher"] })),
    { stage: "i", name: "Iterate", hide: ["partner"] }, { route: "checkin", label: "Teacher check-in", hide: ["partner"] },
    { route: "add", label: "Add data", only: INTERNAL }, { route: "review", label: "Review and trust", only: INTERNAL, badge: () => pending().length }, { route: "decide", label: "Pause and adapt", only: INTERNAL, badge: () => prompts().list.filter(p => p.sev === "decide").length },
    { stage: "s", name: "Share", hide: ["teacher"] }, { route: "report", label: "Partner report", hide: ["teacher"] }
  ];
  const shows = n => !(n.hide && n.hide.includes(state.role)) && !(n.only && !n.only.includes(state.role));
  const BLOCKED = { partner: ["add", "review", "decide", "checkin"], teacher: ["add", "review", "decide"] };
  function renderNav(cur) {
    $("#nav").innerHTML = NAV.filter(shows).map(n => {
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
  const VIEWS = { overview: viewOverview, design: viewDesign, voices: viewVoices, checkin: viewCheckin, add: viewAdd, review: viewReview, decide: viewDecide, report: viewReport };
  const PROGRAM_VIEWS = { fellowship: viewFellowship, innovated: viewInnovated, schools: viewSchools, testbed: viewTestbed, events: viewEvents };
  function route() {
    let h = location.hash.replace(/^#\/?/, "") || "overview";
    let [page, sub] = h.split("/");
    if (page === "donor") { location.hash = "#/report"; return; }
    if ((BLOCKED[state.role] || []).includes(page)) { location.hash = "#/overview"; return; }
    let html;
    if (page === "programs") { sub = PROGRAM_VIEWS[sub] ? sub : "fellowship"; html = PROGRAM_VIEWS[sub](); h = "programs/" + sub; }
    else html = (VIEWS[page] || viewOverview)();
    renderNav(h);
    const main = $("#view");
    main.innerHTML = html;
    liveTouches(main);
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
      state.submissions.push({ id: uid("sub"), dataset: add.ds, term: add.term, title, submittedBy: roleOf().label, submittedAt: today(), status: "submitted", note: "", rows: add.rows, history: [{ at: today(), who: roleOf().label, what: "Submitted" }] });
      save(); add.ds = null; add.rows = []; add.notes = []; reviewFilter = "all";
      toast("Submitted for review"); location.hash = "#/review";
    }
    else if (act === "voice-filter") { voiceFilter = a.dataset.v; rerender(); }
    else if (act === "review-filter") { reviewFilter = a.dataset.v; rerender(); }
    else if (act === "toggle-sub") { const id = a.dataset.id; openSubs.has(id) ? openSubs.delete(id) : openSubs.add(id); rerender(); }
    else if (act === "verify") {
      const s = state.submissions.find(x => x.id === a.dataset.id);
      logEvent(s, "Verified", "M&E");
      Object.assign(s, { status: "verified", reviewedBy: "M&E", reviewedAt: today() });
      save(); rerender(); toast("Verified. The figures now include this submission");
    }
    else if (act === "return") {
      const s = state.submissions.find(x => x.id === a.dataset.id);
      dialog("Return with a note", `<label>What needs fixing<textarea name="note" rows="4" required placeholder="For example: re-check the attendance register for Site M"></textarea></label>`, "Return submission", fd => {
        const note = String(fd.get("note") || "").trim(); if (!note) return false;
        logEvent(s, "Returned with a note", "M&E");
        Object.assign(s, { status: "returned", note, reviewedBy: "M&E", reviewedAt: today() }); save(); rerender(); toast("Returned to the submitter");
      });
    }
    else if (act === "resubmit") { const s = state.submissions.find(x => x.id === a.dataset.id); logEvent(s, "Resubmitted"); Object.assign(s, { status: "submitted", submittedAt: today() }); save(); rerender(); toast("Resubmitted for review"); }
    else if (act === "record") {
      const p = prompts().list.find(x => x.id === a.dataset.id);
      const owners = ["Programs Manager", "Director of Programs", "Lead Coach", "Associate", "M&E", "Codifier"];
      const inTwo = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      dialog("Record a decision", `<label>Decision on<input name="title" value="${esc(p ? p.title : "")}" required></label>
        <label>What we decided<textarea name="decision" rows="3" required>${esc(p ? p.options[0] : "")}</textarea></label>
        <div class="form-grid"><label>Owner<select name="owner">${owners.map(o => `<option>${o}</option>`).join("")}</select></label><label>Look again on<input type="date" name="review" value="${inTwo}" required></label></div>`, "Save decision", fd => {
        const title = String(fd.get("title") || "").trim(), decision = String(fd.get("decision") || "").trim();
        if (!title || !decision) return false;
        state.decisions.unshift({ id: uid("d"), date: today(), title, decision, owner: fd.get("owner"), review: fd.get("review"), promptId: p ? p.id : null }); save(); rerender(); toast("Decision saved to the log");
      });
    }
    else if (act === "print") window.print();
    else if (act === "copy") { const txt = a.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast("Sentence copied"), () => toast("Select the sentence to copy it")); }
    else if (act === "export") downloadText("metis-whole-child-portal-data.json", JSON.stringify(state, null, 2), "application/json");
    else if (act === "import") $("#import-input").click();
    else if (act === "reset") dialog("Reset to sample data", "<p>This replaces everything saved in this browser with the original sample data. Export first if you want to keep your changes.</p>", "Reset data", () => { state = fresh(); save(); add.ds = null; rerender(); toast("Sample data restored"); });
    else if (act === "menu") document.body.classList.toggle("nav-open");
    else if (act === "privacy") dialog("How data is handled", PRIVACY_HTML, "Close", () => true);
    else if (act === "csv-figures") { downloadText("metis-verified-figures.csv", verifiedFigures().map(r => r.map(csvCell).join(",")).join("\n") + "\n", "text/csv"); toast("Verified figures downloaded"); }
    else if (act === "mark-reviewed") { const d = state.decisions.find(x => x.id === a.dataset.id); if (d) { d.reviewedOn = today(); save(); rerender(); toast("Marked as reviewed"); } }
    else if (act === "lang") { lang = a.dataset.v === "sw" ? "sw" : "en"; rerender(); }
    else if (act === "checkin-again") { lastCheckin = null; rerender(); }
    else if (act === "go") location.hash = a.dataset.to;
    else if (act === "about-toggle") { try { localStorage.setItem(ABOUT_KEY, aboutHidden() ? "0" : "1"); } catch (err) { /* storage unavailable */ } rerender(); }
    else if (act === "open-review") { openSubs.add(a.dataset.id); reviewFilter = "submitted"; location.hash = "#/review"; }
    else if (act === "county") {
      const card = a.closest(".dcard") || document, box = card.querySelector(".county-detail");
      card.querySelectorAll(".cty-shape.sel").forEach(x => x.classList.remove("sel"));
      a.classList.add("sel");
      if (box) box.innerHTML = countyDetail(a.dataset.county);
    }
  });

  document.addEventListener("submit", e => {
    if (e.target.id === "row-form") {
      e.preventDefault();
      const d = C.DATASETS[add.ds], fd = new FormData(e.target), r = {};
      d.fields.forEach(f => { let v = String(fd.get(f.key) == null ? "" : fd.get(f.key)).trim(); if (["int", "num", "pct"].includes(f.type) && v !== "") v = Number(v); r[f.key] = v; });
      add.rows.push(r); add.blocked = ""; rerender(); toast("Row added and checked");
    }
    if (e.target.id === "checkin-form") {
      e.preventDefault();
      const fd = new FormData(e.target), msg = $("#ci-msg"), num = k => { const v = String(fd.get(k) || "").trim(); return v === "" ? "" : Number(v); };
      const row = {
        school: String(fd.get("school") || "").trim().toUpperCase(), county: fd.get("county"), grade_band: fd.get("grade_band"), class_size: num("class_size"),
        girls: num("girls"), boys: num("boys"), with_disability: num("with_disability"), last_used: fd.get("last_used") || "",
        used_for: fd.getAll("used_for").join("; "), minutes_saved: num("minutes_saved"), outcomes_seen: fd.getAll("outcomes_seen").join("; "),
        what_worked: String(fd.get("what_worked") || "").trim(), support: fd.get("support") || ""
      };
      if (!row.school || row.class_size === "" || !row.last_used || !row.support) { msg.textContent = tx("missing"); return; }
      if (PII_VALUE.test(row.what_worked) || NAME_PHRASE.test(row.what_worked)) { msg.textContent = tx("names"); return; }
      const res = checkRows("teacher_checkin", [row])[0];
      if (res.exclRow) { msg.textContent = res.issues.find(i => i.excl === "row").msg; return; }
      let sub = state.submissions.find(x => x.dataset === "teacher_checkin" && x.status === "submitted" && x.term === CURRENT_TERM);
      if (!sub) {
        sub = { id: uid("sub"), dataset: "teacher_checkin", term: CURRENT_TERM, title: `Teacher check-ins, ${termLabel(CURRENT_TERM)}, new`, submittedBy: "Teachers (check-in)", submittedAt: today(), status: "submitted", note: "", rows: [], history: [] };
        state.submissions.push(sub);
      }
      sub.rows.push(row);
      logEvent(sub, "Check-in added", roleOf().label);
      state.myCheckins = (state.myCheckins || 0) + 1;
      state.myLastCheckin = today();
      lastCheckin = `${row.school} · ${opt(row.grade_band)} · ${opt(row.last_used)}${res.issues.length ? ` · ${res.issues.map(i => i.msg).join(". ")}` : ""}`;
      save(); rerender(); toast(lang === "sw" ? "Ripoti imetumwa" : "Check-in sent");
    }
    if (e.target.id === "voice-form") {
      e.preventDefault();
      const fd = new FormData(e.target), msg = $("#voice-msg");
      const text = String(fd.get("text") || "").trim();
      if (!text) { msg.textContent = "Add the quote first."; return; }
      if (PII_VALUE.test(text)) { msg.textContent = "Remove the phone number or email address, then save."; return; }
      if (NAME_PHRASE.test(text)) { msg.textContent = "The quote looks like it names someone. Remove the name, then save."; return; }
      const learner = String(fd.get("role") || "").startsWith("Learner");
      if (!fd.get("consent")) { msg.textContent = learner ? "Record the parent or caregiver's consent before saving this quote." : "Record consent before saving this quote."; return; }
      if (learner && !fd.get("assent")) { msg.textContent = "A learner's quote also needs the learner's own agreement."; return; }
      state.voices.unshift({ id: uid("v"), role: fd.get("role"), county: fd.get("county"), text, tags: fd.getAll("tags"), consent: true, consentType: learner ? "caregiver consent and learner assent" : "consent", added: today() });
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
        try { const p = JSON.parse(String(r.result)); if (!p || !Array.isArray(p.submissions) || !Array.isArray(p.voices)) throw new Error("shape"); p.submissions = p.submissions.filter(x => x && C.DATASETS[x.dataset] && Array.isArray(x.rows)); p.voices = p.voices.filter(v => v && typeof v.text === "string").map(v => ({ ...v, tags: Array.isArray(v.tags) ? v.tags : [] })); if (p.role === "donor") p.role = "partner"; p.role = C.ROLES.some(r => r.id === p.role) ? p.role : "staff"; p.version = C.version; p.decisions = p.decisions || []; state = p; save(); route(); toast("Data imported"); }
        catch (err) { toast("That file isn't a portal export. Nothing was changed"); }
        e.target.value = "";
      };
      r.readAsText(e.target.files[0]);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") document.body.classList.remove("nav-open");
    const t = e.target;
    if ((e.key === "Enter" || e.key === " ") && t && t.getAttribute && t.getAttribute("data-action") && !["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) {
      e.preventDefault(); t.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
  });

  /* ---------- live: the badge, and data saved in another tab ---------- */
  function liveStamp() {
    const el = $("#live-text");
    if (!el) return;
    const at = state.updatedAt ? Date.parse(state.updatedAt) : NaN;
    const mins = isFinite(at) ? Math.floor((Date.now() - at) / 60000) : NaN;
    el.textContent = !isFinite(mins) ? "Live · sample data" : mins < 1 ? "Live · updated just now" : mins < 60 ? `Live · updated ${mins} min ago` : `Live · updated ${prettyDate(state.updatedAt.slice(0, 10))}`;
  }
  function flashLive() { const b = $("#live"); if (!b) return; b.classList.add("flash"); clearTimeout(flashLive.t); flashLive.t = setTimeout(() => b.classList.remove("flash"), 2600); }
  window.addEventListener("storage", e => {
    if (e.key !== STORE) return;
    const p = load();
    if (!p) return;
    const changed = sigOf(p) !== sigOf(state), role = state.role;
    state = p; state.role = role; dataSig = sigOf(state);
    liveStamp();
    if (!changed) return;
    flashLive();
    const page = (location.hash.replace(/^#\/?/, "") || "overview").split("/")[0];
    if (["checkin", "add"].includes(page)) toast("New data just came in. Open the dashboard to see it");
    else { rerender(); toast("New data just came in. The dashboard has updated"); }
  });
  setInterval(liveStamp, 30000);

  window.addEventListener("hashchange", route);
  $("#role").innerHTML = C.ROLES.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("");
  liveStamp();
  route();
})();
