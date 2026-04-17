# ADR-0001: IP Sovereignty & Foreign-State Appropriation Defense

**Status:** Proposed
**Date:** 2026-04-17
**Deciders:** Andrew Hunsaker (100% owner, FUZE Biotech / 801 Inc)

---

## Context

FUZE Atlas is the control plane for FUZE Biotech's antimicrobial textile IP — recipe library, factory/lab/brand CRM, test results, shipment records, customer contact data, and transactional history. It is the system of record for the company's technical moat and its commercial relationships.

Andrew is the sole (100%) owner of FUZE Biotech with complete control and rights. He is not a fiduciary answering to outside shareholders; there is no board he must placate. The primary threat this ADR addresses is **appropriation of the platform and its underlying IP by a foreign-state actor** — not internal fraud, not a hostile acquisition, not a routine breach.

"Appropriation by foreign-state hands" encompasses several concrete scenarios:

1. **Cyber intrusion by a state-aligned APT** — credential theft, long-dwell access, data exfiltration, ransomware-with-exfil.
2. **Legal compulsion of a US vendor** — a court order or NSL served on Vercel, Resend, Neon/Supabase, GitHub, or AWS compelling disclosure or denial-of-service. Less likely against a US owner, but possible via sanctioned-jurisdiction pressure points or downstream vendors.
3. **Insider compromise or coercion** — an employee or contractor turned, either through bribery, blackmail, or overseas family pressure.
4. **Supply chain attack** — a malicious npm package, a compromised CI action, a poisoned Docker base image.
5. **Physical / border device seizure** — laptop seized at a border checkpoint during international travel with access to prod.
6. **Sanctioned-country acquisition attempt** — an overseas entity attempts to acquire a subsidiary, lab partner, or manufacturing partner holding FUZE data, creating a data-exfiltration vector without touching the US parent.

What we are explicitly NOT defending against in this ADR:

- Fiduciary or shareholder claims — Andrew is the sole owner; owes no duty of preservation to a board.
- Lawful US government process — we comply with valid US legal process; this ADR is scoped to appropriation, not normal compliance.
- Ordinary operational disaster recovery — covered separately by standard backup policy.

The forces at play:

- **Sovereignty vs availability.** The more we lock down, the easier it is to lose data to our own paranoia (lost keys, locked-out ops). The less we lock down, the easier it is to lose data to an adversary.
- **Customer trust vs destructibility.** Customers (brands, labs, factories) expect data durability. A kill switch that wipes their test records is a contract breach, even if Andrew owns the company.
- **Legal exposure of "destroy on demand".** Even a 100% owner has obligations: export controls (EAR / ITAR if any recipes qualify as controlled technology), GDPR data-subject rights, CCPA, customer MSA retention clauses, tax record retention (7 years), potential future litigation spoliation risk. A self-destruct button can create criminal exposure, not reduce it.
- **Timing.** The window between "appropriation is underway" and "appropriation is complete" is measured in hours or days. Human-in-the-loop is required; automated trip-wires are not.

## Decision

Adopt a **defense-in-depth posture organized around crypto-shredding as the primary destruction mechanism, with the IP itself legally separated from the operating company, and a human-gated break-glass procedure under WebAuthn/HSM-backed SUPER_ADMIN control.**

Explicitly reject any time-based dead-man's-switch or automated nuke. Destruction is irreversible; it must be a deliberate, authenticated act.

The system is organized in four layers:

1. **Legal separation** — IP held in a separate holding company licensed to the operating company. Appropriation of the operating company does not convey the IP.
2. **Crypto-shredding** — All sensitive data (recipes, test results, customer records) encrypted at the application layer with keys held in a hardware-backed KMS we control. Destroying keys renders the data unrecoverable across replicas, backups, caches, vendor logs, and stale forks.
3. **Authenticated kill path** — A SUPER_ADMIN role, reachable only via WebAuthn (FIDO2 hardware key), with a two-step break-glass procedure: (a) platform lockdown (read-only, logged-out, all sessions revoked), and (b) key destruction (irreversible, requires a second authentication).
4. **External audit trail** — Append-only log written to an external, WORM-capable store outside our primary vendor ecosystem so we can post-mortem a compromise from outside the compromised system.

## Options Considered

### Option A: "Big Red Button" — automated kill switch with dead man's timer

Andrew fails to check in for N days; system auto-wipes.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Low |
| Time-to-destroy | Automatic |
| False-positive risk | **Catastrophic** — vacation, hospitalization, lost phone all trigger it |
| Legal exposure | High — auto-destruction during pending litigation = spoliation |
| Customer impact | Unacceptable — their test results vanish on a timer |

**Pros:** Works even if Andrew is incapacitated or detained.
**Cons:** The failure mode (accidental destruction) is as bad as the attack it defends against. Creates legal spoliation risk. Customer MSA violation.

**Rejected.** Destruction must be deliberate.

### Option B: Crypto-shredding + legal separation + human break-glass (RECOMMENDED)

Encryption keys held in HSM-backed KMS. SUPER_ADMIN can lock down the platform and, separately, destroy keys. IP held in holdco, licensed to opco.

