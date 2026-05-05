/**
 * scripts/resolve-tonight-tickets.ts
 *
 * One-shot resolver for the 16 open feedback tickets as of 2026-05-04.
 * Marks tonight's verified fixes as FIXED with resolution text, closes
 * the obvious test/data-update tickets, and leaves real open work alone.
 *
 * Run:  npx tsx scripts/resolve-tonight-tickets.ts
 *
 * Idempotent — safe to re-run. If a ticket is already FIXED/REJECTED/CLOSED
 * it is left untouched.
 */
import { prisma } from "../src/lib/prisma";

type Action =
  | {
      id: string;
      to: "FIXED";
      resolution: string;
      resolutionUrl?: string;
    }
  | {
      id: string;
      to: "REJECTED" | "CLOSED" | "DUPLICATE";
      resolution: string;
    };

const RESOLVER_EMAIL = "andrew@fuze47.com";

const ACTIONS: Action[] = [
  // ── FIXED tonight ─────────────────────────────────────────────────
  {
    id: "cmoji3ujg0007l804jxwkdhvx",
    to: "FIXED",
    resolution:
      "Lab upload visibility bug fixed. The /api/lab-portal/uploads endpoint was selecting fields (brand/factory/fabric/result/status/reportNumber) that don't live on TestRun, so Prisma silently failed and your uploads disappeared from history. Endpoint now walks submission.brand/factory/fabric, uses testReportNumber, and derives a status flag. Your upload is in the system — it just wasn't being rendered.",
    resolutionUrl: "https://fuzeatlas.com/lab-portal/uploads",
  },
  {
    id: "cmojjerv50003k104iqf2qlw3",
    to: "FIXED",
    resolution:
      "You can now delete duplicate or mistakenly uploaded test reports. Added a delete action to the lab portal upload list — guarded so lab users can only delete their own uploads, and a delete is refused if the document is already linked to a TestRun (we don't orphan results). Reload your upload history and use the trash icon.",
    resolutionUrl: "https://fuzeatlas.com/lab-portal/uploads",
  },
  {
    id: "cmojjb1s20001l8041leh3rjq",
    to: "FIXED",
    resolution:
      "Yes — added a + New Distributor button to /admin/distributors. Opens a modal where you can set name, country, and optionally auto-generate a test DISTRIBUTOR_USER for View As. It also handles dedup if the email is already in the system.",
    resolutionUrl: "https://fuzeatlas.com/admin/distributors",
  },
  {
    id: "cmojnnnkt0001js04pyi8lwcr",
    to: "FIXED",
    resolution:
      "Fixed. The user-edit form on /settings/users now exposes brand / factory / distributor / lab pickers when you pick a role that requires one. The API also enforces this — if you try to switch Danny to a role that needs a company link without picking one, you get a clear error instead of a silent 500. You should be able to save Danny's role + status + distributor in one click now.",
    resolutionUrl: "https://fuzeatlas.com/settings/users",
  },
  {
    id: "cmoldly480003ld04d03fgxqo",
    to: "FIXED",
    resolution:
      "Same fix as Danny's ticket — the user-edit form was only sending {role, status} and stranding the entity FK when you switched role categories. Now exposes a distributor picker (and brand/factory/lab when relevant) and clears stale FKs automatically. Should save cleanly now.",
    resolutionUrl: "https://fuzeatlas.com/settings/users",
  },
  {
    id: "cmo8czto90003jx04ye6iuas9",
    to: "FIXED",
    resolution:
      "Test report parsing improved. Added an AI-vision fallback (Anthropic) that runs when the regex extractor confidence is < 25 or pulls fewer than 200 chars of meaningful text — which is exactly what happens on most lab PDFs. We now also auto-email admins on low-confidence uploads so we can catch parser misses early. Try uploading the same lab PDF again and the lab name / test date / result should populate.",
    resolutionUrl: "https://fuzeatlas.com/tests/upload",
  },

  // ── Housekeeping ──────────────────────────────────────────────────
  {
    id: "cmojsn1vg0001gq04o9uzpqc7",
    to: "CLOSED",
    resolution:
      "Closing — description was just 'testing'. If Hubert hits a real issue on /factory-portal/sample-trial, please re-file with repro steps.",
  },
  {
    id: "cmom3egrt005wjo04ylcmxjrs",
    to: "REJECTED",
    resolution:
      "Not a bug — this is a CRM data update. Julia Harman moving to Banana Republic should be handled by editing her contact record (re-link to the BR brand) and adding the LinkedIn URL. Tracking as a follow-up for Andrew/Ryan to action.",
  },

  // ── 2026-05-04 batch — the eight remaining open tickets ──────────
  {
    id: "cmokd13mn0001la041dpwof47",
    to: "FIXED",
    resolution:
      "Fixed. The /api/brand-portal/test-request endpoint was rejecting any user without their own brandId or factoryId set on their account — which means EMPLOYEE / ADMIN / BD_REP / LAB users were being told 'fabric is not assigned' even when the fabric clearly was. Admin-class roles now fall back to the fabric's own brand and factory when looking up the request, so you can submit testing on any fabric you have access to. The error message also now tells you which side is missing.",
    resolutionUrl: "https://fuzeatlas.com/fabrics/cmn4ppnzs0001ky04xrttfs8l",
  },
  {
    id: "cmokg48ha0002kv04dtcnjfi7",
    to: "FIXED",
    resolution:
      "Fixed. On /tests/upload the fabric picker was building each option's label from `customerCode || fuzeNumber || factoryCode`, so when a fabric had a customer code the FUZE number wasn't in any field the search filtered on. The label now packs FUZE# + customer code + factory code together — searching '2502' will hit FUZE 2502 even if the fabric also has a customer code.",
    resolutionUrl: "https://fuzeatlas.com/tests/upload",
  },
  {
    id: "cmom20xdz003mk1041dzun86g",
    to: "FIXED",
    resolution:
      "Fixed. Two issues stacked: (1) the prompt listed the rep's seed answers twice and demanded 'verbatim phrases', which made the AI paste raw answer text into sentences awkwardly. We now list once with instructions to paraphrase. (2) The humanize scrubber that runs over the AI output was doing destructive replacements like 'quick chat' → '15 minutes' and 'I'd love to chat' → 'Worth a quick call?' mid-sentence, which broke grammar. Replaced with safer swaps and start-of-sentence guards. Drafts will now incorporate your context naturally instead of shoehorning it.",
    resolutionUrl: "https://fuzeatlas.com/admin/bd/wizard",
  },
  {
    id: "cmon7n0me0001ld04te3zrihr",
    to: "FIXED",
    resolution:
      "Same root-cause fix as Ryan's ticket (cmom20xdz). The 'incomplete sentences' were coming from the post-generation scrubber — `quick chat` was being swapped to `15 minutes` and `I'd love to chat` was being swapped to `Worth a quick call?` mid-sentence, creating broken grammar. Replaced both with safer swaps. Also tightened the prompt so the AI integrates your context as facts rather than pasting it as quotes, and added an explicit rule against generic intro lines after the greeting. Try a draft and the tone + sentence structure should land cleanly.",
    resolutionUrl: "https://fuzeatlas.com/admin/bd/wizard",
  },
  {
    id: "cmoi1kz7x0001l604sm3ab6z6",
    to: "FIXED",
    resolution:
      "Fixed. The dashboard role-routing was happening client-side with a window.location.href bounce, which produced a brief 'welcome' flash for distributor users and could miss the redirect entirely if the client-side role check fell through. Moved the bounce into middleware so /, /home, and /dashboard now redirect external users (DISTRIBUTOR_USER, BRAND_USER, FACTORY_USER, LAB_USER) to their own portal before the page ever renders.",
    resolutionUrl: "https://fuzeatlas.com/distributor-portal",
  },
  {
    id: "cmo8d1yuy000djx044bmaiv07",
    to: "FIXED",
    resolution:
      "Fixed. The Linked Entities edit panel on /tests/[id] was only rendering when the test already had a submission or project — which left freshly uploaded standalone reports with no edit affordance at all. Panel now always renders for admins. The factory dropdown is also no longer gated by 'has submission' — picking a factory on a standalone report will create the FabricSubmission record on the fly and link it to the test. So you can retag both factory and project on any test report.",
    resolutionUrl: "https://fuzeatlas.com/tests",
  },
  {
    id: "cmo4u8xjm0001jr042iq8mrqf",
    to: "FIXED",
    resolution:
      "Fixed. The /api/fabrics search was capping results at the requested pageSize even when a query was present, so a fabric matching the query but outside the top 200 (sorted by FUZE number desc) would silently disappear. We now drop the page cap whenever a search query is set, and the submission-side OR clause now matches fuzeFabricNumber + customerFabricCode + factoryFabricCode together (it used to only match one or the other depending on whether the query was numeric). 'FUZE-' prefixes the user might type are also stripped before parsing the number. Try the same lookup that returned blank — it should land now.",
    resolutionUrl: "https://fuzeatlas.com/admin/icp-sample-prep",
  },
  {
    id: "cmoam7lr40001l4045j3powo4",
    to: "FIXED",
    resolution:
      "Same root-cause fix as Ashlee's earlier ticket (cmo4u8xjm). The fabric search was capping at pageSize even when you searched, and the submission OR clause only matched one field at a time. We now return all matches when there's a query and check fuzeFabricNumber + customerFabricCode + factoryFabricCode together. If a specific FUZE# still doesn't pull, please ping me with the exact number so we can audit that fabric record directly.",
    resolutionUrl: "https://fuzeatlas.com/admin/icp-sample-prep",
  },
];

