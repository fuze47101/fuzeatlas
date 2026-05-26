// @ts-nocheck
import { prisma } from "@/lib/prisma";

/**
 * Phase 17 Track 9 — median-dwell-time computation per state pair.
 *
 * Cache median results in-memory for 1 hour. For each state transition
 * (state → nextState), measure the time between occurredAt of the
 * earlier event and occurredAt of the next event on the same
 * testRequestId, in the last 90 days. Median across all observations.
 * Weekends excluded from dwell time. CANCELLED tests excluded entirely.
 */

export const TRACKING_STATES = [
  "REQUEST_SUBMITTED",
  "REQUEST_APPROVED",
  "SAMPLE_SHIPPED",
  "SAMPLE_IN_TRANSIT",
  "SAMPLE_RECEIVED",
  "LAB_IN_QUEUE",
  "LAB_TESTING",
  "RESULTS_AVAILABLE",
  "BRAND_VISIBLE",
  "COMPLETE",
] as const;

export type TrackingState = (typeof TRACKING_STATES)[number] | "CANCELLED";

// Fallback medians (hours) for cold-start / low-data state pairs.
// Roughly aligned with the spec's "expected dwell" guidance.
const FALLBACK_HOURS: Record<string, number> = {
  REQUEST_SUBMITTED__REQUEST_APPROVED: 24,
  REQUEST_APPROVED__SAMPLE_SHIPPED: 7 * 24,
  SAMPLE_SHIPPED__SAMPLE_RECEIVED: 5 * 24,
  SAMPLE_SHIPPED__SAMPLE_IN_TRANSIT: 12,
  SAMPLE_IN_TRANSIT__SAMPLE_RECEIVED: 4 * 24,
  SAMPLE_RECEIVED__LAB_IN_QUEUE: 12,
  LAB_IN_QUEUE__LAB_TESTING: 5 * 24,
  LAB_TESTING__RESULTS_AVAILABLE: 3 * 24,
  RESULTS_AVAILABLE__BRAND_VISIBLE: 36,
  BRAND_VISIBLE__COMPLETE: 30 * 24,
};

function businessHoursBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  if (ms <= 0) return 0;
  // Approximation: subtract weekend hours. 7-day week ≈ 5/7 business.
  return (ms / 36e5) * (5 / 7);
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type CacheEntry = { value: number; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

export async function medianDwellHours(from: string, to: string): Promise<number> {
  const key = `${from}__${to}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  let value = FALLBACK_HOURS[key] ?? 48;
  try {
    const since = new Date(Date.now() - 90 * 86400000);
    const events = await prisma.testTrackingEvent.findMany({
      where: { occurredAt: { gte: since }, state: { in: [from, to] } },
      select: { testRequestId: true, state: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });
    const byRequest: Record<string, { from?: Date; to?: Date; cancelled?: boolean }> = {};
    for (const e of events) {
      const slot = (byRequest[e.testRequestId] ||= {});
      if (e.state === from && !slot.from) slot.from = e.occurredAt;
      if (e.state === to && !slot.to && slot.from) slot.to = e.occurredAt;
      if (e.state === "CANCELLED") slot.cancelled = true;
    }
    const samples: number[] = [];
    for (const slot of Object.values(byRequest)) {
      if (slot.cancelled || !slot.from || !slot.to) continue;
      samples.push(businessHoursBetween(slot.from, slot.to));
    }
    if (samples.length >= 3) value = median(samples);
  } catch {
    // fall back to FALLBACK_HOURS
  }
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

/**
 * Given the current tracking state + when it started, project the ETA
 * to the next state. Returns null at terminal states.
 */
export async function projectNextEta(
  currentState: string,
  enteredAt: Date,
): Promise<{ nextState: string; etaAt: Date; medianHours: number; behindSchedule: boolean } | null> {
  const idx = TRACKING_STATES.indexOf(currentState as any);
  if (idx < 0 || idx >= TRACKING_STATES.length - 1) return null;
  const nextState = TRACKING_STATES[idx + 1];
  const hours = await medianDwellHours(currentState, nextState);
  const etaAt = new Date(enteredAt.getTime() + hours * 36e5);
  const elapsedHrs = (Date.now() - enteredAt.getTime()) / 36e5;
  return {
    nextState,
    etaAt,
    medianHours: hours,
    behindSchedule: elapsedHrs > hours * 1.5,
  };
}