| Dimension | Assessment |
|-----------|------------|
| Complexity | High (multi-quarter build) |
| Cost | Medium ($200–500/mo for KMS + HSM + WORM storage + sovereign backup) |
| Time-to-destroy | Minutes (lockdown) / hours (shred + vendor wipe) |
| False-positive risk | Low — requires hardware key + two-step auth |
| Legal exposure | Manageable — destruction only under documented threat |
| Customer impact | Transparent during normal ops; disclosed as a risk in MSA |

**Pros:** Primary mechanism (crypto-shredding) is mathematically durable — no need to trust every vendor to actually delete. Legal separation means appropriation of the opco doesn't transfer the IP. Human gate prevents accidents.
**Cons:** Real engineering lift (6–12 weeks for full build). Requires Andrew to physically carry and safeguard a hardware key. IP holdco requires counsel and ongoing formalities (real licensing fees, separate books).

**Selected.**

### Option C: Legal-only defense — IP holdco, no platform-layer destruction

Rely purely on legal separation + standard security posture. No kill switch, no crypto-shredding.

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low (legal structuring only) |
| Cost | Low after initial setup |
| Time-to-destroy | N/A |
| False-positive risk | None |
| Legal exposure | Low |
| Customer impact | None |

**Pros:** Cheap, simple, no operational risk.
**Cons:** Does nothing against a technical appropriation (APT, insider, ransomware-with-exfil). Assumes courts will help us after the fact — not true against a foreign state that never sees our court.

**Rejected as sole defense.** Adopted as Layer 1 inside Option B.

### Option D: "Distributed no-single-owner" crypto keys (M-of-N)

Require M-of-N trustees to destroy keys (e.g., 2-of-3 with Andrew + counsel + trusted ops lead).

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium-High |
| Cost | Low |
| Time-to-destroy | Hours–days (coordinate quorum) |
| False-positive risk | Very low |
| Legal exposure | Manageable |
| Customer impact | Transparent |

**Pros:** Prevents any single compromised individual (including Andrew under duress) from destroying the company.
**Cons:** Andrew is sole owner with complete rights — adding external trustees reintroduces exactly the fiduciary/governance concerns he explicitly doesn't have. Quorum delay can mean appropriation completes before quorum reaches destroy decision. Adds attack surface (compromise any M trustees).

**Rejected for the destroy path.** Considered for the *recovery* path (key recovery requires quorum) — revisit in a follow-up ADR once core build ships.

## Trade-off Analysis

The sharpest trade-off is **availability vs sovereignty.**

