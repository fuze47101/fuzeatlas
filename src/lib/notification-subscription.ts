// @ts-nocheck
/**
 * Per-user notification subscription helper (Phase 5D).
 *
 * `isSubscribed(userId, category)` returns true unless the user has
 * EXPLICITLY toggled the category off in NotificationSubscription
 * .preferences. Defaults all-on:
 *   - No row at all       → subscribed
 *   - Row exists, no key  → subscribed
 *   - Row exists, key=true → subscribed
 *   - Row exists, key=false → unsubscribed (mute)
 *
 * Admin / employee roles ALWAYS receive notifications regardless of
 * personal preference — they're operational and need full coverage.
 *
 * Caches per-user prefs for the lifetime of one request (in-memory
 * Map keyed by userId). Notify fan-outs touch the same userId N times
 * within a single helper call; without caching that's N round-trips.
 */

import { prisma } from "@/lib/prisma";

const ADMIN_ROLES = new Set(["ADMIN", "EMPLOYEE"]);

interface CachedRow {
  role: string;
  preferences: Record<string, boolean>;
}

const requestCache = new Map<string, CachedRow>();

async function loadUser(userId: string): Promise<CachedRow | null> {
  if (requestCache.has(userId)) return requestCache.get(userId)!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      notifSubscription: { select: { preferences: true } },
    },
  });
  if (!user) return null;
  const row: CachedRow = {
    role: user.role,
    preferences: (user.notifSubscription?.preferences as any) || {},
  };
  requestCache.set(userId, row);
  return row;
}

export async function isSubscribed(userId: string, category: string): Promise<boolean> {
  if (!userId || !category) return true; // safest default — fan out
  try {
    const row = await loadUser(userId);
    if (!row) return true;
    if (ADMIN_ROLES.has(row.role)) return true;
    const v = row.preferences?.[category];
    if (v === false) return false;
    return true; // missing key OR explicit true
  } catch {
    return true; // any error → fan out (don't drop notifications silently)
  }
}

/**
 * Filter an array of recipient userIds to those subscribed to the
 * given category. Convenience wrapper around isSubscribed for the
 * common "createMany over a recipient set" pattern in notify helpers.
 */
export async function filterSubscribed(
  userIds: string[],
  category: string,
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const results = await Promise.all(
    userIds.map(async (id) => ((await isSubscribed(id, category)) ? id : null)),
  );
  return results.filter((id): id is string => !!id);
}

/**
 * Reset the per-request cache. Call between requests if you're
 * running this in a long-lived process (e.g. cron job that loops
 * over many users).
 */
export function resetSubscriptionCache(): void {
  requestCache.clear();
}
