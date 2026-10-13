import { after } from "next/server";

/**
 * Keep the serverless function instance alive until `p` settles.
 *
 * WHY THIS EXISTS
 * ---------------
 * Most of the Atlas API fires notification work without awaiting it — the
 * "fire-and-forget" pattern:
 *
 *     sendEmail({ ... }).catch((e) => console.error(e));
 *     return NextResponse.json({ ok: true });
 *
 * That works on a long-lived Node server. It does NOT work on Vercel. The
 * function instance is frozen the instant the response is returned, so the
 * in-flight fetch() to Resend is cancelled before it is ever sent — silently,
 * with no error in the logs, because the .catch() never runs either.
 *
 * That is why no admin email was being delivered from any route: new access
 * requests, logins, orders, test requests and sample trials all used this
 * pattern.
 *
 * after() registers the work with the Next.js runtime, which holds the
 * instance open until it completes. Callers that DO await are unaffected —
 * they still get the real result.
 *
 * No-ops outside a request context (seed scripts, standalone tooling), where
 * after() is not available and the process stays alive on its own.
 */
export function keepAlive<T>(p: Promise<T>): Promise<T> {
  try {
    // Pass a settled-either-way chain so after() never sees a rejection;
    // the original promise is returned untouched for the caller to handle.
    after(p.then(() => {}, () => {}));
  } catch {
    /* not in a request scope — nothing to keep alive */
  }
  return p;
}
