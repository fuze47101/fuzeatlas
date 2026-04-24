/**
 * resolve-tickets.ts
 *
 * Batch-close FeedbackReport rows that have been fixed by recently-shipped
 * commits. Populates status + triageNotes + resolution + resolutionUrl +
 * resolvedById + resolvedAt.
 *
 * Dry-run by default. Prints a diff of what WOULD change. Pass --apply to
 * actually write.
 *
 * Usage:
 *   npx tsx scripts/resolve-tickets.ts              # dry-run, safe to re-run
 *   npx tsx scripts/resolve-tickets.ts --apply      # actually write
 *
 * To add a ticket resolution: append to RESOLUTIONS below with:
 *   - id:            FeedbackReport.id from list-open-tickets.ts
 *   - status:        FIXED | REJECTED | DUPLICATE | CLOSED | TRIAGED | ACCEPTED
 *   - commit:        7-char SHA of the commit that fixed it (becomes resolutionUrl)
 *   - resolution:    short note shown to the requester on notification
 *   - triageNote:    internal note for Andrew / admins
 */
import { PrismaClient, FeedbackStatus } from "@prisma/client";

const prisma = new PrismaClient();

const RESOLVED_BY_EMAIL = "andrew@fuze47.com";
const REPO = "https://github.com/fuze47101/fuzeatlas";

type Resolution = {
  id: string;
  status: FeedbackStatus;
  commit?: string;             // 7+ char SHA — optional for feature / reject
  resolution: string;           // user-facing note
  triageNote: string;           // internal note
};

/**
 * ═══════════════════════════════════════════════════════════════════════
 * CONFIDENT FIXES — commit history explicitly references the ticket or
 * the symptom is a 1:1 match. Safe to close as FIXED.
 * ═══════════════════════════════════════════════════════════════════════
 */
