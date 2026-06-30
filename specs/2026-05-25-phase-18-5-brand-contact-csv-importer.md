# Phase 18.5 — Brand Contact CSV Importer + Bulk User Invitation

**Date filed:** 2026-05-25
**Filed by:** Andrew (via Cowork session)
**Why now:** Phase 18 ships brand fabric portfolio CSV import. The natural pair is brand contact CSV import — when a brand sends a contact roster (product team, sourcing team, sustainability team), Andrew should be able to drop the CSV and have Atlas create user accounts + send invitation emails in one motion. Without this, each contact gets manually entered + manually invited.

**Builds on Phase 18.** Should be specced + executed AFTER Phase 18 lands so the column-mapping + dry-run + commit patterns can be reused directly.

---

## STANDING RULES (read first)

1. **300-second auto-resume.** No check-ins between tracks.
2. **Brand voice strict.** No silver/nano/Ag in any user-facing string in any of 17 locales.
3. **Verify-after-every-push.** Vercel green + diag-all-surfaces.
4. **Bearer-authed runtime migration** for schema (likely none here — uses existing User + Contact models).
5. **Git workflow.** `rm -f .git/index.lock`, `--no-verify` on commit.
6. **i18n parity.** Every new user-facing string added to all 17 locale files.
7. **Privacy.** Never log or store unencrypted invitation tokens. Never include contact phone numbers in error responses.

---

## REFERENCE — Brand_Contact_Template.csv (canonical schema)

Write this template to `deliverables/Brand_Contact_Template.csv` as Track 1.

Columns:

```
Name, Email, Phone, Role, Title, LinkedIn URL, Department,
Send Atlas Invitation (Y/N), Notify on Test Results (Y/N), Notify on Order Updates (Y/N),
Notify on ESG Report (Y/N), Locale Preference, Notes
```

- **Role** must map to Atlas User roles: BRAND_USER, BRAND_MANAGER, BRAND_ADMIN (default: BRAND_USER if blank).
- **Locale Preference** must be a valid locale code (en, zh-CN, vi, ko, etc.). Default: en if blank.
- **Send Atlas Invitation** Y → create User account + send token-invite email. N → create Contact only (no User, no invitation).

---

## TRACKS

6 tracks. Strict order.

### TRACK 1 — Template CSV + schema audit

Write `deliverables/Brand_Contact_Template.csv` with header row + 3-5 example rows (clearly marked as examples).

Audit `Contact` model — confirm existing fields cover: name, email, phone, role, title, linkedinUrl, department, notes. Add column if any missing.

Audit `User` model — confirm `User.invitationToken`, `User.invitationExpiresAt`, `User.localePreference` exist (Phase 16 may have added some; verify).

Add to schema if missing:
```prisma
model User {
  // ... existing
  localePreference     String?   // "en" | "zh-CN" | etc., null = browser default
  invitationToken      String?   @unique
  invitationExpiresAt  DateTime?
}

model Contact {
  // ... existing
  department  String?
  notifyOnTestResults    Boolean @default(true)
  notifyOnOrderUpdates   Boolean @default(true)
  notifyOnEsgReport      Boolean @default(true)
}
```

Build `/api/cron/migrate-18-5-bundle` (bearer-authed, idempotent) to apply.

### TRACK 2 — CSV parsing + validation (reuse Phase 18 patterns)

New file: `src/lib/contact-csv-import.ts`

Reuse the column-mapping fuzzy resolver from Phase 18 (extend the alias map with contact-specific aliases: "Email" / "Email Address", "Phone" / "Phone Number" / "Mobile", "Title" / "Job Title", "Department" / "Team", etc.).

Reuse the dry-run + commit pattern. Output shape:
```typescript
interface ParseResult {
  rows: ParsedContact[];
  errors: ParseError[];
  warnings: ParseWarning[];
  summary: {
    totalRows: number;
    validRows: number;
    contactsToCreate: number;
    contactsToUpdate: number;       // matched by email within this brand
    invitationsToSend: number;
    existingUsersFound: number;     // email already exists in User table
  };
}
```

Validation rules:
- Name required.
- Email required + format validation (basic RFC).
- Role must map to valid User role enum (default BRAND_USER if blank).
- Locale Preference must be in `LOCALES` list (default en if blank).
- Y/N parsing same as Phase 18 (Y, Yes, TRUE, 1, ✓ truthy).
- LinkedIn URL: optional, validate starts with http(s) if present.

