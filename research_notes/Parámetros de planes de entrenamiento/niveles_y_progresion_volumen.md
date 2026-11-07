# Training-level classification, safe weekly volume progression, and peak volume / long run by race distance

Evidence strength labels used below: **[RCT]** randomised trial; **[Cohort]** prospective observational; **[MA]** meta-analysis/meta-regression; **[Plan-analysis]** quantitative analysis of published plans; **[Framework]** expert consensus framework; **[Coaching]** coaching texts or secondhand summaries (consensus, not evidence); **[Inference]** my own derivation, not sourced.

## 1. Which objective markers classify training status, and what are the thresholds?

### Takeaway
The only widely cited, published framework is McKay et al. 2022 (IJSPP), with six tiers (0 to 5). It is anchored on training frequency and purpose (Tiers 0 to 2) and on competition level (Tiers 3 to 5), **not** on hours/week or CTL. The only hard numeric training threshold I could confirm is "about 3 sport-specific sessions per week" for Tier 2. Any hours/week or CTL cut-offs for software would be design choices, not published evidence.

### Cited Findings
- McKay AKA, Stellingwerff T, Smith ES, Martin DT, Mujika I, Goosey-Tolfrey VL, Sheppard J, Burke LM. "Defining Training and Performance Caliber: A Participant Classification Framework." IJSPP 2022;17(2):317-331, doi 10.1123/ijspp.2021-0451. The tiers are 0 Sedentary, 1 Recreationally Active, 2 Trained/Developmental, 3 Highly Trained/National Level, 4 Elite/International Level, 5 World Class. Classification uses both training volume and performance metrics. **[Framework]** — [ACU Research Bank](https://acuresearchbank.acu.edu.au/item/8x9v7/defining-training-and-performance-caliber-a-participant-classification-framework); [ResearchGate](https://www.researchgate.net/publication/357409683_Defining_Training_and_Performance_Caliber_A_Participant_Classification_Framework)
- Tier 2 (Trained/Developmental): trains in a specific sport **about 3 times per week**, trains with the purpose of competing, and aims to compete at local level. **No performance or competition standard is required.** Papers citing the framework put Tier 2 at roughly 12-19% of the global population. **[Framework]** — [Burke et al. 2025 review citing McKay](https://forening.sls.se/media/hsyk10q4/burke-et-al-2025-1.pdf); [ResearchGate figure](https://www.researchgate.net/figure/Graphical-representation-of-the-interaction-between-the-Participant-Classification_fig1_357409683)
- The framework is meant for prospective participant recruitment and for retrospective classification in systematic reviews. It includes sport-specific adaptations (masters, junior, Paralympic). **[Framework]** — [AMiner abstract](https://www.aminer.org/pub/61cedeef5244ab9dcb578b37/defining-training-and-performance-caliber-a-participant-classification-framework)
- Proxies for training status from injury cohorts. In ProjectRun21 (n=784), runners covering **<15 km/week** and/or running slower than **6 min/km** may sustain more running-related injuries than their counterparts (estimates not statistically significant). **[Cohort]** — [Damsted et al. / RUNSAFE](https://runsafe.au.dk/display/artikel/new-valuable-damsted-et-al-publication)
- Marathon cohort: weekly volume **<40 km/wk** was associated with slower finish times and **>65 km/wk** with faster ones. **[Cohort]** — Fokkema et al. 2020, Scand J Med Sci Sports, [Erasmus repository](https://repub.eur.nl/pub/127621)

### Inferences
Below is a proposed mapping from 8-12 weeks of logs to 5 app levels, aligned with McKay. The numeric cut-offs are **[Inference]**, apart from the ~3 sessions/week anchor.
- **L0 Novice / never trained** (McKay Tier 0): average below 1 session/week, or below about 60 min/week of endurance activity, over the last 8-12 weeks. Also applies if there is no history at all.
- **L1 Beginner** (Tier 1): 1-2.9 sessions/week, consistent in at least 50% of weeks. For running, typically below 15-20 km/week, the zone the Damsted cohort flagged as higher risk.
- **L2 Intermediate** (Tier 2): at least 3 sessions/week (the McKay anchor), sustained in at least 75% of weeks. For running, roughly 20-50 km/week.
- **L3 Advanced** (top of Tier 2 or Tier 3): at least 5 sessions/week. For running, roughly 50-90 km/week, matching the "middle" and "high" marathon plan bands of 65-90 km peak.
- **L4 Highly trained / elite** (Tiers 3-5): at least 6-7 sessions/week, often with 0-1 rest days. For running, above 90 km/week, matching the "high" plan band (mean peak 132 km, 6.8 runs/week; see section 3). McKay requires competition results for Tiers 3-5, so a volume-only app can only flag "highly trained", not "elite".
- **Consistency factor:** penalise one level when more than 25% of weeks in the window have 0 sessions. This rule is design judgement, not evidence.

### Gaps
- I could not retrieve McKay's Table 1 verbatim: the publisher and ACU pages returned 403. Exact wording for Tiers 0, 1, 3, 4 and 5 is therefore unverified. Recollection, unverified: Tier 0 does not meet WHO activity guidelines (150 min/week moderate); Tier 1 meets them; Tier 3 competes at national level; Tier 4 competes internationally; Tier 5 is a world-class medallist or record holder. Verify against the paper before hard-coding.
- No peer-reviewed source gives **CTL (TSS/day) thresholds** per level. Any CTL cut-off (for example, CTL below 20 for beginners or above 80 for highly trained) would be a coaching heuristic with no citation. I found none.
- No validated source gives "years of consistency" thresholds.

## 2. How fast can weekly volume increase per level? (10% rule, Nielsen 2014 and 2025, Damsted, ACWR)

### Takeaway
The evidence does **not** support a strict 10% weekly rule as protective. It does weakly support avoiding more than 20-30% increases over 2 weeks in novices. The strongest recent signal (2025, n=5,205) concerns the **single session**: a run more than 10% longer than the longest run in the previous 30 days raised overuse-injury rate by about 1.5-2.3×. Week-to-week ratios and ACWR were not positively associated. A planner should therefore cap **session-length spikes**, with weekly percentage caps as a secondary guardrail.

### Cited Findings
- **Buist et al. 2008 (AJSM) [RCT]:** n=532 novices preparing for a 4-mile (6.7 km) event. A graded 13-week programme following the 10% rule was compared with a standard 8-week programme. Injury incidence was **20.8% vs 20.3%**, so the graded programme was not preventive. Injury was defined as a complaint restricting running for at least 1 week. Limitation: low distances only. — [PEDro record](https://search.pedro.org.au/search-results/record-detail/20220); [BJSM summary](https://bjsm.bmj.com/content/43/2/155)
- **Nielsen et al. 2014 (JOSPT 44(10):739-747) [Cohort]:** n≈874 novices followed for 1 year, with 202 injuries. Groups were based on weekly-distance change over 2 weeks: below 10%, 10-30%, above 30%. Overall injury showed **HR 1.59 (95% CI 0.96-2.66, p=0.07)** for above 30% vs below 10%, which was not significant. Novices progressing more than 30% appeared more vulnerable to **distance-related** injuries (for example patellofemoral pain, ITB syndrome, plantar fasciitis). The authors advise progressing by less than 30% per week over a 2-week period. — [AAU portal](https://vbn.aau.dk/da/publications/excessive-progression-in-weekly-running-distance-and-risk-of-runn); [JOSPT patient page PDF](https://www.orthobethesda.com/wp-content/uploads/2020/06/jospt-running-increased-mileage.pdf)
- Nielsen & Cederholm GPS pilot (n=60): increases above about 30% per week may become deleterious. Some individuals may tolerate 20-25% for short periods. **[Cohort, small]** — [RUG portal](https://research.rug.nl/en/publications/can-gps-be-used-to-detect-deleterious-progression-in-training-vol/)
- **Damsted et al. (ProjectRun21, JOSPT 2019) [Cohort]:** n=261 half-marathon trainees over 14 weeks, with 21.5% injured. At **day 21**, significantly more runners were injured when increasing weekly distance by **20-60%** than by ≤20%. There was no significant difference at days 56 and 98. Which training schedule a runner followed did not modify the effect. — [RUNSAFE news](https://runsafe.au.dk/display/artikel/a-new-study-on-training-load-in-half-marathon-runners); [USC record](https://research.usc.edu.au/esploro/outputs/journalArticle/The-Association-Between-Changes-in-Weekly/99451353502621)
- **Frandsen et al. 2025 (BJSM 59:1203-1210, Garmin-RUNSAFE; Nielsen co-author) [Cohort]:** n=5,205 runners, 588,071 sessions over 18 months. Median experience was 9.5 years and mean age 45.8. Each session's distance was compared with the longest run in the previous 30 days. Reference: regression or increase ≤10%. Adjusted overuse-injury HRR were:
  - small spike (>10-30%): **1.64** (95% CI 1.31-2.05)
  - moderate spike (>30-100%): **1.52** (1.16-2.00)
  - large spike (>100%): **2.28** (1.50-3.48)

  Week-to-week ratio showed no association (HRR 0.88-0.97, not significant). ACWR showed an *inverse* association (large: 0.75, 0.59-0.96). The authors recommend avoiding single sessions more than 10% above the 30-day longest run. They note that increases of 1-10% still carry some (non-significant) risk, that cumulative within-week increases may still be excessive, and that RCTs are needed. — [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110); [BJSM blog](https://blogs.bmj.com/bjsm/?p=11751)
- Caveat: researchers can explain only about 10-15% of running injuries. The claim that single sessions cause most injuries is a hypothesis. — [Outside summary](https://run.outsideonline.com/training/injuries-and-prevention/a-single-run-could-put-you-at-risk-for-an-overuse-injury-a-new-study-suggests/?scope=anon)
- **ACWR:** Gabbett 2016 (BJSM) popularised an ACWR "sweet spot" of **0.8-1.3**, with risk rising above about 1.5. **[Cohort, team sports]** Lolli et al. showed **mathematical coupling**: the acute week is part of the chronic average, which inflates correlations. They proposed an uncoupled ACWR, and Windt & Gabbett 2018 acknowledged the issue. In elite soccer and pentathlon data, most injuries occurred inside the presumed safe zone. Impellizzeri et al. 2020 documented further methodological flaws. — [Sports Injury Bulletin](https://www.sportsinjurybulletin.com/the-acutechronic-workload-ratio-science-or-religion/); [USQ: mathematical coupling](https://research.usq.edu.au/item/q53y9/is-it-all-for-naught-what-does-mathematical-coupling-mean-for-acute-chronic-workload-ratios); [Frontiers Physiol 2020](https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2020.01034/pdf); [BJSM 53/16/988](https://bjsm.bmj.com/content/53/16/988)
- Published marathon plans already progress slowly. Mean build-up is **+5±3%/week** in high-volume plans, **+7±3%** in middle plans and **+9±4%** in low-volume plans, which is about +2-3 km/week in absolute terms. **[Plan-analysis]** — [Knopp et al. 2024, Sports Med Open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/)

### Inferences
Planner rules. All are **[Inference]** built from the findings above.
- **Hard rule (all levels):** no planned session may be more than 10% longer than the longest run in the last 30 days. This is the strongest evidence available (Frandsen 2025). If the 30-day history is empty, start from a conservative baseline instead of comparing.
- **Weekly cap by level:**
  - L0-L1: 10-20% per week. Keep the 2-week cumulative increase below 30% (Nielsen 2014) and avoid any jump of 20% or more in the first 3 weeks of a new block (Damsted).
  - L2: up to 10-15% per week.
  - L3-L4: 5-10% per week, matching the 5-7% in high-volume plans. Absolute increments are large at high volume, so cap at about +5-8 km/week.
- **Absolute floor for beginners:** allow +2-5 km/week even if that is more than 10%. At very low volume, percentages are meaningless, and Buist found no benefit from the stricter 10% rule at short distances.
- **Recovery weeks:** schedule one every 3-4 weeks. This is a coaching convention I did not source here.
- **ACWR:** if used at all, use it only as a soft display metric (uncoupled, about 0.8-1.3). Never use it as a gate, given the coupling critique and its inverse association in the 2025 running data.

### Gaps
- No RCT compares weekly progression rates in *trained* runners. Recommendations for L3-L4 are extrapolated from plan analyses and cohorts.
- Evidence is running-only. I found no equivalent data for cycling or swimming.
- The source for recovery-week frequency (3:1 or 2:1) was not verified in this session.

## 3. Peak weekly volume and long-run size by race distance and level; long run as a share of weekly volume

### Takeaway
The marathon is well quantified: Knopp 2024 analysed 92 plans. Peak-week volume is about 59 km for low-volume plans (target time about 4:30), about 76 km for middle plans (about 3:52) and about 133 km for high plans (about 3:15). The longest run is about 31-35 km in all three bands. The long run **does not scale with level**, so its share of weekly volume falls from about 46% to about 25% as volume rises. Coaching texts cap the long run at about 25-30% of weekly volume and/or 2.5-3 h. I could not verify sourced numbers for 5K, 10K or half-marathon plans in this session.

### Cited Findings
- **Knopp et al. 2024 (Sports Med Open), 92 sub-elite marathon plans [Plan-analysis].** Values cover the last 12 weeks, as mean ± SD.

  | Metric | Low (<65 km peak) | Middle (65-90 km) | High (>90 km) |
  |---|---|---|---|
  | Peak week (km) | 58.6±6.4 | 75.5±8.5 | 132.5±34.5 |
  | Mean weekly (km) | 42.9±14.1 | 58.5±17.9 | 107.7±38.4 |
  | Longest run (km) | 30.9±4.1 | 32.5±3.8 | 35.2±3.3 |
  | Avg weekly long run (km) | 19.9 | 23.0 | 27.4 |
  | Runs/week | 4.1±0.9 | 4.9±0.9 | 6.8±1.4 |
  | Rest days/week | 2.0 | 1.3 | 0.1 |
  | Plan length (weeks) | 18.9 | 17.8 | 17.2 |
  | Peak week (weeks before race) | 3.6 | 4.0 | 4.4 |
  | Taper, peak to race week | −31% | −28% | −22% |
  | Final week vs previous week | about −50% | about −54% | about −46% |
  | Median target time | 4:30 | 3:52 | 3:15 |

  Plan lengths ranged from 12 to 30 weeks. — [PMC11065819](https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/)
- Long-run share computed from those means is about **46% (low), 39% (middle) and 25% (high)** of mean weekly volume. This is a derived figure, not reported by the paper. — derived from [Knopp 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/)
- **Doherty et al. 2020 (J Sci Med Sport 23(2):182-188) [MA]:** 85 studies covering 137 cohorts. Average weekly distance, number of weekly runs, peak weekly distance, number of runs of 32 km or more, longest run, training pace and weekly hours were **each negatively associated with marathon finish time** (univariate meta-regressions, R² 0.38-0.81, p<0.001). The non-finisher rate was 7.27%. The results are associations, and the abstract gives no per-variable coefficients. — [LIDA record](https://lida.sport-iat.de/ta/Record/4058441); doi 10.1016/j.jsams.2019.09.013
- **Fokkema et al. 2020 [Cohort]:** weekly volume below 40 km was associated with a slower marathon finish, and above 65 km with a faster one. — [Erasmus](https://repub.eur.nl/pub/127621)
- **Pfitzinger, *Advanced Marathoning* [Coaching]:**
  - Plan names give peak miles per week: 18/55 ≈ 88 km, 18/70 ≈ 113 km, 18/85 ≈ 137 km.
  - In the 55-70 mpw plans, the long run builds from 15 to about 20-22 miles (32-35 km). A midweek medium-long run of about 11-12 miles is included.
  - Suggested entry baselines: 40-45 mpw before 18/55, 55-60 mpw before 18/70, 65-70 mpw before 18/85.

  These figures come from blog summaries, not the book. — [RunningWithRock](https://runningwithrock.com/pfitz-marathon-training-explained/); [ctyeh analysis](https://ctyeh.com/articles/2754?lang=en)
- **Daniels [Coaching]:** sources quote the long-run cap inconsistently:
  - the lesser of 25% of weekly mileage or 150 min
  - 20-25% of weekly volume
  - 25-30% of weekly mileage
  - a 2.5 h / 22 mile cap

  — [RunningAhead forum](https://www.runningahead.com/forums/post/e989f57406784efdabd375505274c770); [Athletics Weekly](https://athleticsweekly.com/?p=45900); [SupWell](https://www.supwell.com/supbeat/3-theories-on-how-long-the-marathon-long-run-should-be)
- **Hansons Marathon Method [Coaching]:** the long run is at most 25-30% of weekly mileage and capped at **16 miles (about 26 km)**. Part of the reason for the cap is to avoid runs over about 3 h. — [Luke Humphrey (Hansons coach)](https://lukehumphreyrunning.com/hansons-marathon-method-the-16-miler/); [Marathon Handbook](https://marathonhandbook.com/hansons-marathon-method/)
- ProjectRun21 half-marathon runners self-selected one of three 14-week schedules. Exact schedule volumes were not retrieved. — [Design paper](https://researchportal.lih.lu/en/publications/design-of-projectrun21-a-14-week-prospective-cohort-study-of-the-/)

### Inferences
Marathon rules derived from Knopp 2024 and the coaching texts. All are **[Inference]**.

| Level | Peak km/week | Longest run | Runs/week | Plan length |
|---|---|---|---|---|
| L1 | 50-60 | 29-32 km | 4 | 18-20 weeks |
| L2 | 65-80 | 30-33 km | 5 | 16-18 weeks |
| L3 | 80-110 | 32-35 km | 6 | 16-18 weeks |
| L4 | 110-160 | 35 km | 7 or more, including doubles | 16-18 weeks |

- **Long-run cap:** use min(30% of the week's volume, 3 h, the 30-day longest run +10%). For L1, relax the percentage to about 40-45%, since low-volume plans run at about 46% in practice. Never exceed 3 h for L1-L2, following the Hansons and Daniels time caps.
- **Taper:** peak 3-5 weeks before race day. Reduce volume by about 20-30% by race week, with about −50% in the final week.
- **Race distances below the marathon:** these are **not sourced in this session**. Rough coaching heuristics only, to be verified against Daniels, Higdon and Pfitzinger's *Faster Road Racing* before use:

  | Race | Beginner (km/week) | Advanced (km/week) | Long run |
  |---|---|---|---|
  | 5K | 15-25 | 50-80 | |
  | 10K | 20-35 | 60-90 | 12-18 km |
  | Half marathon | 30-45 | 70-100 | 16-22 km, sometimes slightly over race distance |

### Gaps
- I could not fetch Hal Higdon's Novice 1 page (404). Recollection, unverified: 18 weeks, 4 runs/week, peak about 40 mpw, longest run 20 mi.
- No peer-reviewed analysis of 5K, 10K or half-marathon plan volumes comparable to Knopp 2024 was found in this session.
- Daniels' exact long-run rule is quoted inconsistently, so check *Daniels' Running Formula* directly.
- Multisport distances (70.3, Ironman, cycling) were not covered.

## 4. Sessions per week by level, and how much to add when increasing frequency

### Takeaway
Frequency anchors exist. McKay sets about 3 sessions/week for "trained". In marathon plans, runs per week scale from about 4 (low volume) to 5 (middle) to 7 (high), with average run length rising from about 10.6 to 16.5 km. I found no direct evidence on how fast to add sessions.

### Cited Findings
- About 3 sport-specific sessions/week defines McKay Tier 2. **[Framework]** — [Burke et al. 2025 citing McKay](https://forening.sls.se/media/hsyk10q4/burke-et-al-2025-1.pdf)
- Marathon plans by volume band [Plan-analysis] — [Knopp 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/):

  | Band | Runs/week | km/run | Rest days/week |
  |---|---|---|---|
  | Low | 4.1±0.9 | 10.6 | 2.0 |
  | Middle | 4.9±0.9 | 11.8 | 1.3 |
  | High | 6.8±1.4 | 16.5 | 0.1 |

- Number of weekly runs was negatively associated with marathon finish time in the Doherty 2020 meta-regression. **[MA]** — [LIDA record](https://lida.sport-iat.de/ta/Record/4058441)
- Frandsen 2025: risk is tied to the length of individual sessions relative to the 30-day maximum. Spreading volume over more, shorter sessions therefore avoids the risky spike category. **[Cohort]** — [PMC12421110](https://pmc.ncbi.nlm.nih.gov/articles/PMC12421110)

### Inferences
All are **[Inference]**.
- Default sessions/week: L0 2-3 (run-walk), L1 3-4, L2 4-5, L3 5-6, L4 6-7 or more, with doubles allowed.
- Add **at most 1 session/week per 2-4 weeks**. A new session should be short: no longer than the user's current average easy run, about 20-30 min. Total weekly volume must still respect the weekly percentage cap from section 2.
- Prefer adding frequency over lengthening sessions to reach a volume target. This keeps every session under the "30-day longest +10%" rule.

### Gaps
- No study was found that directly tests rates of frequency progression or injury when adding sessions.
- Data comes almost entirely from running. Multisport frequency norms were not researched.
