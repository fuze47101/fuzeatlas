// @ts-nocheck
/**
 * Red Rover — REAL DATA LOAD (Phase 2, Track 1).
 *
 * Source of truth: deliverables/Red_Rover_Dossier_Notes.md (Outlook crawl,
 * andrew@fuze47.com). Shared by /api/cron/enrich-red-rover and the local
 * runner scripts/enrich-red-rover.ts so prod + local can't drift.
 *
 * Per target: overwrite the dossier fields + set the correct stage/tier,
 * upsert contacts (by target+name) with side/role, and append the activity
 * timeline (one entry per dated bullet, deduped by target+occurredAt+body).
 *
 * GUARD — POLYGIENE IS INDEPENDENT (Polygiene AB, Sweden). The dossier notes
 * (line 206) confirm the old "Sanitized/HeiQ owns Polygiene" claim is WRONG.
 * Polygiene's record here carries ZERO HeiQ/Sanitized-ownership text; its
 * companyClass + intel are overwritten to remove the Phase-1 "under HeiQ
 * Group" stub, and the FFL failure lever is stated brand-neutrally.
 */

export type EContact = {
  name: string;
  title?: string;
  email?: string;
  side: "TARGET" | "FUZE";
  role: "NEGOTIATION" | "TECHNICAL_GATEKEEPER";
  notes?: string;
};
export type EActivity = { date: string; type: string; body: string };
export type ETarget = {
  name: string; // must match the seeded target name (or new for TenCate)
  createIfMissing?: { rank: number; tier: string; geo: string; companyClass: string };
  stage?: string;
  tier?: string;
  companyClass?: string;
  geo?: string;
  fields?: Record<string, string | null>;
  contacts?: EContact[];
  activities?: EActivity[];
};

