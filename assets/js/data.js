/* Metis Whole Child Learning Impact Portal: configuration and fictional sample data.
   Concept prototype. Every figure below is invented for demonstration. */
window.METIS_CONFIG = (function () {
  const COUNTIES = ["Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay", "Isiolo",
    "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
    "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru",
    "Nandi", "Narok", "Nyamira", "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
    "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"];

  const TERMS = [
    { id: "2026-T1", label: "Term 1, 2026" },
    { id: "2026-T2", label: "Term 2, 2026" },
    { id: "2026-T3", label: "Term 3, 2026" }
  ];

  const NORTH_STAR = [
    { key: "agency", letter: "A", name: "Agency", looks: "Learners make choices, set goals and act on them", cbe: "Self-efficacy; learning to learn" },
    { key: "belonging", letter: "B", name: "Belonging", looks: "Learners care for each other and feel they matter", cbe: "Citizenship; communication and collaboration" },
    { key: "creativity", letter: "C", name: "Creativity", looks: "Learners imagine and solve problems", cbe: "Creativity and imagination; critical thinking" },
    { key: "delight", letter: "D", name: "Delight", looks: "Learners find joy and wellbeing in learning", cbe: "Wellbeing (pertinent and contemporary issues)" },
    { key: "expertise", letter: "E", name: "Expertise", looks: "Learners master skills and knowledge", cbe: "Subject learning outcomes; digital literacy" }
  ];

  const PROGRAMS = [
    { id: "fellowship", name: "Metis Fellowship", short: "Fellowship", job: "Leaders designing for the whole child" },
    { id: "innovated", name: "InnovatED", short: "InnovatED", job: "Teachers using tools that free time for children" },
    { id: "schools", name: "Whole Child Schools", short: "Schools", job: "School design teams making whole child learning everyday practice" },
    { id: "testbed", name: "Kenya EdTech Testbed", short: "EdTech Testbed", job: "Testing education technology honestly before it scales" },
    { id: "events", name: "Knowledge Sharing Events", short: "Knowledge Sharing", job: "Sharing what works across the system" }
  ];

  const SCHOOLS = [
    { id: "S1", label: "Partner School 1", type: "Public primary and junior school", county: "Nakuru", learners: 1120, stage: "Embed" },
    { id: "S2", label: "Partner School 2", type: "Public primary school", county: "Kiambu", learners: 980, stage: "Experiment" },
    { id: "S3", label: "Partner School 3", type: "Low-fee private primary", county: "Nairobi", learners: 640, stage: "Embed" },
    { id: "S4", label: "Partner School 4", type: "Public primary school", county: "Machakos", learners: 870, stage: "Experiment" },
    { id: "S5", label: "Partner School 5", type: "ECDE and lower primary", county: "Kisumu", learners: 410, stage: "Explore" },
    { id: "S6", label: "Partner School 6", type: "Public primary and junior school", county: "Kajiado", learners: 1392, stage: "Experiment" }
  ];
  const STAGES = ["Explore", "Experiment", "Embed", "Spread"];
  const PILOT_STAGES = ["Idea", "Prototype", "Pilot", "Evidence", "Scale"];

  const ROLES = [
    { id: "staff", label: "Program staff", hint: "Lead Coaches, Codifier, Associates and partners: add data and see everything internal" },
    { id: "me", label: "M&E", hint: "Check, verify or return submitted data" },
    { id: "lead", label: "Decision maker", hint: "Programs Manager and Director: act on decision prompts and record decisions" },
    { id: "donor", label: "Donor", hint: "Funders and partners: verified data only" }
  ];

  /* Dataset schemas drive the forms, CSV templates and checks. */
  const DATASETS = {
    innovated_sites: {
      label: "InnovatED training sites", program: "innovated", who: "Associates and programme partners",
      when: "Eight weeks after each training", unit: "site",
      fields: [
        { key: "site", label: "Site code", type: "text", required: true, example: "A" },
        { key: "county", label: "County", type: "select", options: COUNTIES, required: true, example: "Nakuru" },
        { key: "delivered_by", label: "Delivered by", type: "select", options: ["Metis", "Partner"], required: true, example: "Metis" },
        { key: "registered", label: "Teachers registered", type: "int", required: true, min: 0, example: 30 },
        { key: "completed", label: "Teachers completed", type: "int", required: true, min: 0, example: 27 },
        { key: "confidence", label: "Confidence on last day (1 to 5)", type: "num", required: true, min: 1, max: 5, example: 4.5 },
        { key: "using_pct", label: "Using the tool at 8 weeks (%)", type: "pct", required: false, missingExcl: "use", rangeExcl: "use", example: 68 },
        { key: "cost_per_completer", label: "Cost per teacher completed (KES)", type: "int", required: true, min: 0, example: 3800 }
      ]
    },
    school_obs: {
      label: "Whole Child classroom observations", program: "schools", who: "Lead Coaches and school design teams",
      when: "Each term", unit: "school",
      fields: [
        { key: "school", label: "School", type: "select", options: SCHOOLS.map(s => s.id), required: true, example: "S1" },
        { key: "lessons_observed", label: "Lessons observed", type: "int", required: true, min: 0, example: 10 },
        { key: "agency_pct", label: "Agency evident (% of lessons)", type: "pct", required: true, example: 45 },
        { key: "belonging_pct", label: "Belonging evident (% of lessons)", type: "pct", required: true, example: 65 },
        { key: "creativity_pct", label: "Creativity evident (% of lessons)", type: "pct", required: true, example: 50 },
        { key: "delight_pct", label: "Delight evident (% of lessons)", type: "pct", required: true, example: 60 },
        { key: "expertise_pct", label: "Expertise evident (% of lessons)", type: "pct", required: true, example: 55 }
      ]
    },
    fellow_pulse: {
      label: "Fellowship progress and pulse", program: "fellowship", who: "Lead Coaches",
      when: "Each sprint", unit: "Fellow",
      fields: [
        { key: "fellow", label: "Fellow code", type: "text", required: true, example: "F01" },
        { key: "org_type", label: "Organisation type", type: "select", options: ["School leader", "NGO", "Edtech", "County office"], required: true, example: "School leader" },
        { key: "county", label: "County", type: "select", options: COUNTIES, required: true, example: "Nakuru" },
        { key: "status", label: "Status", type: "select", options: ["On track", "Needs support", "Re-sprint"], required: true, example: "On track" },
        { key: "attendance_pct", label: "Session attendance (%)", type: "pct", required: true, example: 92 },
        { key: "relevance", label: "Relevance (1 to 5)", type: "num", required: true, min: 1, max: 5, example: 4 },
        { key: "belonging", label: "Belonging in cohort (1 to 5)", type: "num", required: true, min: 1, max: 5, example: 5 },
        { key: "hours", label: "Hours spent last month", type: "num", required: true, min: 0, max: 80, example: 15 },
        { key: "led_full_test", label: "Led sprint team through a full test", type: "select", options: ["Yes", "No"], required: true, example: "Yes" },
        { key: "sponsor_active", label: "Sponsor actively supporting", type: "select", options: ["Yes", "No"], required: true, example: "Yes" },
        { key: "milestones_done", label: "Milestones completed (0 to 4)", type: "int", required: true, min: 0, max: 4, example: 2 },
        { key: "learner_data", label: "Collecting learner-level evidence", type: "select", options: ["Yes", "No"], required: true, example: "No" }
      ]
    },
    feedback_log: {
      label: "Facilitation feedback turnaround", program: "fellowship", who: "Lead Coaches and Codifier",
      when: "Monthly", unit: "term",
      fields: [
        { key: "period", label: "Term", type: "select", options: TERMS.map(t => t.id), required: true, example: "2026-T3" },
        { key: "feedback_items", label: "Feedback pieces written", type: "int", required: true, min: 0, example: 31 },
        { key: "median_days", label: "Median days to feedback", type: "num", required: true, min: 0, max: 60, example: 4 },
        { key: "against_standard_pct", label: "Written against the standard (%)", type: "pct", required: true, example: 100 }
      ]
    },
    event_attendance: {
      label: "Knowledge Sharing Event attendance", program: "events", who: "Associates",
      when: "After each event", unit: "event",
      fields: [
        { key: "event", label: "Event", type: "text", required: true, example: "KSE Term 3: Fellows showcase" },
        { key: "county", label: "County", type: "select", options: COUNTIES, required: true, example: "Nairobi" },
        { key: "teachers", label: "Teachers", type: "int", required: true, min: 0, example: 60 },
        { key: "school_leaders", label: "School leaders", type: "int", required: true, min: 0, example: 35 },
        { key: "county_officials", label: "County officials", type: "int", required: true, min: 0, example: 10 },
        { key: "funders", label: "Funders and partners", type: "int", required: true, min: 0, example: 8 },
        { key: "fellows", label: "Fellows", type: "int", required: true, min: 0, example: 24 },
        { key: "commitments_made", label: "Commitments made", type: "int", required: true, min: 0, example: 40 },
        { key: "commitments_followed", label: "Commitments followed up within a term", type: "int", required: true, min: 0, example: 25 }
      ]
    },
    testbed_pilot: {
      label: "EdTech Testbed pilot update", program: "testbed", who: "Testbed lead and partners",
      when: "Each term", unit: "pilot",
      fields: [
        { key: "pilot", label: "Pilot", type: "text", required: true, example: "Offline phonics app" },
        { key: "stage", label: "Evidence stage", type: "select", options: PILOT_STAGES, required: true, example: "Pilot" },
        { key: "schools", label: "Schools", type: "int", required: true, min: 0, example: 4 },
        { key: "learners", label: "Learners", type: "int", required: true, min: 0, example: 620 },
        { key: "result", label: "Headline result", type: "text", required: true, example: "Reading fluency up 9 words a minute against comparison classes" },
        { key: "evidence", label: "Evidence type", type: "select", options: ["Self-report", "Usage logs", "Observation", "Comparison group", "Randomised trial"], required: true, example: "Comparison group" }
      ]
    }
  };

  const R = (site, county, by, reg, comp, conf, use, cost) =>
    ({ site, county, delivered_by: by, registered: reg, completed: comp, confidence: conf, using_pct: use, cost_per_completer: cost });
  const O = (school, lessons, a, b, c, d, e) =>
    ({ school, lessons_observed: lessons, agency_pct: a, belonging_pct: b, creativity_pct: c, delight_pct: d, expertise_pct: e });
  const F = (fellow, org_type, county, status, attendance_pct, relevance, belonging, hours, led, sponsor, milestones_done, learner) =>
    ({ fellow, org_type, county, status, attendance_pct, relevance, belonging, hours, led_full_test: led, sponsor_active: sponsor, milestones_done, learner_data: learner });

  const seed = {
    version: 1,
    role: "staff",
    submissions: [
      {
        id: "sub-inn-t2", dataset: "innovated_sites", term: "2026-T2", title: "InnovatED Term 2 training, 8-week follow-up",
        submittedBy: "Associate", submittedAt: "2026-08-20", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-08-27",
        note: "Sites M and K fail checks and stay out of the affected figures until the registers are re-checked.",
        rows: [
          R("A", "Nakuru", "Metis", 30, 27, 4.5, 68, 3800), R("B", "Nakuru", "Partner", 28, 19, 3.9, 41, 2600),
          R("C", "Nakuru", "Metis", 24, 22, 4.3, 63, 3900), R("D", "Kiambu", "Metis", 35, 31, 4.6, 71, 3700),
          R("E", "Kiambu", "Partner", 26, 15, 3.8, 35, 2500), R("F", "Kiambu", "Partner", 22, 18, 4.4, 27, 2700),
          R("G", "Machakos", "Metis", 20, 17, 4.1, 58, 4200), R("H", "Machakos", "Partner", 25, 14, 3.6, "", 2600),
          R("I", "Machakos", "Metis", 3, 3, 5.0, 100, 9800), R("J", "Kisumu", "Metis", 27, 24, 4.2, 44, 5100),
          R("K", "Kisumu", "Partner", 30, 21, 4.0, 130, 2900), R("L", "Turkana", "Metis", 12, 11, 4.4, 55, 12400),
          R("M", "Kiambu", "Metis", 18, 22, 4.5, 61, 3800), R("N", "Nakuru", "Partner", 31, 20, 3.7, 38, 2400)
        ]
      },
      {
        id: "sub-sch-t1", dataset: "school_obs", term: "2026-T1", title: "Term 1 classroom observations, six partner schools",
        submittedBy: "Lead Coach (Schools)", submittedAt: "2026-04-06", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-04-14", note: "",
        rows: [O("S1", 10, 38, 60, 44, 55, 50), O("S2", 9, 30, 55, 40, 50, 48), O("S3", 8, 42, 66, 50, 61, 52),
          O("S4", 9, 28, 52, 38, 49, 47), O("S5", 6, 35, 64, 46, 70, 40), O("S6", 11, 26, 50, 36, 47, 45)]
      },
      {
        id: "sub-sch-t2", dataset: "school_obs", term: "2026-T2", title: "Term 2 classroom observations, six partner schools",
        submittedBy: "Lead Coach (Schools)", submittedAt: "2026-08-03", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-08-10", note: "",
        rows: [O("S1", 12, 44, 66, 50, 60, 55), O("S2", 10, 36, 61, 45, 56, 52), O("S3", 9, 48, 72, 55, 66, 57),
          O("S4", 10, 33, 58, 43, 54, 51), O("S5", 7, 39, 69, 51, 74, 44), O("S6", 12, 31, 57, 41, 53, 49)]
      },
      {
        id: "sub-sch-t3a", dataset: "school_obs", term: "2026-T3", title: "Term 3 classroom observations, Schools 1 to 4",
        submittedBy: "Lead Coach (Schools)", submittedAt: "2026-09-25", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-09-30", note: "",
        rows: [O("S1", 11, 52, 74, 57, 67, 61), O("S2", 10, 41, 66, 49, 61, 56), O("S3", 9, 55, 78, 61, 71, 62), O("S4", 10, 38, 63, 47, 58, 55)]
      },
      {
        id: "sub-sch-t3b", dataset: "school_obs", term: "2026-T3", title: "Term 3 classroom observations, Schools 5 and 6",
        submittedBy: "Lead Coach (Schools)", submittedAt: "2026-10-02", status: "submitted", note: "",
        rows: [O("S5", 4, 44, 73, 55, 79, 47), O("S6", 11, 36, 62, 45, 58, 53)]
      },
      {
        id: "sub-fel-t3", dataset: "fellow_pulse", term: "2026-T3", title: "Fellowship Sprint 3 progress and pulse",
        submittedBy: "Lead Coaches", submittedAt: "2026-09-29", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-10-01", note: "",
        rows: [
          F("F01", "School leader", "Nakuru", "On track", 96, 5, 5, 14, "Yes", "Yes", 3, "Yes"),
          F("F02", "NGO", "Nairobi", "On track", 92, 4, 5, 16, "Yes", "Yes", 3, "Yes"),
          F("F03", "Edtech", "Nairobi", "On track", 88, 4, 4, 18, "Yes", "Yes", 2, "No"),
          F("F04", "County office", "Kiambu", "Needs support", 75, 3, 4, 12, "No", "No", 2, "No"),
          F("F05", "School leader", "Machakos", "On track", 100, 5, 5, 15, "Yes", "Yes", 3, "Yes"),
          F("F06", "School leader", "Kisumu", "On track", 92, 4, 5, 17, "Yes", "Yes", 2, "No"),
          F("F07", "NGO", "Kajiado", "Needs support", 79, 4, 4, 19, "No", "No", 2, "No"),
          F("F08", "NGO", "Nakuru", "On track", 96, 5, 5, 14, "Yes", "Yes", 3, "Yes"),
          F("F09", "Edtech", "Nairobi", "Re-sprint", 71, 3, 3, 20, "No", "No", 1, "No"),
          F("F10", "School leader", "Kiambu", "On track", 92, 4, 5, 13, "Yes", "Yes", 2, "Yes"),
          F("F11", "County office", "Machakos", "Needs support", 83, 4, 4, 11, "No", "Yes", 2, "No"),
          F("F12", "School leader", "Nairobi", "On track", 100, 5, 5, 16, "Yes", "Yes", 3, "Yes"),
          F("F13", "NGO", "Kisumu", "On track", 88, 4, 4, 15, "Yes", "Yes", 2, "No"),
          F("F14", "School leader", "Turkana", "Needs support", 79, 4, 5, 18, "No", "No", 2, "No"),
          F("F15", "Edtech", "Nairobi", "On track", 92, 5, 4, 17, "Yes", "Yes", 3, "Yes"),
          F("F16", "NGO", "Nakuru", "On track", 96, 4, 5, 12, "Yes", "Yes", 2, "No"),
          F("F17", "School leader", "Kajiado", "Re-sprint", 67, 3, 4, 21, "No", "No", 0, "No"),
          F("F18", "County office", "Nakuru", "On track", 88, 4, 4, 14, "No", "Yes", 2, "No"),
          F("F19", "School leader", "Machakos", "On track", 92, 5, 5, 16, "Yes", "Yes", 3, "Yes"),
          F("F20", "NGO", "Kiambu", "Needs support", 83, 3, 4, 19, "No", "No", 2, "No"),
          F("F21", "Edtech", "Kisumu", "On track", 96, 4, 5, 13, "Yes", "Yes", 2, "No"),
          F("F22", "School leader", "Nairobi", "Needs support", 79, 4, 4, 17, "No", "No", 2, "No"),
          F("F23", "NGO", "Machakos", "On track", 92, 5, 5, 14, "Yes", "Yes", 3, "No"),
          F("F24", "School leader", "Kisumu", "On track", 88, 4, 5, 15, "Yes", "Yes", 2, "No")
        ]
      },
      {
        id: "sub-fb", dataset: "feedback_log", term: "2026-T3", title: "Facilitation feedback turnaround, Terms 1 to 3",
        submittedBy: "Codifier", submittedAt: "2026-09-30", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-10-01", note: "",
        rows: [
          { period: "2026-T1", feedback_items: 48, median_days: 6, against_standard_pct: 0 },
          { period: "2026-T2", feedback_items: 52, median_days: 9, against_standard_pct: 0 },
          { period: "2026-T3", feedback_items: 31, median_days: 4, against_standard_pct: 100 }
        ]
      },
      {
        id: "sub-kse", dataset: "event_attendance", term: "2026-T2", title: "Knowledge Sharing Events, Terms 1 and 2",
        submittedBy: "Associate", submittedAt: "2026-08-05", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-08-12", note: "",
        rows: [
          { event: "KSE Term 1: Whole child in large classes", county: "Nairobi", teachers: 64, school_leaders: 38, county_officials: 9, funders: 7, fellows: 22, commitments_made: 41, commitments_followed: 26 },
          { event: "KSE Term 2: Measuring what matters", county: "Nakuru", teachers: 72, school_leaders: 41, county_officials: 12, funders: 9, fellows: 24, commitments_made: 48, commitments_followed: 29 }
        ]
      },
      {
        id: "sub-tb", dataset: "testbed_pilot", term: "2026-T3", title: "EdTech Testbed pilots, Term 3 update",
        submittedBy: "Testbed lead", submittedAt: "2026-09-26", status: "verified", reviewedBy: "M&E", reviewedAt: "2026-09-30", note: "",
        rows: [
          { pilot: "AI lesson-planning assistant (InnovatED)", stage: "Pilot", schools: 14, learners: 4900, result: "Teachers report saving about 3 hours a week on lesson preparation", evidence: "Self-report" },
          { pilot: "Offline phonics app, Grades 1 to 3", stage: "Evidence", schools: 4, learners: 620, result: "Reading fluency up 9 words a minute against comparison classes", evidence: "Comparison group" },
          { pilot: "Low-cost robotics kits for junior school", stage: "Prototype", schools: 1, learners: 80, result: "Learners co-designing the first three challenges", evidence: "Observation" }
        ]
      },
      {
        id: "sub-tb2", dataset: "testbed_pilot", term: "2026-T3", title: "SMS nudges for caregivers, first results",
        submittedBy: "Testbed partner", submittedAt: "2026-10-03", status: "submitted", note: "",
        rows: [{ pilot: "SMS nudges for caregivers", stage: "Prototype", schools: 2, learners: 300, result: "61% of caregivers replied to at least one prompt", evidence: "Usage logs" }]
      }
    ],
    voices: [
      { id: "v1", role: "Learner, Grade 5", county: "Nakuru", text: "When we plan the class garden, the teacher lets us decide. I like being the one who chooses.", tags: ["agency", "delight"], consent: true, added: "2026-09-12" },
      { id: "v2", role: "Teacher", county: "Kiambu", text: "The lesson plans take me half the time now, so I use that time to talk to the quiet ones.", tags: ["belonging", "expertise"], consent: true, added: "2026-08-21" },
      { id: "v3", role: "Caregiver", county: "Machakos", text: "My daughter used to fear school. Now she tells me what she built that day.", tags: ["belonging", "delight", "creativity"], consent: true, added: "2026-07-30" },
      { id: "v4", role: "Learner, Grade 3", county: "Kisumu", text: "We made a shop with bottle tops and I was the one counting the money.", tags: ["expertise", "creativity"], consent: true, added: "2026-09-18" },
      { id: "v5", role: "School leader", county: "Kajiado", text: "We moved our staff meeting to Friday afternoon so teachers can share what worked with their classes that week.", tags: ["belonging"], consent: true, added: "2026-09-02" },
      { id: "v6", role: "Fellow", county: "Nairobi", text: "Watching children test my prototype changed what I thought they needed.", tags: ["agency"], consent: true, added: "2026-07-25" },
      { id: "v7", role: "Learner, Grade 8", county: "Nakuru", text: "In the debate club I learned I can disagree with someone without fighting.", tags: ["belonging", "agency"], consent: true, added: "2026-09-20" },
      { id: "v8", role: "Teacher", county: "Kisumu", text: "Sixty learners is a lot, but the pair talk routine means everyone speaks in every lesson.", tags: ["belonging", "expertise"], consent: true, added: "2026-08-28" }
    ],
    decisions: [
      { id: "d1", date: "2026-08-27", title: "Introduce Facilitation Standard v1 as an interim standard", decision: "Publish v1 to Fellows by Friday, recalibrate coaches, reissue unclear feedback. Refine the standard with Fellows over the term.", owner: "Programs Manager", review: "2026-10-16" },
      { id: "d2", date: "2026-08-28", title: "Mid-year funder report: on time with an honest scope", decision: "Report on the new date with verified data, flag the two incomplete counties and send a dated addendum.", owner: "Director of Programs", review: "2026-09-25" },
      { id: "d3", date: "2026-08-29", title: "Move two InnovatED sessions out of the county assessment week", decision: "Re-slot to the nearest term week with the same partner; merge if venues allow.", owner: "Associate", review: "2026-09-11" }
    ]
  };

  const DESIGN_MAP = {
    challenge: "How might we see, in time to act, whether the children Metis reaches are thriving as whole people, and share that honestly with the people who lead and fund the work?",
    smaller: [
      "Make data entry quick for coaches and partners working in the field, on a phone, with weak connections.",
      "Make sure every number a donor sees has been checked and carries its sample size and source.",
      "Keep children's voices in the picture without ever exposing a child.",
      "Turn data into decisions at the moments decisions are actually made."
    ],
    values: [
      ["Do hard things", "Measure all five North Star outcomes, including agency, belonging and delight, not only test scores."],
      ["Go further together", "One shared picture across all five programme areas; partners and coaches add data directly."],
      ["Listen and learn", "Learner, teacher and caregiver voices sit beside the numbers. Pause points are built in."],
      ["Redefine excellence", "Nothing counts until it has been checked. Donors see verified data only."],
      ["Do small things with great love", "Plain language, small forms, templates that work offline, and care for children's privacy."]
    ],
    people: [
      ["Learners", "To be seen as more than an exam score; to feel safe, heard and able to shape their learning", "North Star observations; anonymous, consented learner voice"],
      ["Caregivers", "To know what changes for their child", "Caregiver voices; event participation"],
      ["Teachers", "Tools that save time in large classes; follow-up after training", "InnovatED use at eight weeks, not just attendance"],
      ["School leaders and design teams", "To see whole-child practice spreading across the staff", "Adoption stage and North Star trends per school"],
      ["Fellows", "A clear standard, timely feedback, visible progress", "Sprint, milestone and feedback-turnaround tracking"],
      ["Coaches, Codifier, Associates, partners", "Fast data entry that doesn't duplicate reporting", "One Add data flow with templates and checks at entry"],
      ["M&E", "Consistent definitions, quality checks, an audit trail", "Automatic checks and a verify-or-return review queue"],
      ["Programs Manager and Director", "Early warning; cost against results; decisions at the right time", "Decision prompts from agreed rules; cost per teacher using the tool"],
      ["Donors and funders", "Honest, timely, verified results with sample sizes and stories", "A donor report built only from verified data"],
      ["County education offices and MoE", "Alignment with CBE; aggregate school data", "North Star outcomes mapped to CBE competencies"]
    ],
    insights: [
      "People leave training confident, but use drops in the eight weeks after. Confidence on the last day tells us little.",
      "Cheaper delivery can cost more per teacher who actually changes practice.",
      "Data errors are caught too late, often when a funder asks.",
      "Fellows' trust depends on clear standards and fast feedback as much as on content.",
      "The learner is the hardest person to see in the data, and the one who matters most."
    ],
    objectives: [
      ["One picture, child at the centre", "All five programme areas in one place, organised around the learner outcomes they serve."],
      ["Trust before display", "Every figure passes checks and carries its sample size and source before a donor sees it."],
      ["Data in from the field", "Short forms and CSV templates a coach or partner can fill on a phone."],
      ["Data to decisions", "Agreed rules turn data into prompts at planned pause points, with owners and dates."],
      ["Share honestly", "A donor view that shows verified data only, with stories used only with consent."],
      ["Protect children", "Aggregate figures only. No names, phone numbers or learner IDs (UPI, NEMIS, admission numbers)."]
    ],
    chain: [
      ["Leaders", "Fellows and school design teams lead whole-child design in their organisations"],
      ["Teachers and schools", "Whole-child practice and tools are used and embedded in routines and budgets"],
      ["Learners", "Agency, Belonging, Creativity, Delight and Expertise grow term on term"],
      ["Impact", "A world where leaders and learners thrive"]
    ],
    impact: [
      ["For learners", "Term on term, more lessons in partner schools where children show all five North Star outcomes, with the biggest gains where they start lowest."],
      ["For teachers and leaders", "Whole-child practice that is part of the school's routines, timetable and budget, not a pilot that ends with the programme."],
      ["For the system", "A Kenyan Whole Child Learning playbook built from real school journeys, shared through Knowledge Sharing Events."],
      ["For donors and partners", "Honest, verified reporting on time, with sample sizes, sources and children's voices used with care."]
    ],
    council: [
      ["Whole child learning and CBE", "Measure all five North Star outcomes and speak CBE's language", "North Star strip; outcomes mapped to CBE competencies"],
      ["M&E and data quality", "No number without its n, source and check", "Checks at entry, review queue, verified-only figures"],
      ["Child safeguarding and data protection", "Aggregate data only; no child identifiers; consent for every quote (Kenya Data Protection Act, 2019)", "Personal-data guard on uploads; consent required for voices"],
      ["Adult learning and leadership", "Track practice, not attendance", "Fellowship view built on Guskey's five levels"],
      ["Programme operations", "Decision rules agreed in advance, with owners and dates", "Pause and adapt prompts and a decision log"],
      ["Finance and value for money", "Judge cost against results", "Cost per teacher using the tool beside cost per completer"],
      ["Donor relations", "Funder-ready, honest, printable", "Donor report with generated sentences and a print layout"],
      ["UX and digital inclusion", "Works on a phone, in plain language, on low bandwidth", "Responsive layout, CSV templates, no heavy libraries"],
      ["Systems and policy", "Useful to counties and the Ministry", "County breakdowns and CBE mapping"]
    ]
  };

  return { version: 1, COUNTIES, TERMS, NORTH_STAR, PROGRAMS, SCHOOLS, STAGES, PILOT_STAGES, ROLES, DATASETS, DESIGN_MAP, seed };
})();
