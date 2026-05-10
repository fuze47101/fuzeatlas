/**
 * Send a build-lifecycle email + SMS to Andrew on phase boundaries
 * and stop/park events. Used by the autonomous build flow.
 *
 * Usage:
 *   npx tsx scripts/notify-build-event.ts \
 *     --kind=phase-complete \
 *     --phase=4 \
 *     --commits=18 \
 *     --commit=<sha>
 *
 *   npx tsx scripts/notify-build-event.ts \
 *     --kind=paused \
 *     --phase=4F \
 *     --commit=<sha> \
 *     --reason='blocked on prisma db push' \
 *     --needs='reconcile DSN mismatch'
 */

import { sendEmail } from "../src/lib/email";
import { sendSMS } from "../src/lib/sms";
import { execSync } from "node:child_process";

const ANDREW_EMAIL = "andrew@801inc.com";
const ANDREW_PHONE = "+18018096000";
const REPO = "https://github.com/fuze47101/fuzeatlas";

interface Args {
  kind: "phase-complete" | "paused";
  phase: string;
  commit: string;
  commits?: string;
  reason?: string;
  needs?: string;
}

function parseArgs(): Args {
  const args: any = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args as Args;
}

function getRecentCommits(): string {
  try {
    return execSync(`git log --oneline -5`, { encoding: "utf8" }).trim();
  } catch {
    return "(unavailable)";
  }
}

async function main() {
  const args = parseArgs();
  const lastFive = getRecentCommits();

  let subjectLine = "";
  let smsBody = "";
  let bodyHtml = "";

  if (args.kind === "phase-complete") {
    const n = args.commits || "?";
    subjectLine = `Atlas: Phase ${args.phase} complete (${n} commits)`;
    smsBody = `Atlas Phase ${args.phase} done — ${n} commits — see email.`;
    bodyHtml = `
      <p><strong>Phase ${args.phase} of the autonomous Atlas build is complete.</strong></p>
      <p>${n} commits landed cleanly on <code>main</code>. Latest: <code>${args.commit}</code>.</p>
      <h3>Last 5 commits</h3>
      <pre style="background:#f8f8f8;padding:8px;border-radius:4px;font-size:12px">${lastFive}</pre>
      <p>Full log: <a href="${REPO}/blob/main/docs/AUTONOMOUS_BUILD_LOG.md">AUTONOMOUS_BUILD_LOG.md</a></p>
    `;
  } else if (args.kind === "paused") {
    subjectLine = "Atlas autonomous build paused — needs your attention";
    smsBody = `Atlas paused at Phase ${args.phase} — check email for details.`;
    bodyHtml = `
      <p>Build paused at <code>${args.phase}</code> on commit <code>${args.commit}</code>.</p>
      <p><strong>Why:</strong> ${args.reason || "(no reason provided)"}</p>
      <p><strong>What's needed:</strong> ${args.needs || "(no specific ask)"}</p>
      <h3>Last 5 commits</h3>
      <pre style="background:#f8f8f8;padding:8px;border-radius:4px;font-size:12px">${lastFive}</pre>
      <p>Full log: <a href="${REPO}/blob/main/docs/AUTONOMOUS_BUILD_LOG.md">AUTONOMOUS_BUILD_LOG.md</a></p>
    `;
  } else {
    console.error("kind must be phase-complete or paused");
    process.exit(2);
  }

  const [emailRes, smsRes] = await Promise.all([
    sendEmail({
      to: ANDREW_EMAIL,
      subject: subjectLine,
      html: bodyHtml,
      replyTo: "andrew@fuze47.com",
    }).catch((e: any) => ({ ok: false, error: e?.message })),
    sendSMS({ to: ANDREW_PHONE, body: smsBody }),
  ]);

  console.log(JSON.stringify({ email: emailRes, sms: smsRes }));
}

main();
