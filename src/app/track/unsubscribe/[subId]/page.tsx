// @ts-nocheck
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  const { subId } = await params;

  let ok = false;
  let email: string | null = null;
  try {
    const sub = await (prisma as any).testTrackingSubscription.update({
      where: { id: subId },
      data: { unsubscribedAt: new Date() },
      select: { id: true, email: true },
    });
    ok = !!sub;
    email = sub?.email || null;
  } catch {
    ok = false;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-indigo-600">FUZE Atlas</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-900">
            {ok ? "Unsubscribed" : "Subscription not found"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {ok
              ? `${email || "You"} will no longer receive updates for this test.`
              : "This subscription may have already been removed, or the link is invalid."}
          </p>
        </div>
      </main>
    </div>
  );
}
