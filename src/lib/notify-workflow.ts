// @ts-nocheck
/**
 * Lab Testing Workflow — Notification Routing
 *
 * Determines WHO gets notified at each workflow stage.
 * Uses: salesRepId (account manager), lab users, admins.
 *
 * Notification targets:
 * - Customer: the requestedBy user (factory/brand who submitted)
 * - Account Manager: salesRepId on the Factory or Brand
 * - Lab Team: users with labId matching the test request's lab
 * - FUZE Admins: ADMIN + EMPLOYEE users (fallback)
 */

import { prisma } from "@/lib/prisma";

export interface NotifyTargets {
  customer: { email: string; name: string } | null;
  accountManager: { email: string; name: string } | null;
  labTeam: { email: string; name: string }[];
  admins: { email: string; name: string }[];
}

/**
 * Resolve all notification targets for a test request.
 * Call this once, then send to whichever groups the stage requires.
 */
export async function resolveNotifyTargets(testRequestId: string): Promise<NotifyTargets> {
  const tr = await prisma.testRequest.findUnique({
    where: { id: testRequestId },
    include: {
      requestedBy: { select: { email: true, name: true } },
      lab: { select: { id: true } },
      fabric: {
        select: {
          factoryId: true,
          factory: {
            select: {
              salesRepId: true,
              salesRep: { select: { email: true, name: true } },
            },
          },
        },
      },
      brand: {
        select: {
          salesRepId: true,
          salesRep: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (!tr) {
    return { customer: null, accountManager: null, labTeam: [], admins: [] };
  }

  // Customer = the person who submitted the request
  const customer = tr.requestedBy?.email
    ? { email: tr.requestedBy.email, name: tr.requestedBy.name || "Team" }
    : null;

  // Account Manager = salesRep on the factory or brand
  let accountManager: { email: string; name: string } | null = null;
  if (tr.fabric?.factory?.salesRep?.email) {
    accountManager = {
      email: tr.fabric.factory.salesRep.email,
      name: tr.fabric.factory.salesRep.name || "Account Manager",
    };
  } else if (tr.brand?.salesRep?.email) {
    accountManager = {
      email: tr.brand.salesRep.email,
      name: tr.brand.salesRep.name || "Account Manager",
    };
  }

  // Lab Team = active users assigned to this lab
  const labTeam: { email: string; name: string }[] = [];
  if (tr.labId) {
    const labUsers = await prisma.user.findMany({
      where: {
        labId: tr.labId,
        status: "ACTIVE",
      },
      select: { email: true, name: true },
    });
    for (const u of labUsers) {
      if (u.email) {
        labTeam.push({ email: u.email, name: u.name || "Lab Team" });
      }
    }
  }

  // FUZE Admins = ADMIN + EMPLOYEE users
  const adminUsers = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "EMPLOYEE"] },
      status: "ACTIVE",
    },
    select: { email: true, name: true },
  });
  const admins = adminUsers
    .filter((u: any) => u.email)
    .map((u: any) => ({ email: u.email, name: u.name || "Admin" }));

  return { customer, accountManager, labTeam, admins };
}

/**
 * Get email addresses for a set of targets, deduped.
 */
export function collectEmails(...groups: ({ email: string; name: string } | null | { email: string; name: string }[])[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    const items = Array.isArray(group) ? group : [group];
    for (const item of items) {
      if (item?.email && !seen.has(item.email)) {
        seen.add(item.email);
        result.push(item.email);
      }
    }
  }
  return result;
}

/**
 * Stage-specific notification routing.
 * Returns which email addresses to notify for each workflow event.
 */
export async function getNotifyEmails(testRequestId: string, stage: string): Promise<{
  toCustomer: string[];
  toInternal: string[];
  targets: NotifyTargets;
}> {
  const targets = await resolveNotifyTargets(testRequestId);

  switch (stage) {
    case "REQUEST_SUBMITTED":
      // → Admins + Account Manager
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.admins, targets.accountManager),
        targets,
      };

    case "APPROVED":
      // → Customer gets shipping form; AM gets notified
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.accountManager),
        targets,
      };

    case "SAMPLE_SHIPPED":
      // → Lab team + admins + AM (sample is coming!)
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.labTeam, targets.admins, targets.accountManager),
        targets,
      };

    case "SAMPLE_RECEIVED":
      // → Customer (auto-reply) + AM
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.accountManager),
        targets,
      };

    case "TESTING_STARTED":
      // → Customer + AM
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.accountManager),
        targets,
      };

    case "RESULTS_READY":
      // → Customer + AM
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.accountManager, targets.admins),
        targets,
      };

    default:
      return {
        toCustomer: targets.customer ? [targets.customer.email] : [],
        toInternal: collectEmails(targets.admins),
        targets,
      };
  }
}
