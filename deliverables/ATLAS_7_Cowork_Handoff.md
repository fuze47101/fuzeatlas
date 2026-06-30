# Atlas 7 — Cowork Session Handoff

Carry this into the new clean cowork (Atlas 8). It captures who I am, how we work, what shipped this session, what's queued, and the open items — so the next session starts from truth instead of re-discovering everything.

---

## Me / Context

- **Andrew Peterson**, CEO/Founder, **FUZE Biotech**. Building **FUZE Atlas** (the multi-portal Next.js platform at fuzeatlas.com) and the public **fuzefaq.com**.
- Repo lives on this Mac at **`~/Desktop/fuzeatlas`** (connected folder). GitHub: `github.com/fuze47101/fuzeatlas.git`, **main = production**, auto-deploys to Vercel.
- Email: andrew@fuze47.com / andrew@801inc.com.

## How we work (the non-negotiable model)

- **Cowork diagnoses, Claude Code executes.** I (Cowork) read the repo, pull live state via `fzcron`/curl, find the root cause, and hand Andrew a **single, copy-pasteable, self-verifying Code prompt**. Andrew pastes it into Claude Code (a separate CLI on his Mac); Code edits, commits, pushes, deploys.
- **Prompts must be inline in chat**, not files (Andrew doesn't want to open a file to find them).
- **Prompts must be autonomous**: never pause for check-ins, self-verify with `npx tsc --noEmit` / `next build` + `fzcron diag-all-surfaces`, push their own commits (`--no-verify`, clear `.git/*.lock` first), and only escalate on genuine ambiguity or an unrecoverable error. Code does NOT auto-resume once its terminal turn ends — if it stalls, Andrew must paste a resume.
- **Closing tickets:** reference a `FeedbackReport` cuid in the commit body via `Closes <cuid>`; the hourly `auto-resolve-from-commits` cron flips it to FIXED and emails the reporter. "We just notify it was fixed" — no manual reply emails.
- **`fzcron`** = Andrew's zsh helper that curls bearer-authed `/api/cron/*` endpoints with `$CRON_SECRET` from `.env.local`. I use the same pattern from the workspace bash to read live state (`feedback-list`, `triage-status`, `admin-resolve`, etc.).
- Schema changes via **`npx prisma db push`** (not migrate). Use **`getRealUser()`** for permission gates (not the impersonation-aware `getCurrentUser()`).
- Brand voice is sacred: **FUZE / metamaterial**, never "silver/nano" in customer-facing content. Technical/compliance Q&A may use the honest characterization (elemental silver, Ag⁰, non-leaching allotrope). EPA-registered (federal) + California EPA (Q1 2026), OEKO-TEX Class I, bluesign, PFAS-free. Primary test = **ASTM E2149** (non-leaching contact-kill); AATCC 100 only at F1/F2.

---

## Deliverables produced this session (in `~/Desktop/fuzeatlas/deliverables/`)

**Partnership decks (PowerPoint, real FUZE logo, accurate non-leaching positioning):**
- `FUZE_Transfar_Partnership_Overview.pptx` — 13 slides. Exclusive **China** licensing pitch to Transfar (textile-chemical giant). 4 pillars + brands + competitive + strategic fit. Brands slide = single grid of 33 (Patagonia, The North Face, Nike, Canada Goose, Montane, Montbell, YETI, NEMO, Target, Toray, Mitsui, Itochu, etc.).
- `FUZE_Sanitized_Partnership_Overview.pptx` — 13 slides. **Global** tech-licensing pitch to Sanitized AG (Swiss antimicrobial specialist, est. 1935). Competitive slide reframed as *their* upgrade path (Sanitized removed from "beat" list). Brands slide REPLACED with **"Beyond textiles — global surface platform"** (≈3× market: antimicrobial plastics ~$38B + coatings ~$5B + surface disinfectants ~$6B vs textiles ~$14B).
- `FUZE_Quince_Partnership_Overview.pptx` — 10 slides. **Brand/product** pitch (Quince = DTC affordable-luxury retailer, $340M rev, $4.5B val, factory-direct). Reframed as "treat your products," not licensing. Slide 7 = enabling claims slide (FUZE is EPA-registered → Quince CAN make antimicrobial claims, only public-health/disease claims gated). Target dropped from proof grid.

**SanMar testing thread (the recurring "100 variable results" problem):**
- `SanMar_Reply_to_Susan_ASTM_E2149.docx` — ready-to-send Word reply to Susan Matter + Hong Kong. Core message: variance is uncontrolled test variables, not the product; either enforce ONE protocol everywhere OR (recommended) **standardize the dose — start every factory at F1 (1.0 mg/kg)** to pass on any method/lab. Answers her two questions (≥99% E2149 acceptance held through washes; "better after laundering" = leaching-chemistry myth; the early-wash dip is heavy softeners/wicking agents masking FUZE).
- `FUZE_Why_Test_Results_Vary.pdf` — branded 1-page field guide for factories/labs: the 5 variables (method, sterilization=autoclave-buries-it, low-sulfur MHB, 24h contact, organism=Klebsiella-worst-case), two ways to end variance, three truths, autoclave-vs-UV proof (0–87% → 99.9%).

**PVH:** `PVH_Reply_to_Yvonne_Rado.docx` — reply to Yvonne Rado (Sr Mgr Raw Materials, PVH/Calvin Klein/Tommy). Mill-sample intro, costing (~$0.06–0.24/garment on 150gsm single jersey, from $36/L stock), lead time (US/regional production, no-shelf-life pre-positioning, ~2–4wk first bulk), close-to-body customers (Nike, North Face, KUIU, Rhone, Spanx). Signed "Barth" — confirm sender.

**Queued Code prompts (not yet run):** `CODE_PROMPTS_tickets_and_triage.md`.

---

## What SHIPPED to the platform this session (commits on main)

- `51c5888` Kaylee ICP report → flips TestRequest to COMPLETE on confirm. ✅ closed
- `77393c7` /my-tasks rows deep-link "Open ↗" to source meeting note. ✅ closed
- `75b0260` i18n locked dir=ltr all 17 locales (Tina's "upside down" fix). ✅ closed
- `e538f08` triage-robot visibility instrumentation (rawFetchCount, sampleIds).
- `70add6c` Barth's full CRM pass — 4 bugs + 3 features (CONTACT-404, email verification on import, back-nav, primary contact, last-activity in list, editable notes, AI-research auto-refresh).
- `95aa55a` Kaylee storage/lot/wash + Scott True Classic + Tina add-task ACL. ✅ closed
- `812bf7b` Silvadur CIL audit (binder/formaldehyde per DuPont TDS) — closed Tina's ACCEPTED ticket via admin-resolve.
- `37ab14f` + `5738133` BD pool opener: **unclaimed Ryan Prince's dead LEAD prospects → opened the pool**, discovery sweep, intel refresh. `admin-open-bd-pool` endpoint exists.
- `7edef5e` Home screen shows ONLY module cards (dropped BD scoreboard + activity feed).
- `8f7b232` + `314c00e` **Projects/meeting-notes restructure**: projects pulled OUT of the meetings list (`projectId: null` filter), kickoffs renamed to bare project name + status IN_PROGRESS (not COMPLETED), project = dated note log, Prev/Next siblings always computed. Monday Global Meeting stays as a meeting holding non-project notes.

**Net:** feedback queue went from 11 open → near inbox-zero, then 4 new upload tickets arrived (below). Triage robot is green/healthy but still effectively idle (no open *bugs* it's scoped to attempt until the upload fix).

---

## PENDING — two Code prompts ready to paste (NOT yet run)

### 1. Upload-fix prompt (run FIRST — customer-facing, one root cause)
**Root cause confirmed:** `src/app/api/tests/upload/route.ts` reads files via `req.formData()` → file goes through the serverless function → **Vercel's ~4.5 MB body limit** rejects big PDFs with plain-text **"Request Entity Too Large"** before the handler runs → client `res.json()`s it → **"Unexpected token 'R', 'Request En…' is not valid JSON."** Small reports work; PDFs over ~4.5 MB fail. Fix = migrate to **presigned S3 URLs** (pattern already exists at `fabrics/photo-upload-url`, `compliance-docs/upload-url`, `product-documents/upload-url`) so the browser uploads straight to S3, + harden the client to check `res.ok`/content-type instead of blindly parsing JSON. Add `/api/cron/diag-upload-pipeline` (push a >5MB blob). Close all 4 Kaylee upload tickets via `Closes <cuid>`. (Full prompt text in `CODE_PROMPTS_tickets_and_triage.md` / chat scrollback.)

### 2. BD quality overhaul prompt (6 points)
The BD wizard serves bad/bouncing emails, dead LinkedIn 404s, and un-removable AI-research junk. Plumbing exists (`src/lib/email-verify.ts` — verifyDeliverable/isSendForbidden; Contact.emailStatus/emailValidity/linkedinUrl/linkedinValidity; Resend bounce webhook) but was never applied to existing data, the wizard doesn't hard-gate, LinkedIn is never validated, enrichment has no quality bar.
1. `sweep-contact-emails` — verify every contact's email (MX) + cross-ref bounced OutreachMessages, stamp status.
2. **Hard-gate the wizard** — next-brand/send/preflight refuse `isSendForbidden` contacts.
3. `sweep-linkedin` — validate LinkedIn URLs, hide dead ones (no 404 links).
4. **Quality-gate enrichment** — don't persist unverified email / invalid LinkedIn.
5. `purge-bad-enrichment` — dry-run-first bulk removal of dead-on-all-fronts contacts.
6. **Tighten sourcing** — Apollo verified-emails-only at query level, sharper ICP title/seniority targeting, require a real LinkedIn `/in/` profile, **don't create a Contact unless it has a verified email OR a valid LinkedIn**, dedupe, report yield.
Net effect: a thinner-but-real BD pipeline instead of a fat fake one. (Full prompt in chat scrollback.)

---

## Open support tickets (4 — all Kaylee, all the upload cluster, all ONE root cause = the 4.5MB limit above)
- `PDF file wont upload`
- `Uploading a pdf file did not work`
- `wont link fabric`
- `Test upload failed`
Run the upload-fix prompt → all four close together.

---

## Key technical learnings to carry forward
- **Vercel serverless body limit ≈ 4.5 MB.** Any upload through `req.formData()` dies above it with a plain-text 413; clients must not blindly `res.json()`. Use presigned S3 URLs for all uploads. (This was the upload-ticket root cause.)
- **The auto-triage robot is "green but empty"** — it runs healthy but historically pulled 0 tickets (ATLAS_BASE_URL/CRON_SECRET/smoke-test gap). Instrumentation shipped (`e538f08`); the full pull-fix is still pending. It only attempts BUG/ERROR/PROBLEM/clear-UI-SUGGESTION — suggestions/OTHER are correctly skipped.
- **Code stalls silently** when its terminal turn ends; there's no auto-resume daemon from Cowork. Watch git-commit age vs uncommitted working tree to detect a stall; paste a resume prompt to restart.
- **Scheduled-task monitor: Andrew declined** (don't auto-set one up). Check live on request.
- **SanMar testing variance** is the recurring strategic fight: standardize the dose at F1 rather than policing 10 mills × multiple labs.

## Decisions still on Andrew (flagged, awaiting his call)
- PVH reply sender (signed Barth — switch to Andrew/Evan?).
- Whether to run the two pending Code prompts (upload first, then BD).
- Brand-naming exposure on partner decks (currently names marquee customers; confirm none are NDA-restricted per partner).

---

*Generated end of Atlas 7. Paste into Atlas 8 to continue.*