const RESOLUTIONS: Resolution[] = [
  // Ashlee — KPI dashboard "failed to load dashboard data" (4/18)
  {
    id: "cmo4ua42x0003jr04h3ki05wi",
    status: "FIXED",
    commit: "ad84f58",
    resolution:
      "KPI dashboard now loads correctly — auth was failing because the client was sending stale headers. Fixed by resolving the user from the session cookie directly. Try it again.",
    triageNote: "Same root cause as internal #83. ad84f58 fixes auth resolution.",
  },

  // Viktor — Can not send emails on /brands/* (4/20)
  {
    id: "cmo80muje0007l704qdky2lff",
    status: "FIXED",
    commit: "1076dba",
    resolution:
      "The 📧 Email button on brand pages now routes through the BD Wizard (which is the canonical, working send path). The old modal was using a deprecated endpoint. Your templates still work — just click 📧 like before.",
    triageNote: "Commit message on 1076dba explicitly names this ticket.",
  },

  // Tina — No Lab option when adding user (4/21)
  {
    id: "cmo8ddq7x0001l504wr7l8l75",
    status: "FIXED",
    commit: "d04abb9",
    resolution:
      "Lab is now an option when adding a user manually from Settings → Users. You can assign Lab role and link the user to a lab entity.",
    triageNote: "Part of the 'Tina admin tickets' batch — d04abb9 added lab role.",
  },

  // Tina — Can't link new user with company after manual create (4/21)
  {
    id: "cmo8dht6j0004l5042tg2f8dd",
    status: "FIXED",
    commit: "06b0171",
    resolution:
      "User PATCH now accepts factoryId / brandId / distributorId / labId so you can link an existing user to any entity. For Steven Sun specifically, open his user record in Settings → Users and set Factory = BV Shaoxing.",
    triageNote:
      "06b0171 added PATCH accepting factoryId/brandId/distributorId/labId on /api/settings/users/[id].",
  },

  // Ryan — BD Wizard 'cyclic structures' alert on send, attempt 1 (4/21)
  {
    id: "cmo8teez30001jx04dzoca3vf",
    status: "FIXED",
    commit: "cc693ca",
    resolution:
      "The send button was passing the browser click event into JSON.stringify which Safari rejects. Fixed. Try sending again — should go through without the alert.",
    triageNote:
      "Classic Safari cyclic-structure error. cc693ca wraps onClick in arrow + clamps force to boolean.",
  },

  // Ryan — Same alert, attempt 2 (4/21) — duplicate symptom
  {
    id: "cmo8u61490003jx04gugh0qfa",
    status: "FIXED",
    commit: "cc693ca",
    resolution:
      "Same root cause as your first alert ticket — Safari rejecting the click event inside JSON.stringify. Fixed in cc693ca.",
    triageNote: "Duplicate of cmo8teez30001jx04dzoca3vf. Same fix resolves both.",
  },

  // KJ Tang — Distributor portal no factories to choose (4/21)
  {
    id: "cmo9eliq50001ky04f9hjvyn8",
    status: "FIXED",
    commit: "18772bd",
    resolution:
      "Your distributor account wasn't linked to TexWell in the system, which made the factory picker empty. Fixed — now shows all active factories + a yellow banner if linking is missing. Try creating a factory order again.",
    triageNote: "18772bd: graceful degradation for unlinked DISTRIBUTOR_USER.",
  },

  // Tina Distributor — Unable to load factories (4/21)
  {
    id: "cmo9jizkv0001jp04u7awau3j",
    status: "FIXED",
    commit: "18772bd",
    resolution:
      "Same distributor-linking bug KJ hit — fixed in 18772bd. Factories now load. (Multi-screenshot upload is noted as a separate follow-up.)",
    triageNote:
      "Factory load bug resolved. Multi-screenshot request captured as separate TODO — tell Tina we've acknowledged it.",
  },

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * LIKELY FIXES — commit message suggests the symptom is addressed, but I
   * want Tina/Ashlee to reverify before we mark FIXED. Mark as ACCEPTED
   * with a "please re-test" triage note so they're not left in the NEW
   * queue but they still ping us if still broken.
   * ═══════════════════════════════════════════════════════════════════════
   */

  // Ashlee — Fabrics blank on ICP Sample Prep (4/18, after b53a0bb)
  {
    id: "cmo4u8xjm0001jr042iq8mrqf",
    status: "ACCEPTED",
    commit: "b53a0bb",
    resolution:
      "Fabric search on the ICP Sample Prep wizard was fixed in b53a0bb (search now actually filters on the backend, response shape matches, and FUZE numbers on submissions are matched). Please re-run a search for fabric #2504 or any FUZE number and let me know if it's still blank.",
    triageNote:
      "Filed the day after b53a0bb deployed — may be a different blank-state scenario. Ping Ashlee to reverify.",
  },

  // Tina — Parsing of test report incorrect (4/21)
  {
    id: "cmo8czto90003jx04ye6iuas9",
    status: "ACCEPTED",
    commit: "d04abb9",
    resolution:
      "Upload parser was reworked in d04abb9. Please try uploading the same report again — if lab name / date / result are still wrong, reply with the file and we'll debug the parser directly.",
    triageNote:
      "d04abb9 touched the upload parser. Need Tina to re-test with a real lab PDF to confirm.",
  },

  // Tina — Edit test report (factory/project) (4/21)
  {
    id: "cmo8d1yuy000djx044bmaiv07",
    status: "ACCEPTED",
    commit: "d04abb9",
    resolution:
      "Test report edit links were added in d04abb9. Open any test from /tests and the factory/project fields should be editable. Confirm this is working end to end on a real report?",
    triageNote: "Verify edit links actually reach factory + project fields specifically.",
  },

  // Ashlee — ICP prep fabric lookup sometimes empty (4/22, after b53a0bb)
  {
    id: "cmoam7lr40001l4045j3powo4",
    status: "ACCEPTED",
    commit: "b53a0bb",
    resolution:
      "Fabric search was overhauled in b53a0bb — FUZE numbers, customer codes, construction, color, yarn type, and submission back-pointers all match now. If a specific fabric still doesn't show, reply with the FUZE # and I'll reproduce.",
    triageNote:
      "Post-b53a0bb ticket — may be edge case not covered. Wait for Ashlee to supply a repro FUZE#.",
  },

  /**
   * ═══════════════════════════════════════════════════════════════════════
   * NOT YET FIXED — keep open for prioritization. Bumping to TRIAGED so
   * they're out of the 'NEW' column and have notes attached, but not
   * closing. Real work needed.
   * ═══════════════════════════════════════════════════════════════════════
   */

  // Scott — Factory fuze sample discovery (4/20)
  {
    id: "cmo7jxpom0001l404rxscp1uq",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "FEATURE. Need an admin-side view that surfaces factory FUZE sample requests (notifications + a tracker page). Scott currently has no path to locate or fulfill inbound requests. Scope: (1) notification when factory submits a sample request, (2) /admin/sample-requests list, (3) ship + track status. Pri 2.",
  },

  // Ryan — Reassign contacts to new company (4/21)
  {
    id: "cmo8uuuj30001jy04h3zjauv0",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "FEATURE. Move-contact-between-brands flow. Contact.brandId is already FK, so it's a PATCH + UI affordance on /contacts/[id] (brand picker). Preserve history via Note ('moved from Pentland → Colart by Ryan on X'). Pri 3.",
  },

  // KJ Tang — Distributor see uploaded reports + link to brand/customer (4/21)
  {
    id: "cmo9f469v0003l404ry0y03j5",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "FEATURE. /distributor-portal/upload-report needs a list view of previously uploaded reports with a way to link each to a brand or customer. Pri 2 — GS is about to upload a lot.",
  },

  // KJ Tang — Distributor apply for test (4/21)
  {
    id: "cmo9fkqt60001jo043ltcby20",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "FEATURE. Distributor-side 'apply for test' flow (ICP + AM). Likely a mirror of /admin/icp-sample-prep but scoped to distributor's fabrics. Pri 2.",
  },

  // Tina Distributor — 1L options / sample FOC flag / hangtag orders (4/21)
  {
    id: "cmo9jdb1a0009l204ja87rpsu",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "3 features bundled: (1) add 1L + 0.5L order unit sizes for samples, (2) 'charged vs FOC' toggle on sample orders, (3) hangtag order option. Pri 3 — distributors currently working around via email.",
  },

  // Brian Hyman — Fabric library antifungal filter (4/21)
  {
    id: "cmo9jnuhp0001i804omppwqe4",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "BUG. Fungal tests uploaded don't appear when filtering /fabric-library by antifungal. Likely a test-type classification mismatch (FUNGAL vs anti-fungal tag) or filter predicate. Pri 1 — customer-facing, Brian is a brand user at fuze47.jp.",
  },

  // Ashlee — ICP printout alignment (4/22)
  {
    id: "cmoalxjcy0006if04zoqcdhz6",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "BUG. Print CSS overflow on /admin/icp-sample-prep/[po]/print — content getting cut off. Need @media print adjustments or smaller margins. Pri 2 — Ashlee relies on this for CTLA packet.",
  },

  // Ashlee — Support + How do I buttons stacking (4/22)
  {
    id: "cmoalzutg0001k304mdn2q0cz",
    status: "TRIAGED",
    resolution: "",
    triageNote:
      "BUG. Floating AI/support buttons overlap on /test-requests (and probably elsewhere). z-index + stacking-layout fix. Pri 2 — blocks the 'How do I?' AI button.",
  },
];