export const ENRICH: ETarget[] = [
  // ─────────────────────────────── ARCHROMA ──────────────────────────────
  {
    name: "Archroma",
    stage: "AGREEMENT",
    tier: "TIER1",
    fields: {
      initialContact:
        "Aug 24, 2023 — Roland Borufka (Reinach, Switzerland), 'Fuze product paperwork.'",
      keyMeetings:
        "May 27 2024 signed agreement (Roland Borufka); Sep 19 2024 Georg Lang 'RE: Agreement'; Nov 7 2024 Paul Cowell 'RE: Fuze technology'; Aug 2025 Rudolf–Sanitized follow-up + Roland agrees to meet; Nov 5 2025 'FUZE Catchup'; Jan 12 2026 follow-up (Nike supply urgency).",
      currentAgreements:
        "Signed FUZE–Archroma distribution agreement (2024, Dave Parkinson-approved).",
      currentStatus:
        "Warm but STALLED — awaiting Archroma's engagement decision. The Rudolf–Sanitized exclusive deal left Archroma (Sanitized's prior distributor) without an antimicrobial → the opening for FUZE. Andrew pushing Roland Borufka directly; Nike launch (Jan 2026) = supply urgency. Georg Lang's departure slowed the Archroma side.",
      nextStep:
        "Re-engage Roland Borufka; open the May 27 2024 signed-agreement thread to confirm scope/terms; convert 'our little project' into a live distribution SKU ahead of the Nike supply need.",
      whoDroveIt:
        "Andrew (relationship + all follow-ups); Dave Parkinson (agreement approval); Roland Borufka = live Archroma-side owner.",
      intel:
        "Levers: (1) Rudolf–Sanitized deal left Archroma without an antimicrobial → FUZE fills it; (2) Bob Monticello + Jim Krueger (ex-Sanitized quaternary developers) independently validated FUZE at the facility; (3) Bluesign partnership resolved; (4) Nike launch = supply urgency. Archroma was Polygiene's distributor in Colombia/Peru historically. EU biocide 2028/2030 catalyst. Munich-reachable.",
    },
    contacts: [
      { name: "Roland Borufka", title: "Archroma — Reinach, Switzerland", email: "roland.borufka@archroma.com", side: "TARGET", role: "NEGOTIATION", notes: "Live Archroma-side owner." },
      { name: "Georg Lang", title: "Archroma (LEFT the company, Aug 2025)", email: "georg.lang@archroma.com", side: "TARGET", role: "NEGOTIATION", notes: "Departure slowed the Archroma side." },
      { name: "Paul Cowell", title: "Connector / agent", email: "cowell.paul@ymail.com", side: "FUZE", role: "NEGOTIATION", notes: "Shared connector into Transfar AND Archroma." },
    ],
    activities: [
      { date: "2023-08-24", type: "EMAIL", body: "First contact: 'Fuze product paperwork' (Roland Borufka). Initial engagement." },
      { date: "2024-05-27", type: "MILESTONE", body: "'RE: Signed agreement' (Roland Borufka) — the signed FUZE–Archroma distribution agreement (Dave Parkinson-approved)." },
      { date: "2024-09-19", type: "EMAIL", body: "Georg Lang 'RE: Agreement' (flagged, attachment)." },
      { date: "2024-11-07", type: "EMAIL", body: "Paul Cowell 'RE: Fuze technology.'" },
      { date: "2025-08-09", type: "EMAIL", body: "Andrew → Georg + Roland: 'Follow-Up on Recent Rudolf–Sanitized Agreement.' Flags Bob Monticello + Jim Krueger termination + FUZE validation; wants to meet re moving forward." },
      { date: "2025-08-11", type: "MEETING", body: "Roland: 'Georg has left the company'; still based in Reinach; agrees to meet." },
      { date: "2025-11-05", type: "MEETING", body: "'FUZE Catchup' (Andrew → Roland)." },
      { date: "2026-01-12", type: "EMAIL", body: "Andrew → Roland: follow-up — large Nike launch this month, critical to have supply engaged; asks whether to keep pushing current distribution channels." },
    ],
  },

  // ─────────────────────────────── TRANSFAR ──────────────────────────────
  {
    name: "Transfar",
    stage: "TESTING",
    tier: "TIER1",
    fields: {
      initialContact: "6/4/2026 — 'FUZE + Transfar Pitch Deck' sent (via Paul Cowell).",
      keyMeetings:
        "6/17 EPA/SDS/TDS to Henry Wang; 7/17 Ryan 'next steps' (5L sample arrived); 7/20 Henry selected 100% cotton + 100% polyester woven for testing; 7/27 Henry technical Qs; 7/28 Josh introduced; 7/29 Ryan's detailed answers (dyebath, 130°C/30min, pricing).",
      currentAgreements: null,
      currentStatus:
        "Active technical evaluation, very warm. Transfar ('FTP F1') running application trials on cotton + polyester woven from the 5L samples; pricing + dyebath application answered ($36/kg 30ppm ≈ RMB 250/kg landed China); Tandy Xia to structure volume/program terms; strategy call being scheduled; Josh introduced.",
      nextStep:
        "Hold the strategy call; Tandy Xia to structure volume/program terms; support Transfar's cotton + polyester trials. Asia (Shanghai) leg.",
      whoDroveIt:
        "Ryan Prince (Director of BD — technical dialogue) + Tandy Xia (Director of China — volume/program); Andrew, Scott Pace, Josh Lujan CC'd (Josh looped in).",
      intel:
        "World's-largest textile-chemical distributor, already testing. FUZE F1 added to the dyebath with the dye (exhaust; preferred for polyester at the heated/pressurized stage; not with softener/rinse); stable 130°C/30 min. Paul Cowell = shared connector (also Archroma). Asia (Shanghai) leg with Hi-Goal.",
    },
    contacts: [
      { name: "Henry Wang", title: "王军华 — technical evaluator / main correspondent", email: "028897@etransfar.com", side: "TARGET", role: "NEGOTIATION" },
      { name: "Paul Cowell", title: "Connector / agent", email: "cowell.paul@ymail.com", side: "FUZE", role: "NEGOTIATION", notes: "Shared connector into Transfar AND Archroma." },
      { name: "Ryan Prince", title: "Director of BD, FUZE", email: "ryan.prince@fuze47.com", side: "FUZE", role: "NEGOTIATION", notes: "Runs the technical dialogue." },
      { name: "Tandy Xia", title: "Director of China, FUZE", side: "FUZE", role: "NEGOTIATION", notes: "To structure volume/program terms." },
    ],
    activities: [
      { date: "2026-06-04", type: "EMAIL", body: "'FUZE + Transfar Pitch Deck' sent (to Paul Cowell)." },
      { date: "2026-06-05", type: "EMAIL", body: "Andrew 'FW: Business for Transfar' (high-level)." },
      { date: "2026-06-17", type: "EMAIL", body: "'EPA, SDS, TDS re: Fuze x Transfar' sent to Henry Wang." },
      { date: "2026-07-17", type: "MILESTONE", body: "Ryan 'Transfar + FUZE next steps': 5L FUZE sample shipment arrived; requests a strategy call." },
      { date: "2026-07-20", type: "MILESTONE", body: "Henry Wang: samples received; selected 100% cotton woven + 100% polyester woven for testing." },
      { date: "2026-07-27", type: "EMAIL", body: "Henry Wang: technical questions (dyebath compatibility, 130°C/30min stability, China price, packaging)." },
      { date: "2026-07-28", type: "MEETING", body: "'Introduction to Josh Lujan' — Josh formally introduced to Transfar / Paul Cowell." },
      { date: "2026-07-29", type: "EMAIL", body: "Ryan's detailed answers: FUZE F1 in dyebath with the dye; stable 130°C/30 min; $36/kg (30ppm) ≈ RMB 250/kg landed China; Tandy Xia to structure volume/program." },
    ],
  },

  // ─────────────────────────────── POLYGIENE ─────────────────────────────
  // GUARD: INDEPENDENT (Polygiene AB, Sweden). No HeiQ/Sanitized ownership.
  {
    name: "Polygiene",
    stage: "TESTING",
    tier: "TIER1",
    companyClass: "Antimicrobial brand-owner (Polygiene AB, Sweden — independent; StayFresh / ViralOff)",
    geo: "Sweden",
    fields: {
      initialContact:
        "3/5/2024 — Dominic Hammann, Polygiene marketing-coop thread. Technical engagement began ~7/20/2026 on the intro call with Henry Krause + team.",
      keyMeetings:
        "~7/20/2026 intro call (Henry Krause 'Global Technical' + team); 7/28–7/29 active technical screen — Andrew sent the dilution worksheet / SDS / third-party reports; Henry asked re EPA label (0.002% vs 30ppm), $36/kg (list vs white-label), difficult fabrics, mixing-tank, and a rival chitosan (FFL) fouling concern — Andrew answered all.",
      currentAgreements: null,
      currentStatus:
        "Active, warm — Henry Krause (Global Technical Director) personally running the first technical screen. Andrew delivering primary data (worksheet/SDS/reports) for his review. Polygiene AB is INDEPENDENT (Sweden) — a standalone brand-owner.",
      nextStep:
        "Complete Henry Krause's technical screen; recommend F2 0.75 mg/kg on ASTM E2149 (F1 1.0 for AATCC 100 / ISO 20743); progress to a full presentation + evaluation support.",
      whoDroveIt:
        "Andrew (technical lead — met Henry + team on the call); Ryan Prince, Scott Pace, Josh Lujan CC'd (Josh in the loop).",
      intel:
        "INDEPENDENT — Polygiene AB, Sweden; a standalone brand-owner. Levers: a rival chitosan finish (FFL) was a market disaster (film-forming, gummed equipment; mills in Central America + China refused it; brands billed for damages) — FUZE is ~30 ppm trace metamaterial, ~1 cP, non-film-forming, one-time monolayer adsorption, no fouling. Henry raised the 2030 BPR review + brand sentiment on silver himself → the EU-biocide lever is live; FUZE counter = non-ionic non-leaching allotrope, single source, 58 patents, E2149 story.",
    },
    contacts: [
      { name: "Henry Krause", title: "Global Technical Director, Polygiene AB", email: "henrynk@gmail.com", side: "TARGET", role: "TECHNICAL_GATEKEEPER", notes: "'Henry K' — personally running the first technical screen." },
      { name: "Dominic Hammann", title: "Prior marketing-coop contact / connector", side: "TARGET", role: "NEGOTIATION", notes: "3/5/2024 Polygiene marketing-coop thread." },
    ],
    activities: [
      { date: "2024-03-05", type: "EMAIL", body: "Dominic Hammann — Polygiene marketing-coop thread ('Advanced Odor… big marketing coop')." },
      { date: "2026-07-20", type: "MEETING", body: "Intro call — 'Henry Krause Global Technical' + team (technical screen kickoff)." },
      { date: "2026-07-28", type: "EMAIL", body: "Active technical screen: Andrew sends dilution worksheet / SDS / third-party reports; Henry asks re EPA label, $36/kg list-vs-white-label, difficult fabrics, mixing-tank, and a rival chitosan (FFL) fouling concern." },
      { date: "2026-07-29", type: "EMAIL", body: "Andrew answers all: FUZE ~30 ppm trace, ~1 cP, non-film-forming, no fouling; recipe F2 0.75 mg/kg on ASTM E2149, F1 1.0 for AATCC 100 / ISO 20743." },
    ],
  },

  // ───────────────────────────────── CHT ─────────────────────────────────
  {
    name: "CHT",
    stage: "CONTACTED",
    tier: "TIER1",
    fields: {
      initialContact:
        "Scott Pace originated CHT at ITMA 2023 (Milan) — first FUZE presentation. Then Andrew carried the 2023/24 German meetings with Robert Zyschka + Annabelle.",
      keyMeetings:
        "3/20/2024 Robert Zyschka 'Follow Up From Today's Meeting'; 2024–25 AATCC Textile Discovery Summit touchpoints; 7/22/2026 Viktor re-approach; 7/31/2026 Viktor + team met Birgit Holz + team to reintroduce FUZE (sent Atlas portal registration link).",
      currentAgreements: null,
      currentStatus:
        "Freshly reintroduced (7/31/2026), warm, early. CHT has Atlas portal access; next meeting week of Aug 18 for next steps toward a potential partnership. Ranked #1 per Andrew.",
      nextStep:
        "Reconnect week of Aug 18 to review + discuss the partnership shape (distribution vs co-development); confirm Birgit Holz's exact title/role.",
      whoDroveIt:
        "Credit chain: Scott Pace (origin, ITMA 2023) → Andrew (German meetings 2023/24) → Viktor Hristov / Akcel (2026 reintroduction).",
      intel:
        "NOT Joscha Teubert (Joscha = ex-Archroma talent, separate). Levers: the Akcel / Viktor relationship; AATCC network; EU 2028/2030 biocide catalyst; Munich / Performance Days reachable (Germany).",
    },
    contacts: [
      { name: "Birgit Holz", title: "CHT, Germany", side: "TARGET", role: "NEGOTIATION", notes: "Met 7/31/2026 to reintroduce FUZE; exact role TBD." },
      { name: "Viktor Hristov", title: "Akcel Group rep — runs the 2026 reintroduction", side: "FUZE", role: "NEGOTIATION", notes: "415-867-2432." },
      { name: "Robert Zyschka", title: "CHT — 2023/24 German meetings", side: "TARGET", role: "NEGOTIATION", notes: "3/20/2024 'Follow Up From Today's Meeting.'" },
    ],
    activities: [
      { date: "2023-06-01", type: "MILESTONE", body: "Scott Pace originated CHT contact + delivered the first FUZE presentation at the ITMA show (Milan, ~2023)." },
      { date: "2024-03-20", type: "MEETING", body: "Robert Zyschka 'Follow Up From Today's Meeting' — confirms the German meeting." },
      { date: "2026-07-22", type: "EMAIL", body: "Viktor 'Fw: FUZE. The Chemistry That Changes…' (re-approach)." },
      { date: "2026-07-31", type: "MEETING", body: "Viktor + team met Birgit Holz + team to reintroduce FUZE; sent the Fuze Atlas portal registration link; proposed reconnecting week of Aug 18." },
    ],
  },

  // ─────────────────────────────── SANITIZED ─────────────────────────────
  {
    name: "Sanitized",
    stage: "AGREEMENT",
    tier: "TIER1",
    fields: {
      initialContact:
        "6/4/2026 — Andrew 'Thoughts' to Lee Howarth (internal Sanitized champion).",
      keyMeetings:
        "6/30 internal review — positive initial feedback → NDA proposed; 7/3 Lee sends Sanitized's standard mutual NDA; 7/6–7/7 NDA EXECUTED (DocuSign, Thomas Semling 'Completed'); 7/24 Ryan introduces Josh to Lee.",
      currentAgreements:
        "Mutual NDA EXECUTED via DocuSign 7/6–7/7/2026 (Thomas Semling 'Completed') — evaluation of FUZE by Sanitized AG via lab testing of samples + analysis of related technical data, for textile + polymer applications.",
      currentStatus:
        "NDA in place; positive internal review; advancing to detailed technical discussions + a second review meeting + Sanitized lab-testing FUZE samples. Ahead of the 'CONTACTED' it was originally booked at.",
      nextStep:
        "Confirm the second-review-meeting date; support Sanitized's lab testing of FUZE samples; clarify roles of Mueller / Zihlmann / Semling (technical vs legal vs management).",
      whoDroveIt:
        "Andrew (direct); Ryan Prince; Josh Lujan (introduced to Lee 7/24). Internal champion: Lee Howarth.",
      intel:
        "Levers: internal champion (Lee Howarth, inside Sanitized); ex-Sanitized quaternary developers (Bob Monticello + Jim Krueger) already validated FUZE at the facility; Sanitized sidelined by the Rudolf exclusive-distribution switch (receptivity); 58-patent single-source open-book pitch; EU 2028/2030 biocide catalyst; Munich-reachable.",
    },
    contacts: [
      { name: "Lee Howarth", title: "Head Brand Marketing / BU Textiles, SANITIZED AG — internal champion / lead-in", email: "lee.howarth@sanitized.com", side: "TARGET", role: "NEGOTIATION", notes: "Inside Sanitized, championing FUZE — 'our way in.'" },
      { name: "Stefan Mueller", title: "Sanitized AG", email: "Stefan.Mueller@sanitized.com", side: "TARGET", role: "NEGOTIATION" },
      { name: "Urs Zihlmann", title: "Sanitized AG", email: "Urs.Zihlmann@sanitized.com", side: "TARGET", role: "NEGOTIATION" },
      { name: "Thomas Semling", title: "Sanitized AG — signed the NDA (DocuSign)", email: "Thomas.Semling@sanitized.com", side: "TARGET", role: "NEGOTIATION" },
      { name: "Bob Monticello", title: "Ex-Sanitized quaternary developer — validated FUZE at the facility", side: "FUZE", role: "TECHNICAL_GATEKEEPER", notes: "Sanitized contract terminated June 2025; visited FUZE, ran a full eval confirming claims." },
      { name: "Jim Krueger", title: "Ex-Sanitized quaternary developer — validated FUZE", side: "FUZE", role: "TECHNICAL_GATEKEEPER", notes: "Sanitized contract terminated June 2025; validated FUZE with Monticello." },
    ],
    activities: [
      { date: "2026-06-04", type: "EMAIL", body: "Andrew 'Thoughts' to Lee Howarth." },
      { date: "2026-06-30", type: "MEETING", body: "'Check in': Sanitized held an internal review — positive initial feedback; questions on IP, registration, performance scope, validation → NDA proposed." },
      { date: "2026-07-03", type: "EMAIL", body: "Lee sends Sanitized's standard mutual NDA (00_NDA two-sided_EN_Fuze_Technologies.docx)." },
      { date: "2026-07-07", type: "MILESTONE", body: "NDA EXECUTED via DocuSign (Thomas Semling 'Completed')." },
      { date: "2026-07-24", type: "MEETING", body: "Ryan 'Introduction to Josh Lujan' to Lee Howarth." },
    ],
  },

  // ─────────────────────────── KANEYO / KANEMATSU ────────────────────────
  {
    name: "Kaneyo / Kanematsu",
    stage: "CONTACTED",
    tier: "TIER2",
    fields: {
      initialContact: "5/26/2026 — Akio Uchida fabric-sample inquiry ('RE: Inquiry About Fuze Fabric Sample').",
      keyMeetings: "7/23/2026 Amon Yamaguchi onboarded to FUZE Atlas; 7/26 active 'SCTJ + FUZE' image/sample exchange.",
      currentAgreements: null,
      currentStatus:
        "Early Japan engagement across Kaneyo (Amon Yamaguchi), SCTJ, and Akio Uchida — trading-house / distribution-adoption theme, driven by Bryan Hyman.",
      nextStep:
        "Define the Japan distribution path; clarify SCTJ (entity/role) and whether Kaneyo is positioned as distributor or brand; confirm Kanematsu-group depth. Japan leg.",
      whoDroveIt: "Bryan Hyman (drives the Japan / SCTJ thread); Andrew + Scott Pace involved.",
      intel: "Kanematsu sogo shosha group (KANEYO CO., Osaka). Active 'SCTJ + FUZE' workstream. Japan trip leg.",
    },
    contacts: [
      { name: "Amon Yamaguchi", title: "KANEYO CO. (Kanematsu group)", email: "amon_yamaguchi@kwm.kanematsu.co.jp", side: "TARGET", role: "NEGOTIATION", notes: "FUZE Atlas access granted 7/23/2026." },
      { name: "Akio Uchida", title: "Japanese inquiry contact", side: "TARGET", role: "NEGOTIATION", notes: "5/26/2026 fabric-sample inquiry." },
      { name: "Bryan Hyman", title: "FUZE — drives the Japan / SCTJ thread", side: "FUZE", role: "NEGOTIATION" },
    ],
    activities: [
      { date: "2026-05-26", type: "EMAIL", body: "Akio Uchida: 'RE: Inquiry About Fuze Fabric Sample.'" },
      { date: "2026-07-23", type: "MILESTONE", body: "Amon Yamaguchi onboarded to FUZE Atlas ('Dear Mr. Andrew, thank you…')." },
      { date: "2026-07-26", type: "EMAIL", body: "Active 'SCTJ + FUZE' image/sample exchange." },
    ],
  },

  // ─────────────────────── RUDOLF (Duraner / Turkey) ─────────────────────
  {
    name: "Rudolf (Duraner/Turkey)",
    stage: "TESTING",
    tier: "TIER2",
    fields: {
      initialContact:
        "3/2–3/3/2023 — 'Fuze testing update'; Andrew praised Sergül Kaptan's trial results ('really nice work and fantastic').",
      keyMeetings:
        "4/25/2023 'Product reg. CHEMLEG' (Uğur); 5/11/2023 Teams/Zoom (Uğur); 1/30/2024 Sergül 'kind regards'; 3/13–14/2024 Esra Demirhan 'Turkey BPR process.'",
      currentAgreements: null,
      currentStatus:
        "Rudolf Duraner Turkey lab (Sergül Kaptan) VALIDATED FUZE in 2023 trials (optimized recipe: reduce AU to 0.5 ml, keep 2 ml AG). SRS (Uğur Sabuncu) pursued Turkey BPR registration via CHEMLEG. Hangup: Rudolf's textile method derives from surface-sanitizer testing (5–10 min kill) that non-leaching FUZE can't pass on that standard — an out-of-the-box path is required.",
      nextStep:
        "Resolve the surface-sanitizer test-standard blocker; confirm current state of the Turkey BPR filing; confirm Sergül is still at Rudolf Duraner.",
      whoDroveIt:
        "Andrew + Scott Pace (FUZE); Sergül Kaptan (Rudolf Duraner lab — certified validation); Uğur Sabuncu / SRS (funded registration); Esra Demirhan (BPR).",
      intel:
        "RESOLVES the 'Turkey lead scientist' = Sergül Kaptan. EU 2028/2030 biocide catalyst; Turkey/EU approval track. Munich-reachable (Germany/Turkey).",
    },
    contacts: [
      { name: "Sergül Kaptan", title: "Lab scientist — Rudolf Duraner, Turkey", email: "sergulk@rudolf-duraner.com.tr", side: "TARGET", role: "TECHNICAL_GATEKEEPER", notes: "Ran FUZE trials / lab validation in 2023; optimized recipe. Resolves the 'Turkey lead scientist' item." },
      { name: "Esra Demirhan", title: "Rudolf Duraner — ran the Turkey BPR filing (3/2024)", side: "TARGET", role: "TECHNICAL_GATEKEEPER" },
      { name: "Sadik Uğur Sabuncu", title: "SRS — drove product registration (CHEMLEG); funded Turkish testing", email: "ugur@srsus.com", side: "FUZE", role: "NEGOTIATION" },
    ],
    activities: [
      { date: "2023-03-03", type: "MILESTONE", body: "'Fuze testing update' — Andrew praises Sergül Kaptan's trial results; TDS/MSDS (AU + AG) exchange." },
      { date: "2023-04-25", type: "EMAIL", body: "'Product reg. CHEMLEG' (Uğur) — registration consultancy engaged." },
      { date: "2023-05-11", type: "MEETING", body: "Teams/Zoom meeting (Uğur)." },
      { date: "2024-01-30", type: "EMAIL", body: "Sergül 'kind regards' (relationship continues)." },
      { date: "2024-03-14", type: "MILESTONE", body: "Esra Demirhan 'Turkey BPR process' (regulatory push)." },
    ],
  },

  // ─────────────────────────────── MICROBAN ──────────────────────────────
  {
    name: "Microban",
    stage: "AGREEMENT",
    tier: "TIER1", // UPGRADE — President-level executed NDA + offtake
    fields: {
      initialContact: "10/16/2023 — Shaun Rothwell 'Microban/FUZE introduction' meeting.",
      keyMeetings:
        "11/14/2023 'Microban intro to EVOQ'; 11/17/2023 'Microban–Fuze discussion 2'; 11/20/2023 Michael Ruby's 6-step partnership plan; 11/21/2023 Microban NDA EXECUTED; 4/2/2024 'Samples for Microban' (James Clayton).",
      currentAgreements:
        "Microban NDA EXECUTED 11/21/2023 (President Michael Ruby — all requested modifications accepted, both-side legal review done). Proposed buy/sell OFFTAKE of FUZE's silver/gold pair for textile treatments (ideally post-Bluesign).",
      currentStatus:
        "Serious buy/sell OFFTAKE partnership proposed by Microban's President with an EXECUTED NDA (Nov 2023) — went quiet on Bluesign/EPA timing. RE-OPEN LEVER: FUZE now has federal + California EPA and Bluesign in progress — the exact gates Microban set are clearing. Shaun Rothwell = relationship owner; strong warm re-entry. Upgraded to Tier 1.",
      nextStep:
        "Re-engage Michael Ruby now that EPA is done; advance the MTA + offtake pricing (Microban offtake costs + volume/$ breakpoints); confirm where Bluesign stands.",
      whoDroveIt: "Shaun Rothwell (Chairman & CEO, EVOQ Nano) led it; Andrew on-thread.",
      intel:
        "6-step plan (Ruby, 11/20/2023): (1) NDA [done], (2) test data per yarn/fabric, (3) MTA for samples (no-binder + pre-blended with-binder) + ICP method, (4) Microban offtake costs + volume/$ breakpoints, (5) Bluesign timeline, (6) review → commercial launch, + 2 secondary interest areas. This is a President-level offtake deal — NOT a competitor lead. US talent anchor.",
    },
    contacts: [
      { name: "Michael Ruby", title: "President, Microban International Ltd.", email: "michael.ruby@microban.com", side: "TARGET", role: "NEGOTIATION", notes: "M: 704 924 0242. Champion; laid out the 6-step partnership plan." },
      { name: "Souvik Nandi", title: "Microban", email: "souvik.nandi@microban.com", side: "TARGET", role: "TECHNICAL_GATEKEEPER" },
      { name: "James Clayton", title: "Microban", email: "james.clayton@microban.com", side: "TARGET", role: "TECHNICAL_GATEKEEPER", notes: "'Samples for Microban' (4/2/2024)." },
      { name: "Ravi Rangarajan", title: "Microban", email: "ravi.rangarajan@microban.com", side: "TARGET", role: "TECHNICAL_GATEKEEPER" },
      { name: "Shaun Rothwell", title: "Chairman & CEO, EVOQ Nano — relationship owner", email: "Shaun@EvoqNano.com", side: "FUZE", role: "NEGOTIATION", notes: "801.367.9758. Led the Microban relationship." },
    ],
    activities: [
      { date: "2023-10-16", type: "MEETING", body: "Shaun Rothwell 'Microban/FUZE introduction' meeting." },
      { date: "2023-11-14", type: "MEETING", body: "'Microban intro to EVOQ.'" },
      { date: "2023-11-17", type: "MEETING", body: "'Microban–Fuze discussion 2' meeting." },
      { date: "2023-11-20", type: "MILESTONE", body: "Michael Ruby lays out a 6-step partnership plan (offtake of FUZE's silver/gold pair, ideally post-Bluesign)." },
      { date: "2023-11-21", type: "MILESTONE", body: "Microban NDA EXECUTED (Ruby: 'accepted all requested modifications… partially executed version for your countersignature')." },
      { date: "2024-04-02", type: "EMAIL", body: "'Samples for Microban' (James Clayton)." },
    ],
  },

  // ─────────────────────────── CONCEPT III / DryTex ──────────────────────
  {
    name: "Concept III",
    stage: "CONTACTED",
    tier: "TIER1",
    fields: {
      initialContact:
        "7/30/2026 — Akina Yeung (Rhone Materials Manager) intro to Concept III / DryTex for a Rhone fabric development using FUZE.",
      keyMeetings:
        "7/30/2026 Rhone → Concept III/DryTex intro; Rob Birn checking whether FUZE has run at DryTex before.",
      currentAgreements: null,
      currentStatus:
        "Live (7/30/2026): Rhone → Concept III / DryTex intro made. Next: confirm the dye house, connect a FUZE technical rep, DryTex requests Atlas Factory access, apply Rhone program pricing. DryTex = Concept III's mill in Shaoxing, China with its own in-house dye house (no outsourcing).",
      nextStep:
        "Ryan books the intro + Q&A; confirm the dye house; onboard DryTex to Atlas Factory access; apply Rhone program pricing; then expand from this one Rhone dev to Concept III's full book of repped mills (historically Polygiene-exclusive).",
      whoDroveIt:
        "Ryan Prince (onboarding, dye-house ID, Atlas access, Rhone pricing); Andrew; Josh ('exactly the foot in the door'); + Doris.",
      intel:
        "Intro vehicle: the Rhone development at DryTex ('Fuze X DryTex'). conceptiii.com. Historically Polygiene-exclusive → the strategic play is FUZE adoption across Concept III's whole book of repped mills. Ties to the Polygiene target. US leg.",
    },
    contacts: [
      { name: "Rob Birn", title: "Concept III Textiles Intl., Red Bank NJ", email: "rbirn@conceptiii.com", side: "TARGET", role: "NEGOTIATION", notes: "cell 732-673-7261." },
      { name: "Kim Walsh", title: "Concept III Textiles Intl.", email: "kwalsh@conceptiii.com", side: "TARGET", role: "NEGOTIATION" },
      { name: "Akina Yeung", title: "Materials Manager, Rhone — referrer/connector", email: "akina.yeung@rhone.com", side: "TARGET", role: "NEGOTIATION", notes: "Rhone (brand) — made the 7/30/2026 intro into Concept III / DryTex." },
    ],
    activities: [
      { date: "2026-07-30", type: "MILESTONE", body: "Rhone (Akina Yeung) → Concept III / DryTex intro made for a Rhone fabric development using FUZE at DryTex; Rob Birn checking whether FUZE has run at DryTex before." },
    ],
  },

  // ─────────────────────────────── HI-GOAL ───────────────────────────────
  {
    name: "Hi-Goal",
    stage: "AGREEMENT",
    tier: "TIER2",
    fields: {
      initialContact: "4/9/2026 — 'Antimicrobial Performance Testing' thread ('Hi Bob, great to hear from you…').",
      keyMeetings: "4/24 Andrew sends the Initial Term Sheet; 4/29 Shauna Ge 'thank you for drafting' + Andrew follow-up — term sheet in active negotiation.",
      currentAgreements: "Initial Term Sheet sent 4/24/2026, under active review / negotiation (Shauna Ge).",
      currentStatus:
        "Initial Term Sheet in negotiation (April 2026) + antimicrobial performance testing underway. Further along than 'existing distributor' — an active partnership / term-sheet deal. Shanghai; pairs with Transfar on the Asia leg.",
      nextStep:
        "Advance the term sheet to signature; identify 'Bob' on the testing thread; confirm Shauna Ge's title/role. Define the elevation plan.",
      whoDroveIt: "Andrew (drafted the term sheet); Danny / Tina (distributor relationship).",
      intel: "Active distributor being elevated (Shanghai HiGoal factory testing). Asia (Shanghai) leg with Transfar.",
    },
    contacts: [
      { name: "Shauna Ge", title: "Hi-Goal", side: "TARGET", role: "NEGOTIATION", notes: "Term sheet under active review." },
      { name: "Bob", title: "Antimicrobial performance testing contact", side: "TARGET", role: "TECHNICAL_GATEKEEPER", notes: "4/9/2026 testing thread." },
    ],
    activities: [
      { date: "2026-04-09", type: "EMAIL", body: "'Antimicrobial Performance Testing' ('Hi Bob, great to hear from you…')." },
      { date: "2026-04-24", type: "MILESTONE", body: "Andrew sends the Initial Term Sheet ('Hi Shauna, please review…')." },
      { date: "2026-04-29", type: "EMAIL", body: "Shauna Ge: 'Thank you for drafting…'; Andrew follow-up — term sheet under active review/negotiation." },
    ],
  },

  // ─────────────────────────────── MILLIKEN ──────────────────────────────
  {
    name: "Milliken",
    stage: "CONTACTED",
    tier: "TIER2",
    fields: {
      initialContact:
        "Late April 2023 — first contact (skeptical at first); Andrew (then CTO, FUZE Technologies) + Robby Nelsen.",
      keyMeetings:
        "May 2023 video presentation → interested, paths forward WITHOUT EPA (esp. flame-retardant); June 2023 Todd waiting on Milliken regulatory to approve silver; June/July shipped 1 L; Oct 2023 Todd asked for the EPA registration numbers; 4/22/2024 Robby 'Introduction to Fuze Technology'; 7/22/2025 Scott Smith re-intro; 6/23/2026 Barth Getto 'Cleaned up NCTO list.'",
      currentAgreements: null,
      currentStatus:
        "Deep 2023 pre-EPA history. Milliken's own blocker was 'regulatory won't approve silver / waiting on EPA registration numbers.' FUZE now HAS federal EPA (90890-1 textile) + California EPA — removing the exact objection Todd raised. Warm re-open via Todd Moore + Bob (Getto), on the protective / FR / defense angle (Westex, Steve Lucas).",
      nextStep:
        "Reconnect via Todd Moore with the EPA registration numbers in hand + the protective/FR/defense angle; confirm Todd still at Milliken/Westex; clarify whether 'Bob' = Barth Getto.",
      whoDroveIt:
        "Andrew (then CTO, FUZE Technologies) + Robby Nelsen (follow-ups); later Scott Smith re-intro (7/2025); reported up to Shaun Rothwell.",
      intel:
        "Milliken / Westex = flame-resistant / protective / defense fabrics (same lane as TenCate). EPA now clears the 2023 blocker. Warm path: Bob Getto (NCTO) + Todd Moore. US leg.",
    },
    contacts: [
      { name: "Todd Moore", title: "Director of Development & Technology, Protective Fabrics, Milliken & Company (Spartanburg SC; Westex)", side: "TARGET", role: "NEGOTIATION", notes: "T 864.503.1792 / C 864.909.2673." },
      { name: "Steve Lucas", title: "Senior Development Manager, Government & Defense Fabrics, Milliken", side: "TARGET", role: "TECHNICAL_GATEKEEPER" },
    ],
    activities: [
      { date: "2023-04-25", type: "EMAIL", body: "First contact (skeptical at first) — Andrew + Robby Nelsen." },
      { date: "2023-05-15", type: "MEETING", body: "Video presentation → more interested; found paths forward WITHOUT EPA, especially on flame-retardant fabrics." },
      { date: "2023-10-15", type: "EMAIL", body: "Robby followed up; Todd asked for the EPA registration numbers." },
      { date: "2024-04-22", type: "EMAIL", body: "Robby Nelsen 'Introduction to Fuze Technology' to Todd." },
      { date: "2025-07-22", type: "EMAIL", body: "Scott Smith re-introduction to Todd." },
      { date: "2026-06-23", type: "NOTE", body: "Barth Getto 'Cleaned up NCTO list' (National Council of Textile Organizations network)." },
    ],
  },

  // ─────────────────────────────── TENCATE (new) ─────────────────────────
  {
    name: "TenCate",
    createIfMissing: {
      rank: 15,
      tier: "TIER2",
      geo: "Netherlands / Dayton, TN (TenCate Grass)",
      companyClass: "Technical & protective-fabrics manufacturer (TenCate Protective Fabrics)",
    },
    stage: "TESTING",
    tier: "TIER2",
    fields: {
      initialContact:
        "2019 — Andrew met TenCate super early at Outdoor Retailer; drafted/handled the TenCate NDA himself, but TenCate never signed it ('did not go forward beyond the initial meeting,' 10/28/2019).",
      keyMeetings:
        "2026 (active) — TenCate Grass (Dayton, TN): 'FUZE Treated Pellets en route,' 'FUZE Antimicrobial Technical,' 'BV TenCate List' (Bureau Veritas testing); meeting scheduled this week.",
      currentAgreements: null,
      currentStatus:
        "Active with TenCate Grass (Dayton, TN) — FUZE treating artificial-turf pellets for MRSA/antimicrobial, with Bureau Veritas testing underway. The 2019 relationship stalled pre-EPA; now re-opened via the turf/grass-MRSA project.",
      nextStep:
        "Use the turf/grass-MRSA project as the foot in the door → push TenCate hard onto FR (flame-retardant) / Protective Fabrics (their bigger division, Milliken/Westex lane) — the real prize. Pull the current TenCate threads; confirm current stage.",
      whoDroveIt: "Andrew (OR-show origin + the 2019 NDA) → Ryan Prince (current grass/turf program).",
      intel:
        "The 2019 stall was pre-EPA / early-stage FUZE; now with EPA + a real platform + protective-fabrics fit (like Milliken), the re-approach is much stronger. US leg.",
    },
    contacts: [
      { name: "Colin Veditz", title: "TenCate — 1131 Broadway St, Dayton TN", side: "TARGET", role: "NEGOTIATION" },
      { name: "John Greenep", title: "TenCate — pellets / film", side: "TARGET", role: "TECHNICAL_GATEKEEPER" },
      { name: "Joanne Li", title: "TenCate", side: "TARGET", role: "NEGOTIATION" },
      { name: "Mark", title: "TenCate", side: "TARGET", role: "NEGOTIATION" },
    ],
    activities: [
      { date: "2019-10-28", type: "NOTE", body: "Andrew met TenCate super early at Outdoor Retailer; drafted the TenCate NDA himself but TenCate never signed — did not go forward beyond the initial meeting." },
      { date: "2026-07-30", type: "MILESTONE", body: "TenCate Grass (Dayton, TN): FUZE treating artificial-turf pellets for MRSA/antimicrobial; 'FUZE Treated Pellets en route,' Bureau Veritas testing underway ('BV TenCate List'); meeting scheduled." },
    ],
  },

  // ─────────────── Parked (in the book; light — statuses only) ───────────
  {
    name: "Pulcra Chemicals",
    stage: "PARKED",
    tier: "PARKED",
    fields: {
      currentStatus:
        "Parked — in the Red Rover book, no active dossier yet. EU biocide 2028/2030 catalyst applies; Munich-reachable (Germany).",
    },
  },
  {
    name: "DyStar",
    stage: "PARKED",
    tier: "PARKED",
    fields: {
      currentStatus:
        "Parked — in the book, no active dossier yet. EU biocide 2028/2030 catalyst applies (German ops).",
    },
  },
  {
    name: "Sciessent",
    stage: "PARKED",
    tier: "PARKED",
    fields: {
      currentStatus:
        "Parked — talent/intel angle: Andrew met Meg (surname TBD) to recruit/poach — referral from Malcolm H at MM Textiles (malcolmh@mmtextiles.com).",
    },
  },
];