async function main() {
  const resolver = await prisma.user.findFirst({
    where: { email: RESOLVER_EMAIL },
    select: { id: true, email: true },
  });
  if (!resolver) {
    throw new Error(`Resolver user not found: ${RESOLVER_EMAIL}`);
  }
  console.log(`Resolving as ${resolver.email} (${resolver.id})\n`);

  let fixed = 0,
    closed = 0,
    rejected = 0,
    skipped = 0,
    notFound = 0;

  for (const a of ACTIONS) {
    const existing = await prisma.feedbackReport.findUnique({
      where: { id: a.id },
      select: { id: true, status: true, title: true },
    });
    if (!existing) {
      console.log(`  [skip] ${a.id} — not found in DB`);
      notFound++;
      continue;
    }
    if (["FIXED", "REJECTED", "CLOSED", "DUPLICATE"].includes(existing.status)) {
      console.log(
        `  [skip] ${a.id} — already ${existing.status} (“${existing.title}”)`,
      );
      skipped++;
      continue;
    }

    const data: any = {
      status: a.to,
      resolvedById: resolver.id,
      resolvedAt: new Date(),
      resolution: a.resolution,
    };
    if (a.to === "FIXED" && "resolutionUrl" in a && a.resolutionUrl) {
      data.resolutionUrl = a.resolutionUrl;
    }

    await prisma.feedbackReport.update({
      where: { id: a.id },
      data,
    });

    console.log(`  [${a.to}] ${a.id} — ${existing.title}`);
    if (a.to === "FIXED") fixed++;
    else if (a.to === "CLOSED") closed++;
    else if (a.to === "REJECTED") rejected++;
  }

  console.log(
    `\nDone. fixed=${fixed} closed=${closed} rejected=${rejected} skipped=${skipped} notFound=${notFound}`,
  );

  // Summary of what's still open
  const stillOpen = await prisma.feedbackReport.count({
    where: { status: { in: ["NEW", "TRIAGED", "ACCEPTED", "IN_PROGRESS"] } },
  });
  console.log(`Still open after this run: ${stillOpen}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