async function main() {
  const apply = process.argv.includes("--apply");

  const resolver = await prisma.user.findFirst({
    where: { email: RESOLVED_BY_EMAIL },
    select: { id: true, email: true },
  });
  if (!resolver) {
    console.error(`Could not find resolver user by email: ${RESOLVED_BY_EMAIL}`);
    process.exit(1);
  }

  console.log(`\nResolver: ${resolver.email} (${resolver.id})`);
  console.log(`Mode: ${apply ? "APPLY (writing)" : "DRY-RUN (no writes, pass --apply to commit)"}`);
  console.log(`Planned updates: ${RESOLUTIONS.length}\n`);

  const now = new Date();
  let updated = 0;
  let missing = 0;
  let alreadySame = 0;

  for (const r of RESOLUTIONS) {
    const current = await prisma.feedbackReport.findUnique({
      where: { id: r.id },
      select: {
        id: true,
        title: true,
        status: true,
        userName: true,
        userEmail: true,
      },
    });

    if (!current) {
      console.log(`  MISSING  ${r.id}  (not in DB — skipping)`);
      missing++;
      continue;
    }

    if (current.status === r.status) {
      console.log(
        `  SAME     ${r.id}  [${r.status}] ${current.title}  (already ${r.status})`,
      );
      alreadySame++;
      continue;
    }

    console.log(
      `  → ${r.status.padEnd(11)} ${r.id}  [${current.status} → ${r.status}] ${current.title}`,
    );
    console.log(`              from: ${current.userName} <${current.userEmail}>`);
    if (r.commit) console.log(`              commit: ${r.commit}`);
    console.log(`              note: ${r.triageNote}`);

    if (apply) {
      const isResolved = ["FIXED", "REJECTED", "DUPLICATE", "CLOSED"].includes(r.status);
      await prisma.feedbackReport.update({
        where: { id: r.id },
        data: {
          status: r.status,
          triagedById: resolver.id,
          triagedAt: now,
          triageNotes: r.triageNote,
          ...(isResolved
            ? {
                resolvedById: resolver.id,
                resolvedAt: now,
                resolution: r.resolution || null,
                resolutionUrl: r.commit ? `${REPO}/commit/${r.commit}` : null,
              }
            : {}),
        },
      });
      updated++;
    }
  }

  console.log("");
  console.log(`Summary:`);
  console.log(`  updates ${apply ? "applied" : "planned"}: ${RESOLUTIONS.length - alreadySame - missing}`);
  console.log(`  already at target status:             ${alreadySame}`);
  console.log(`  ticket IDs not found:                 ${missing}`);
  if (!apply) {
    console.log(`\n(no writes performed — re-run with --apply to commit changes)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