Crypto-shredding means: if we ever lose the keys unintentionally, the data is gone the same way it would be gone under an attack. Key management is now a load-bearing operational discipline, not an afterthought. This is accepted — the alternative (keys escrowed with a vendor we don't control) reintroduces the compulsion vector we are trying to defeat.

The second trade-off is **speed vs deliberateness.** Automated destruction is faster but unsafe; human-gated destruction is safer but requires Andrew to be reachable. The mitigation: the **lockdown** action is fast and reversible (revoke sessions, flip read-only), and can be triggered from any WebAuthn-enabled device in minutes. The **shred** action is slower by design, requires a second authentication, and has a 60-minute cancellation window logged and alerting to a secondary channel. This gives minutes-to-first-containment and hours-to-irreversible — the right shape for this threat class.

The third trade-off is **cost of legal separation vs clarity of ownership.** An IP holdco costs money to maintain (licensing agreements, separate books, state filings). It's worth it here because it changes what an acquirer gets: the opco's contracts, people, cap table — but not the recipes. The recipes are licensed and can be pulled.

## Consequences

**Becomes easier:**
- Rapid containment under suspected compromise (minutes to lockdown).
- Defensible destruction under documented threat (authenticated, logged, deliberate).
- Selling or restructuring the opco without risking IP transfer.
- Post-mortem after a breach (external audit log survives compromise of primary system).

**Becomes harder:**
- Day-to-day ops: SUPER_ADMIN actions now require WebAuthn, not just password. Andrew must carry a hardware key (plus a secure backup key in a safe deposit box).
- Onboarding: new customer agreements must disclose the crypto-shredding model and destruction authority.
- Backup strategy: backups must be encrypted *with the same keys* — a backup that isn't shreddable defeats the whole model.
- Key rotation: rotating customer-data keys now has blast radius (all encrypted columns need re-encrypt). Schedule: every 12 months, staged.

**What we'll need to revisit:**
- Quorum-based recovery (Option D) once core build ships — should key *recovery* require M-of-N even though destruction doesn't?
- Export-control classification of recipes. If any qualify under EAR, this changes the legal destruction calculus (destroying controlled tech may be a reporting obligation, not a right).
- Insurance. Crime / cyber / E&O policies may have specific language about destructive capability that we need to read before shipping the shred path.
- Counsel review of customer MSA retention clauses vs the shred path. If we've promised 7-year retention and we shred, that's a live breach — even if the trigger is a foreign state. Needs contract language before shredding becomes real.

## Action Items

### Phase 0 — Legal scaffolding (weeks 1–3, blocks everything)

1. [ ] Engage outside counsel to form IP holdco (likely Delaware or Wyoming LLC, 100% owned by Andrew personally or a trust).
2. [ ] Transfer trademarks, pending patents, recipe trade secrets, and software copyright to holdco.
3. [ ] Draft opco ↔ holdco license (exclusive, revocable, market-rate royalty, terminable on events including appropriation).
4. [ ] Review existing customer MSAs for retention clauses; identify which must be renegotiated before shred path goes live.
5. [ ] Classify recipes against EAR / ITAR. If any controlled, document destruction-reporting obligations.

### Phase 1 — Crypto-shredding foundation (weeks 2–6, runs parallel)

6. [ ] Choose KMS: AWS KMS with CloudHSM, or a hardware-backed alternative (YubiHSM on self-hosted, or GCP KMS with HSM). Criteria: US provider, HSM-backed, customer-managed keys, audit log export.
7. [ ] Introduce per-tenant data encryption keys (DEKs) wrapping sensitive Prisma fields: `Recipe.*`, `TestResult.*`, `Contact.*`, `FuzeOrder.*`, `Note.content`.
8. [ ] Wrap DEKs under a master key (KEK) held in HSM. Destruction of KEK = crypto-shred of everything.
9. [ ] Migrate existing data to encrypted columns. Validate decrypt-on-read path end-to-end in staging.
10. [ ] Implement at-rest key rotation tooling (rotate DEK without rotating KEK).

### Phase 2 — SUPER_ADMIN role + WebAuthn (weeks 4–8)

11. [ ] Add `SUPER_ADMIN` role in Prisma schema (above `ADMIN`). Seed: Andrew only.
12. [ ] Enforce WebAuthn (FIDO2) as the only auth factor for SUPER_ADMIN — no password fallback, no TOTP fallback.
13. [ ] Register primary hardware key + backup key (stored in safe deposit box). Document recovery procedure.
14. [ ] SUPER_ADMIN-only routes: `/admin/lockdown`, `/admin/shred`, `/admin/audit-export`. Middleware enforces role + fresh-WebAuthn-assertion (within last 5 min).

### Phase 3 — Break-glass lockdown (weeks 6–9)

15. [ ] `/admin/lockdown` action: flip platform to read-only, revoke all sessions, disable new logins (except SUPER_ADMIN), banner informing users of maintenance. Reversible.
16. [ ] Pager alert to Andrew's phone + personal email + counsel's email on lockdown trigger (out-of-band notification).
17. [ ] Runbook: under what conditions to invoke lockdown vs shred. Dry-run quarterly.

### Phase 4 — Shred path (weeks 8–12)

18. [ ] `/admin/shred` action: initiate KEK destruction via HSM API. Requires fresh WebAuthn + typed confirmation phrase + 60-minute cancellation window.
19. [ ] Parallel: trigger vendor-side deletion requests (Vercel env + logs, Resend history, Neon/Supabase database + point-in-time recovery window, GitHub repo + forks we control, AWS backups). This is belt-and-suspenders; the KEK destruction is the real mechanism.
20. [ ] Post-shred confirmation email to Andrew + counsel from the external audit-log system.

### Phase 5 — External audit & offsite backup (weeks 10–14)

21. [ ] Append-only audit log to an independent vendor (S3 Object Lock WORM, or a separate AWS account we control with restricted IAM). Log: every SUPER_ADMIN action, every lockdown, every shred. Survives compromise of the primary app.
22. [ ] Encrypted offsite backup to a sovereign-friendly jurisdiction (candidate: Switzerland or Iceland-based provider). Backups encrypted under the same KEK — so a shred wipes these too. This is a feature, not a bug.
23. [ ] Quarterly restore drill: pull backup, decrypt in a sandbox, verify data integrity.

### Phase 6 — Policy & disclosure (weeks 12–14)

24. [ ] MSA language: disclose the destructive-capability model to customers, define the narrow conditions under which it may be invoked, carve out customer-controlled data where possible.
25. [ ] Internal policy: who may request Andrew invoke lockdown (anyone on call); who may request shred (counsel only, via secure channel).
26. [ ] Travel policy: Andrew does not cross international borders with a device holding prod access. Use a travel laptop with no cached credentials; re-auth from destination over WebAuthn.

---

## Appendix A: Explicit Non-Goals

These are deliberately NOT in scope:

- **Time-based dead-man's switches.** Rejected (Option A).
- **Anti-forensics / evidence destruction during litigation.** Destruction is for appropriation defense, not evidence concealment. Any active litigation hold overrides the shred path.
- **Resistance to valid US legal process.** This ADR is not a Warrant Canary. We comply with valid US process.
- **Defending against lawful acquisition.** If Andrew voluntarily sells to a sanctioned entity, this system does not prevent that. (That's a separate ADR on acquisition controls.)
- **Protecting physical manufacturing assets.** Factories and inventory are out of scope.

## Appendix B: References

- NIST SP 800-88 Rev. 1 — Guidelines for Media Sanitization (crypto-erase is the accepted destruction mode for modern storage).
- FIDO2/WebAuthn spec — authentication foundation.
- "Crypto-shredding" — standard term in cloud security literature.