// Trip-leg assignment (Red Rover trips view). EU/Munich = the Performance
// Days anchor cluster; Shanghai = Transfar + Hi-Goal; Japan = Kaneyo; US.
export const TRIP_LEG: Record<string, string> = {
  CHT: "EU_MUNICH",
  "Rudolf (Duraner/Turkey)": "EU_MUNICH",
  Sanitized: "EU_MUNICH",
  Archroma: "EU_MUNICH",
  Polygiene: "EU_MUNICH",
  "Pulcra Chemicals": "EU_MUNICH",
  DyStar: "EU_MUNICH",
  Transfar: "ASIA_SHANGHAI",
  "Hi-Goal": "ASIA_SHANGHAI",
  "Kaneyo / Kanematsu": "JAPAN",
  Microban: "US",
  Milliken: "US",
  Sciessent: "US",
  "Concept III": "US",
  TenCate: "US",
};

/**
 * Idempotent enrichment. Overwrites the dossier fields (authoritative real-
 * data load), sets stage/tier, upserts contacts by (target, name), and
 * appends activities deduped by (target, occurredAt, body).
 */
export async function enrichRedRover(prisma: any) {
  const results: any[] = [];

  for (const t of ENRICH) {
    let target = await prisma.redRoverTarget.findFirst({ where: { name: t.name } });

    if (!target) {
      if (!t.createIfMissing) {
        results.push({ name: t.name, action: "skipped-not-found" });
        continue;
      }
      target = await prisma.redRoverTarget.create({
        data: {
          name: t.name,
          rank: t.createIfMissing.rank,
          tier: t.tier || t.createIfMissing.tier,
          stage: t.stage || "IDENTIFIED",
          geo: t.geo || t.createIfMissing.geo,
          companyClass: t.companyClass || t.createIfMissing.companyClass,
          ownerId: "cmrmb51hk0000lb04r6ceoemn", // Josh
        },
      });
    }

    // Update fields / stage / tier / class / geo / trip leg.
    const data: Record<string, any> = {};
    if (t.stage) data.stage = t.stage;
    if (t.tier) data.tier = t.tier;
    if (t.companyClass) data.companyClass = t.companyClass;
    if (t.geo) data.geo = t.geo;
    if (TRIP_LEG[t.name]) data.tripLeg = TRIP_LEG[t.name];
    if (t.fields) for (const [k, v] of Object.entries(t.fields)) data[k] = v;
    if (Object.keys(data).length) {
      target = await prisma.redRoverTarget.update({ where: { id: target.id }, data });
    }

    // Upsert contacts by (target, name).
    let contactsUpserted = 0;
    for (const c of t.contacts || []) {
      const existing = await prisma.redRoverContact.findFirst({
        where: { targetId: target.id, name: c.name },
      });
      const cdata = {
        name: c.name,
        title: c.title ?? null,
        email: c.email ?? null,
        side: c.side,
        role: c.role,
        notes: c.notes ?? null,
      };
      if (existing) {
        await prisma.redRoverContact.update({ where: { id: existing.id }, data: cdata });
      } else {
        await prisma.redRoverContact.create({ data: { targetId: target.id, ...cdata } });
      }
      contactsUpserted++;
    }

    // Append activities deduped by (target, occurredAt, body).
    let activitiesCreated = 0;
    let latest: Date | null = null;
    for (const a of t.activities || []) {
      const occurredAt = new Date(`${a.date}T12:00:00.000Z`);
      if (!latest || occurredAt.getTime() > latest.getTime()) latest = occurredAt;
      const dup = await prisma.redRoverActivity.findFirst({
        where: { targetId: target.id, occurredAt, body: a.body },
        select: { id: true },
      });
      if (!dup) {
        await prisma.redRoverActivity.create({
          data: { targetId: target.id, type: a.type, body: a.body, occurredAt },
        });
        activitiesCreated++;
      }
    }
    // Bump lastActivityAt to the most-recent dated bullet (monotonic).
    if (latest) {
      const cur = target.lastActivityAt ? new Date(target.lastActivityAt) : null;
      if (!cur || latest.getTime() > cur.getTime()) {
        await prisma.redRoverTarget.update({
          where: { id: target.id },
          data: { lastActivityAt: latest },
        });
      }
    }

    results.push({
      name: t.name,
      action: "enriched",
      stage: data.stage || target.stage,
      tier: data.tier || target.tier,
      contactsUpserted,
      activitiesCreated,
    });
  }

  const totalTargets = await prisma.redRoverTarget.count();
  const totalContacts = await prisma.redRoverContact.count();
  const totalActivities = await prisma.redRoverActivity.count();

  return { ok: true, enriched: results.length, totalTargets, totalContacts, totalActivities, results };
}