Collision handling:
- If email matches existing User: skip user-creation (don't overwrite existing accounts). Update Contact row only.
- If email matches existing Contact within this brand: update fields (name change, role change, etc.).
- If email matches Contact in a different brand: warn (probably the same person at two brands — surface for admin to confirm if they want to link).

### TRACK 3 — Dry-run endpoint

New: `POST /api/admin/brands/[id]/contacts/import?dryRun=true`

Accepts multipart/form-data with CSV. Returns ParseResult. No DB writes.

Auth: ADMIN, EMPLOYEE, SALES_MANAGER, SALES_REP.

### TRACK 4 — Commit endpoint with bulk invitation

New: `POST /api/admin/brands/[id]/contacts/import`

Steps:
1. Parse + validate (Track 2).
2. Bail on validation errors.
3. For each parsed contact:
   - Upsert Contact row (by email within brand).
   - If `Send Atlas Invitation = Y` AND email isn't already a User:
     - Create User row with status PENDING_INVITATION, role from CSV, brandId set, localePreference set.
     - Generate invitation token (32-char URL-safe, 7-day expiry).
     - Send invitation email via Resend, localized to user's localePreference. Email contains:
       - Welcome message in their language
       - Brand context ("You've been invited to FUZE Atlas by {brandName}")
       - One-click invitation link: `https://fuzeatlas.com/invite/[token]`
       - 7-day expiry warning
   - Stamp `Contact.invitationSentAt = now()` for tracking.
4. Return summary: `{ contactsCreated, contactsUpdated, usersCreated, invitationsSent, invitationsFailed, viewUrl }`.

### TRACK 5 — Invitation acceptance flow

The `/invite/[token]` route should already exist from Phase 15's NEED-7a self-service org rosters. Verify + extend:
- Show brand name + role being granted in the invitation page.
- Show locale-preference confirmation ("You'll receive Atlas in {Language}. Change?" with a picker).
- On password set + accept: flip User.status from PENDING_INVITATION → ACTIVE, clear invitationToken, redirect to `/brand-portal`.
- If token expired: friendly error + "Request a new invitation" button (admin then resends from /admin/users).

### TRACK 6 — Importer UI

New page: `/admin/brands/[id]/contacts/import`

Same UX pattern as Phase 18:
1. File upload (drag-drop or click).
2. Dry-run preview with row count + errors + warnings + per-row "will create user / will skip / collision detected" indicators.
3. For collision warnings (same email in different brand): inline confirm "Link this contact across brands? Y/N" per row.
4. "Commit import" button — disabled if blocking errors.
5. Post-commit: success page with summary + link to `/admin/brands/[id]?tab=contacts` to verify.

UI also has:
- Downloadable template link at top.
- "Re-send invitations for stale Pending users" button (sweeps brand's existing PENDING_INVITATION users created > 24h ago, sends fresh invitation token).

---

## DONE CRITERIA

- [ ] Brand_Contact_Template.csv committed to `deliverables/`.
- [ ] Schema migration ran via `fzcron migrate-18-5-bundle`.
- [ ] Upload canonical template to a test brand — confirm dry-run + commit work end-to-end.
- [ ] Confirm User accounts created with PENDING_INVITATION status.
- [ ] Confirm invitation emails sent (verify in Resend dashboard).
- [ ] Confirm invitation token flow completes (acceptance page → password set → redirect to brand portal).
- [ ] Test collision scenarios: same email across brands → warning + admin choice. Same email already User → skip user creation, update contact only.
- [ ] i18n: all importer page strings + invitation email templates added to all 17 locales.
- [ ] `fzcron diag-all-surfaces` green.

---

## OUT OF SCOPE

- Bulk-update contacts via CSV (this importer is create + invite focused; updates happen one-at-a-time via the contact detail page).
- SMS-based invitations (email only for v1).
- LinkedIn API integration (LinkedIn URL is a static field, no profile auto-import).
- Active Directory / SCIM integration (Phase 20+).

---

## ESCALATION

Stop and ping Andrew if:
- An invitation email bounces > 50% of the time (check Resend webhook for `email.bounced`).
- A brand's CSV has > 100 contacts (worth confirming with Andrew before mass-inviting).
- Anthropic rate-limited > 30 min.

---

## REPORT BACK

```
Per-track status:
T1 (template + schema) — ✅ shipped <hash>
T2 (CSV parser) — ...
T3 (dry-run endpoint) — ...
T4 (commit + invitation) — ...
T5 (invitation acceptance) — ...
T6 (importer UI) — ...

Test import: <N contacts created, M invitations sent>
Bounce rate on test invitations: <%>
i18n keys added: <count>
fzcron diag-all-surfaces: ✅ / ❌
```
