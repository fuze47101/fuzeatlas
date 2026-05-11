// @ts-nocheck
/**
 * Auto-notification triggers for FUZE Atlas (F-031)
 * Creates in-app notifications when important events occur.
 * Each function creates a Notification record in the database.
 */

import { prisma } from "@/lib/prisma";
import { filterSubscribed } from "@/lib/notification-subscription";

type NotificationType =
  | "TEST_APPROVED"
  | "TEST_RESULTS"
  | "ACCESS_REQUEST"
  | "PO_STATUS"
  | "SOW_UPDATE"
  | "BRAND_ACTIVITY"
  | "USER_LOGIN"
  | "SYSTEM";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

async function createNotification(params: NotifyParams) {
  try {
    await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link || null,
        metadata: params.metadata || {},
      },
    });
  } catch (e) {
    console.error("[NOTIFY] Failed to create notification:", e);
  }
}

// ─── Notify all admins ───

async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return admins.map((a: any) => a.id);
}

async function notifyAdmins(type: NotificationType, title: string, message: string, link?: string) {
  const adminIds = await getAdminIds();
  await Promise.all(
    adminIds.map((id) => createNotification({ userId: id, type, title, message, link })),
  );
}

// ─── Public trigger functions ───

/** When a test status changes to PASSED, FAILED, or RETEST */
export async function notifyTestResult(params: {
  testId: string;
  testName: string;
  result: string;
  brandId?: string;
  factoryId?: string;
}) {
  const { testId, testName, result, brandId, factoryId } = params;

  // Notify admins
  await notifyAdmins(
    "TEST_RESULTS",
    `Test ${result}: ${testName}`,
    `Test "${testName}" has been marked as ${result}.`,
    `/tests/${testId}`,
  );

  // Notify brand users if linked. Subscription check (Phase 5D) —
  // category test_result_brand_visible. Admins always pass through.
  if (brandId) {
    const brandUsers = await prisma.user.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = await filterSubscribed(
      brandUsers.map((u: any) => u.id),
      "test_result_brand_visible",
    );
    await Promise.all(
      recipients.map((uid) =>
        createNotification({
          userId: uid,
          type: "TEST_RESULTS",
          title: `Test Results: ${testName}`,
          message: `Your test "${testName}" result: ${result}`,
          link: `/brand-portal/tests`,
        }),
      ),
    );
  }

  // Notify factory users if linked
  if (factoryId) {
    const factoryUsers = await prisma.user.findMany({
      where: { factoryId, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = await filterSubscribed(
      factoryUsers.map((u: any) => u.id),
      "test_result_brand_visible",
    );
    await Promise.all(
      recipients.map((uid) =>
        createNotification({
          userId: uid,
          type: "TEST_RESULTS",
          title: `Test Results: ${testName}`,
          message: `Test "${testName}" result: ${result}`,
          link: `/factory-portal/submissions`,
        }),
      ),
    );
  }
}

/**
 * Phase 7D — when an item flips to brandApprovalStatus=PENDING,
 * notify every active brand user (subscription-filtered on the
 * `approval_pending` category). Always also notifies admins so
 * Andrew has a tracking copy. Tries to send an email if RESEND
 * is configured; in-app notification always fires.
 */
export async function notifyApprovalPending(params: {
  brandId: string;
  brandName: string;
  kind: "submission" | "test" | "order";
  /** Display ref — fabric FUZE# / report# / order#. */
  ref: string;
  /** Optional Atlas link to the item. Defaults to /brand-portal/approvals. */
  link?: string;
}) {
  const { brandId, brandName, kind, ref } = params;
  const link = params.link || "/brand-portal/approvals";
  const kindLabel =
    kind === "submission" ? "fabric submission" : kind === "test" ? "test result" : "production order";
  const title = `Approval needed: ${kindLabel} ${ref}`;
  const message = `A ${kindLabel} (${ref}) for ${brandName} is awaiting your approval. Open the approvals queue to review.`;

  // Brand users — subscription-filtered.
  try {
    const brandUsers = await prisma.user.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true },
    });
    const recipients = await filterSubscribed(
      brandUsers.map((u: any) => u.id),
      "approval_pending",
    );
    await Promise.all(
      recipients.map((uid) =>
        createNotification({
          userId: uid,
          type: "PO_STATUS",
          title,
          message,
          link,
          metadata: { kind: "approval_pending", subjectKind: kind, ref },
        }),
      ),
    );
  } catch (err) {
    console.error("[notify] approval-pending brand fan-out failed:", err);
  }

  // Admins — always (operational).
  await notifyAdmins("PO_STATUS", title, message, link);
}

/** When a SOW status changes */
export async function notifySOWStatusChange(params: {
  sowId: string;
  sowTitle: string;
  newStatus: string;
  brandId?: string;
  changedBy?: string;
}) {
  const { sowId, sowTitle, newStatus, brandId, changedBy } = params;

  const statusLabels: Record<string, string> = {
    DRAFT: "Draft",
    SENT: "Sent for Signature",
    SIGNED: "Signed",
    ACTIVE: "Active",
    COMPLETE: "Complete",
    CANCELLED: "Cancelled",
  };

  // Notify admins (except the one who made the change)
  const adminIds = await getAdminIds();
  await Promise.all(
    adminIds
      .filter((id) => id !== changedBy)
      .map((id) =>
        createNotification({
          userId: id,
          type: "SOW_UPDATE",
          title: `SOW ${statusLabels[newStatus] || newStatus}`,
          message: `"${sowTitle}" status changed to ${statusLabels[newStatus] || newStatus}.`,
          link: `/sow/${sowId}`,
        }),
      ),
  );

  // Notify brand users
  if (brandId) {
    const brandUsers = await prisma.user.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      brandUsers.map((u: any) =>
        createNotification({
          userId: u.id,
          type: "SOW_UPDATE",
          title: `SOW Updated: ${sowTitle}`,
          message: `Your Statement of Work status is now: ${statusLabels[newStatus] || newStatus}`,
          link: `/brand-portal/submissions`,
        }),
      ),
    );
  }
}

/** When an access request is submitted */
export async function notifyNewAccessRequest(params: {
  requestId: string;
  name: string;
  company: string;
  type: "BRAND" | "FACTORY";
}) {
  await notifyAdmins(
    "ACCESS_REQUEST",
    `New ${params.type.toLowerCase()} access request`,
    `${params.name} from ${params.company} has requested ${params.type.toLowerCase()} access.`,
    `/settings/access-requests`,
  );
}

/** When a brand moves pipeline stages */
export async function notifyPipelineChange(params: {
  brandId: string;
  brandName: string;
  oldStage: string;
  newStage: string;
  changedBy?: string;
}) {
  const { brandId, brandName, oldStage, newStage, changedBy } = params;

  // Notify all employees/admins who might work this brand
  const teamUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"] },
    },
    select: { id: true },
  });

  await Promise.all(
    teamUsers
      .filter((u: any) => u.id !== changedBy)
      .map((u: any) =>
        createNotification({
          userId: u.id,
          type: "BRAND_ACTIVITY",
          title: `Pipeline: ${brandName}`,
          message: `${brandName} moved from ${oldStage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")}.`,
          link: `/brands/${brandId}`,
        }),
      ),
  );
}

/** When a new fabric submission comes in from the factory portal */
export async function notifyNewSubmission(params: {
  factoryName: string;
  fabricName: string;
  submittedBy: string;
  // Penfabric phase 1 May 2026 — when these are passed, also fan out to
  // factory teammates (so the rest of the factory sees what was just
  // logged) and to the brand owner's whole team (so they have early
  // visibility into incoming work for them). The original submitter is
  // excluded — they already know they just clicked the button.
  brandId?: string | null;
  factoryId?: string | null;
  submitterUserId?: string | null;
  submissionId?: string | null;
  fabricId?: string | null;
}) {
  const {
    factoryName,
    fabricName,
    submittedBy,
    brandId,
    factoryId,
    submitterUserId,
    submissionId,
    fabricId,
  } = params;

  // 1. Admins always get notified — preserves the historical behaviour.
  await notifyAdmins(
    "BRAND_ACTIVITY",
    "New Fabric Submission",
    `${factoryName} submitted "${fabricName}" (by ${submittedBy}).`,
    `/fabrics`,
  );

  // 2. Factory teammates — subscription-filtered (Phase 5D).
  if (factoryId) {
    try {
      const factoryUsers = await prisma.user.findMany({
        where: { factoryId, status: "ACTIVE" },
        select: { id: true },
      });
      const link = fabricId ? `/fabrics/${fabricId}` : "/factory-portal/submissions";
      const candidateIds = factoryUsers
        .filter((u: any) => u.id !== submitterUserId)
        .map((u: any) => u.id);
      const recipients = await filterSubscribed(candidateIds, "fabric_submission_received");
      await Promise.all(
        recipients.map((uid) =>
          createNotification({
            userId: uid,
            type: "BRAND_ACTIVITY",
            title: `Fabric submitted: ${fabricName}`,
            message: `${submittedBy} submitted ${fabricName} from ${factoryName}. Track progress in the factory portal.`,
            link,
            metadata: { submissionId, fabricId },
          }),
        ),
      );
    } catch (err) {
      console.error("[notify] new-submission factory fan-out failed:", err);
    }
  }

  // 3. Brand owners — subscription-filtered (Phase 5D).
  if (brandId) {
    try {
      const brandUsers = await prisma.user.findMany({
        where: { brandId, status: "ACTIVE" },
        select: { id: true },
      });
      const link = fabricId ? `/fabrics/${fabricId}` : "/brand-portal/submissions";
      const recipients = await filterSubscribed(
        brandUsers.map((u: any) => u.id),
        "fabric_submission_received",
      );
      await Promise.all(
        recipients.map((uid) =>
          createNotification({
            userId: uid,
            type: "BRAND_ACTIVITY",
            title: `New fabric submission: ${fabricName}`,
            message: `${factoryName} submitted ${fabricName} for your account. Track in the brand portal.`,
            link,
            metadata: { submissionId, fabricId },
          }),
        ),
      );
    } catch (err) {
      console.error("[notify] new-submission brand fan-out failed:", err);
    }
  }
}

/** When a test request status changes */
export async function notifyTestRequestStatus(params: {
  testRequestId: string;
  status: string;
  createdByUserId?: string;
  poNumber?: string;
  factoryName?: string;
  // Penfabric phase 1 May 2026 — when these are passed, fan out to the
  // org's whole user base (not just the one person who clicked submit)
  // for customer-facing transitions: APPROVED, SUBMITTED, IN_PROGRESS,
  // RESULTS_RECEIVED, COMPLETE. Skip for PENDING_APPROVAL/REJECTED/
  // CANCELLED — those are internal admin states.
  brandId?: string | null;
  factoryId?: string | null;
}) {
  const { testRequestId, status, createdByUserId, poNumber, factoryName, brandId, factoryId } =
    params;

  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: "Awaiting Approval",
    APPROVED: "Approved",
    SUBMITTED: "Submitted to Lab",
    IN_PROGRESS: "In Progress",
    RESULTS_RECEIVED: "Results Received",
    COMPLETE: "Complete",
    CANCELLED: "Cancelled",
    REJECTED: "Rejected",
  };

  const label = statusLabels[status] || status;
  const ref = poNumber || testRequestId;

  // Notify the person who created the test request
  if (createdByUserId) {
    await createNotification({
      userId: createdByUserId,
      type: "PO_STATUS",
      title: `Test Request ${label}: ${ref}`,
      message: `Your test request ${ref} has been ${label.toLowerCase()}.`,
      link: `/test-requests`,
    });
  }

  // Notify admins for PENDING_APPROVAL (new submission needs triage) and RESULTS_RECEIVED
  if (["PENDING_APPROVAL", "RESULTS_RECEIVED"].includes(status)) {
    const fromWho = factoryName ? ` from ${factoryName}` : "";
    const message =
      status === "PENDING_APPROVAL"
        ? `New test request ${ref}${fromWho} is awaiting your approval.`
        : `Results received for test request ${ref}${fromWho}. Ready for review.`;
    await notifyAdmins("PO_STATUS", `Test Request ${label}: ${ref}`, message, `/test-requests`);
  }

  // Customer-facing fan-out — brand users + factory users at the org
  // level. Penfabric/Raihana fix: the factory submitter knew about it,
  // but the rest of the factory (and the brand owner) had no idea their
  // PO had moved. Skip internal-only states.
  const customerFacingStates = ["APPROVED", "SUBMITTED", "IN_PROGRESS", "RESULTS_RECEIVED", "COMPLETE"];
  if (customerFacingStates.includes(status)) {
    const orgMessage =
      status === "RESULTS_RECEIVED"
        ? `Results are in for test request ${ref}. Open the request to review.`
        : status === "COMPLETE"
        ? `Test request ${ref} is complete and closed out.`
        : status === "APPROVED"
        ? `Test request ${ref} has been approved and queued for the lab.`
        : status === "SUBMITTED"
        ? `Test request ${ref} has been submitted to the lab.`
        : `Test request ${ref} is now in progress at the lab.`;

    if (brandId) {
      try {
        const brandUsers = await prisma.user.findMany({
          where: { brandId, status: "ACTIVE" },
          select: { id: true },
        });
        const candidateIds = brandUsers
          .filter((u: any) => u.id !== createdByUserId)
          .map((u: any) => u.id);
        const recipients = await filterSubscribed(candidateIds, "test_request_status_change");
        await Promise.all(
          recipients.map((uid) =>
            createNotification({
              userId: uid,
              type: "PO_STATUS",
              title: `Test Request ${label}: ${ref}`,
              message: orgMessage,
              link: `/brand-portal/tests`,
            }),
          ),
        );
      } catch (err) {
        console.error("[notify] brand fan-out failed:", err);
      }
    }

    if (factoryId) {
      try {
        const factoryUsers = await prisma.user.findMany({
          where: { factoryId, status: "ACTIVE" },
          select: { id: true },
        });
        const candidateIds = factoryUsers
          .filter((u: any) => u.id !== createdByUserId)
          .map((u: any) => u.id);
        const recipients = await filterSubscribed(candidateIds, "test_request_status_change");
        await Promise.all(
          recipients.map((uid) =>
            createNotification({
              userId: uid,
              type: "PO_STATUS",
              title: `Test Request ${label}: ${ref}`,
              message: orgMessage,
              link: `/factory-portal/tests`,
            }),
          ),
        );
      } catch (err) {
        console.error("[notify] factory fan-out failed:", err);
      }
    }
  }
}

/** When a factory submits a new test request — notify admins so they can approve */
export async function notifyTestRequestCreated(params: {
  testRequestId: string;
  poNumber?: string;
  factoryName?: string;
  selectedTests?: string[];
  requesterName?: string;
}) {
  const { poNumber, factoryName, selectedTests, requesterName, testRequestId } = params;
  const ref = poNumber || testRequestId;
  const tests = (selectedTests || []).map((t) => t.toUpperCase()).join(", ") || "various tests";
  const who = requesterName ? ` (${requesterName})` : "";
  const from = factoryName ? ` from ${factoryName}${who}` : who;

  await notifyAdmins(
    "PO_STATUS",
    `New Test Request: ${ref}`,
    `New test request${from} — ${tests}. Awaiting approval.`,
    `/test-requests`,
  );
}

// ─── Order Notifications ───

/** When a factory places a new order — notify account manager + admins */
export async function notifyNewOrder(params: {
  orderId: string;
  orderNumber: string;
  orderType: string;
  factoryName: string;
  volumeLiters?: number;
  hangtagQty?: number;
  totalPrice?: number;
  accountManagerId?: string;
  brandName?: string;
}) {
  const {
    orderId,
    orderNumber,
    orderType,
    factoryName,
    volumeLiters,
    hangtagQty,
    totalPrice,
    accountManagerId,
    brandName,
  } = params;

  const detail = volumeLiters ? `${volumeLiters}L` : hangtagQty ? `${hangtagQty} hangtags` : "";
  const brandNote = brandName ? ` for ${brandName}` : "";

  // Notify account manager — subscription-filtered (Phase 5D).
  if (accountManagerId && (await filterSubscribed([accountManagerId], "order_placed")).length > 0) {
    await createNotification({
      userId: accountManagerId,
      type: "PO_STATUS",
      title: `New ${orderType} Order: ${orderNumber}`,
      message: `${factoryName} placed a ${orderType.toLowerCase()} order${brandNote} — ${detail}. Awaiting your approval.`,
      link: `/admin/orders`,
    });
  }

  // Notify all admins
  await notifyAdmins(
    "PO_STATUS",
    `New Order: ${orderNumber}`,
    `${factoryName} placed a ${orderType.toLowerCase()} order${brandNote} — ${detail}. Total: $${(totalPrice || 0).toFixed(2)}.`,
    `/admin/orders`,
  );
}

/** When order status changes — notify factory + relevant parties */
export async function notifyOrderStatusChange(params: {
  orderId: string;
  orderNumber: string;
  newStatus: string;
  factoryId: string;
  factoryName: string;
  trackingNumber?: string;
  carrier?: string;
  distributorId?: string;
}) {
  const {
    orderId,
    orderNumber,
    newStatus,
    factoryId,
    factoryName,
    trackingNumber,
    carrier,
    distributorId,
  } = params;

  const statusLabels: Record<string, string> = {
    APPROVED: "Approved",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };

  const label = statusLabels[newStatus] || newStatus;
  let message = `Order ${orderNumber} is now ${label.toLowerCase()}.`;
  if (newStatus === "SHIPPED" && trackingNumber) {
    message = `Order ${orderNumber} has been shipped! Tracking: ${trackingNumber}${carrier ? ` (${carrier})` : ""}.`;
  }

  // Notify factory users — subscription-filtered (Phase 5D).
  const factoryUsers = await prisma.user.findMany({
    where: { factoryId, status: "ACTIVE" },
    select: { id: true },
  });
  const factoryRecipients = await filterSubscribed(
    factoryUsers.map((u: any) => u.id),
    "order_status_change",
  );

  await Promise.all(
    factoryRecipients.map((uid) =>
      createNotification({
        userId: uid,
        type: "PO_STATUS",
        title: `Order ${label}: ${orderNumber}`,
        message,
        link: `/factory-portal/orders`,
      }),
    ),
  );

  // If shipped/delivered, also notify distributor users
  if (distributorId && ["SHIPPED", "DELIVERED"].includes(newStatus)) {
    const distUsers = await prisma.user.findMany({
      where: { distributorId, status: "ACTIVE" },
      select: { id: true },
    });
    const distRecipients = await filterSubscribed(
      distUsers.map((u: any) => u.id),
      "order_status_change",
    );
    await Promise.all(
      distRecipients.map((uid) =>
        createNotification({
          userId: uid,
          type: "PO_STATUS",
          title: `Order ${label}: ${orderNumber}`,
          message: `Order ${orderNumber} for ${factoryName}: ${label.toLowerCase()}.`,
          link: `/distributor-portal/orders`,
        }),
      ),
    );
  }
}

/** When distributor inventory hits low threshold */
export async function notifyLowInventory(params: {
  distributorId: string;
  distributorName: string;
  currentLiters: number;
  thresholdLiters: number;
}) {
  await notifyAdmins(
    "SYSTEM",
    `Low Inventory Alert: ${params.distributorName}`,
    `${params.distributorName} stock is at ${params.currentLiters}L (threshold: ${params.thresholdLiters}L). Reorder needed.`,
    `/admin/consumption`,
  );
}

// ─── CRM Activity Notifications ───

/**
 * Notify all entity managers when CRM activity is logged (note, call, email, meeting, etc.)
 * Uses EntityManager table for multi-manager support, falls back to salesRepId.
 */
export async function notifyCRMActivity(params: {
  entityType: "BRAND" | "FACTORY";
  entityId: string;
  entityName: string;
  activityType: string; // NOTE, CALL, EMAIL, MEETING, TASK, FOLLOW_UP
  content: string;
  contactName?: string;
  loggedByUserId?: string;
  loggedByName?: string;
}) {
  try {
    const {
      entityType,
      entityId,
      activityType,
      content,
      contactName,
      loggedByUserId,
      loggedByName,
    } = params;
    const entityName = params.entityName || "Unknown";
    const typeLower = entityType.toLowerCase();
    const link = `/${typeLower === "brand" ? "brands" : "factories"}/${entityId}`;

    // 1. Get all entity managers from EntityManager table
    const managers = await prisma.entityManager.findMany({
      where: { entityType, entityId },
      select: { userId: true },
    });
    const managerIds = new Set(managers.map((m: any) => m.userId));

    // 2. Fallback: get salesRepId from brand/factory if no EntityManagers exist
    if (managerIds.size === 0) {
      if (entityType === "BRAND") {
        const brand = await prisma.brand.findUnique({
          where: { id: entityId },
          select: { salesRepId: true },
        });
        if (brand?.salesRepId) managerIds.add(brand.salesRepId);
      } else if (entityType === "FACTORY") {
        const factory = await prisma.factory.findUnique({
          where: { id: entityId },
          select: { salesRepId: true },
        });
        if (factory?.salesRepId) managerIds.add(factory.salesRepId);
      }
    }

    // 3. Also notify admins
    const adminIds = await getAdminIds();
    for (const id of adminIds) managerIds.add(id);

    // 4. Remove the person who logged the activity (they don't need a notification about their own action)
    if (loggedByUserId) managerIds.delete(loggedByUserId);

    if (managerIds.size === 0) return;

    // 5. Build notification
    const activityLabel = activityType.replace(/_/g, " ").toLowerCase();
    const who = loggedByName || "Someone";
    const contactNote = contactName ? ` with ${contactName}` : "";
    const preview = content.length > 100 ? content.slice(0, 100) + "..." : content;

    const title = `CRM ${activityLabel}: ${entityName}`;
    const message = `${who} logged a ${activityLabel}${contactNote} on ${entityName}. "${preview}"`;

    await Promise.all(
      Array.from(managerIds).map((userId) =>
        createNotification({
          userId,
          type: "BRAND_ACTIVITY",
          title,
          message,
          link,
        }),
      ),
    );
  } catch (err) {
    console.error("[CRM-NOTIFY] Error:", err);
  }
}

/**
 * Notify account managers when a brand or factory user logs into Atlas.
 * - Brand users: notify brand's salesRep (account manager)
 * - Factory users: notify factory's salesRep
 * - Also notifies all ADMIN users
 */
export async function notifyUserLogin(params: {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  brandId?: string | null;
  factoryId?: string | null;
  distributorId?: string | null;
}) {
  try {
    const { userId, userName, userEmail, userRole, brandId, factoryId, distributorId } = params;

    // Only notify on brand, factory, and distributor logins
    const isBrand = userRole === "BRAND_USER" || userRole === "BRAND_MANAGER";
    const isFactory = userRole === "FACTORY_USER" || userRole === "FACTORY_MANAGER";
    const isDistributor = userRole === "DISTRIBUTOR_USER";

    if (!isBrand && !isFactory && !isDistributor) return;

    let entityName = "";
    let entityType = "";
    let accountManagerId: string | null = null;
    let link = "/dashboard";

    if (isBrand && brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { name: true, salesRepId: true },
      });
      entityName = brand?.name || "Unknown brand";
      entityType = "Brand";
      accountManagerId = brand?.salesRepId || null;
      link = `/pipeline?brand=${brandId}`;
    } else if (isFactory && factoryId) {
      const factory = await prisma.factory.findUnique({
        where: { id: factoryId },
        select: { name: true, salesRepId: true },
      });
      entityName = factory?.name || "Unknown factory";
      entityType = "Factory";
      accountManagerId = factory?.salesRepId || null;
      link = `/factory-portal`;
    } else if (isDistributor && distributorId) {
      entityName = "Distributor";
      entityType = "Distributor";
      // Distributors → notify all admins
    }

    const displayName = userName || userEmail;
    const title = `${entityType} Login: ${entityName}`;
    const message = `${displayName} from ${entityName} just logged into FUZE Atlas.`;

    // Notify the assigned account manager
    if (accountManagerId) {
      await createNotification({
        userId: accountManagerId,
        type: "USER_LOGIN",
        title,
        message,
        link,
      });
    }

    // Also notify all admins
    await notifyAdmins("USER_LOGIN", title, message, link);
  } catch (err) {
    // Non-blocking — don't break login if notification fails
    console.error("[LOGIN-NOTIFY] Error:", err);
  }
}

// ════════════════════════════════════════════════════════════════
// Phase 15 IMP-6 — notification fan-out coverage gaps.
//
// Four new helpers + 22h dedupe via metadata.kind. Each suppresses
// re-pings for the same (kind, scopeId) within the suppression
// window so a flurry of edits doesn't spam the user pool.
// ════════════════════════════════════════════════════════════════

const FAN_OUT_SUPPRESSION_HOURS = 22;

async function alreadyNotified(kind: string, scopeId: string): Promise<boolean> {
  const since = new Date(Date.now() - FAN_OUT_SUPPRESSION_HOURS * 60 * 60_000);
  const recent = await prisma.notification.findFirst({
    where: {
      createdAt: { gte: since },
      metadata: { path: ["kind"], equals: kind },
      AND: {
        metadata: { path: ["scopeId"], equals: scopeId },
      },
    },
    select: { id: true },
  });
  return !!recent;
}

/**
 * When a BrandPricingTier changes — fans to every brand user at the
 * brand (their volume discount just moved). Admin sees its own
 * notification via the existing admin-fan path; this helper covers
 * the brand-user side.
 */
export async function notifyPricingTierChange(params: {
  brandId: string;
  brandName?: string | null;
  changeSummary: string;
}) {
  const kind = "pricing-tier-change";
  if (await alreadyNotified(kind, params.brandId)) return;
  const brand =
    params.brandName ||
    (await prisma.brand.findUnique({
      where: { id: params.brandId },
      select: { name: true },
    }))?.name ||
    "your brand";
  const users = await prisma.user.findMany({
    where: { brandId: params.brandId, status: "ACTIVE" },
    select: { id: true },
  });
  const title = `Pricing tier updated for ${brand}`;
  const link = `/brand-portal/pricing`;
  await Promise.all(
    users.map((u) =>
      createNotification({
        userId: u.id,
        type: "BRAND_ACTIVITY",
        title,
        message: params.changeSummary,
        link,
        metadata: { kind, scopeId: params.brandId, brandId: params.brandId },
      }),
    ),
  );
}

/**
 * When a brand's spec changes (requiredFuzeTier / ICP cadence /
 * protocolDocUrl) — fans to every factory user whose factory has
 * an active SupplyChainLink (BRAND→FACTORY, SUPPLIES) to this brand.
 * Plus admins for visibility.
 */
export async function notifySpecChange(params: {
  brandId: string;
  brandName?: string | null;
  changedFields: string[];
}) {
  const kind = "spec-change";
  if (await alreadyNotified(kind, params.brandId)) return;
  const brand =
    params.brandName ||
    (await prisma.brand.findUnique({
      where: { id: params.brandId },
      select: { name: true },
    }))?.name ||
    "Brand";

  // Find factories linked to this brand via SupplyChainLink.
  const links = await prisma.supplyChainLink.findMany({
    where: {
      fromType: "BRAND",
      fromId: params.brandId,
      toType: "FACTORY",
      active: true,
    },
    select: { toId: true },
  });
  const factoryIds = links.map((l) => l.toId);
  if (factoryIds.length === 0) return;

  const factoryUsers = await prisma.user.findMany({
    where: { factoryId: { in: factoryIds }, status: "ACTIVE" },
    select: { id: true, factoryId: true },
  });
  const adminIds = await getAdminIds();
  const recipientIds = Array.from(
    new Set<string>([...factoryUsers.map((u) => u.id), ...adminIds]),
  );

  const summary = params.changedFields.length
    ? params.changedFields.join(", ")
    : "spec fields";
  const title = `${brand} updated their FUZE spec`;
  const message = `Changed: ${summary}. Review the new spec and acknowledge.`;
  await Promise.all(
    recipientIds.map((userId) =>
      createNotification({
        userId,
        type: "BRAND_ACTIVITY",
        title,
        message,
        link: `/factory-portal/specs`,
        metadata: {
          kind,
          scopeId: params.brandId,
          brandId: params.brandId,
          changedFields: params.changedFields,
        },
      }),
    ),
  );
}

/**
 * Internal-only notification when raw lab data lands on a TestRun
 * BEFORE the brand-visible stamp. Recipients: admins + the
 * uploading lab's lab managers. Brand is NOT pinged here — that
 * happens later via notifyTestResult on the brand-visible flip.
 */
export async function notifyRawDataReceived(params: {
  testRunId: string;
  testType?: string | null;
  labId?: string | null;
  labName?: string | null;
}) {
  const kind = "raw-data-received";
  if (await alreadyNotified(kind, params.testRunId)) return;

  const recipientIds = new Set<string>(await getAdminIds());
  if (params.labId) {
    const labMgrs = await prisma.user.findMany({
      where: { labId: params.labId, role: "LAB_MANAGER", status: "ACTIVE" },
      select: { id: true },
    });
    for (const u of labMgrs) recipientIds.add(u.id);
  }

  const title = `📥 Raw test data received${params.labName ? ` from ${params.labName}` : ""}`;
  const message = `${params.testType || "Test"} run ${params.testRunId.slice(-6)} is ready for FUZE Ops review before brand-visible stamping.`;
  const link = `/test-results/${params.testRunId}`;
  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      createNotification({
        userId,
        type: "TEST_RESULTS",
        title,
        message,
        link,
        metadata: {
          kind,
          scopeId: params.testRunId,
          testRunId: params.testRunId,
          internal: true,
        },
      }),
    ),
  );
}

/**
 * When a FactoryInvitation flips to ACCEPTED — fans to the brand's
 * primary EntityManager (the AM who owns the relationship) so they
 * can welcome the factory and follow up.
 */
export async function notifyInvitationAccepted(params: {
  invitationId: string;
  brandId: string;
  factoryName?: string | null;
  linkedFactoryId?: string | null;
}) {
  const kind = "invitation-accepted";
  if (await alreadyNotified(kind, params.invitationId)) return;

  // Primary EntityManager for this brand, with admin fallback.
  const ems = await prisma.entityManager.findMany({
    where: { entityType: "BRAND", entityId: params.brandId },
    select: { userId: true, isPrimary: true },
  });
  const primary = ems.find((e) => e.isPrimary)?.userId;
  const recipientIds = new Set<string>(await getAdminIds());
  if (primary) recipientIds.add(primary);

  const brand =
    (
      await prisma.brand.findUnique({
        where: { id: params.brandId },
        select: { name: true },
      })
    )?.name || "Brand";
  const title = `🤝 ${params.factoryName || "Factory"} accepted ${brand}'s invitation`;
  const message = `New supply-chain link. Reach out to confirm spec + cadence.`;
  const link = params.linkedFactoryId
    ? `/factories/${params.linkedFactoryId}`
    : `/brands/${params.brandId}`;
  await Promise.all(
    Array.from(recipientIds).map((userId) =>
      createNotification({
        userId,
        type: "BRAND_ACTIVITY",
        title,
        message,
        link,
        metadata: {
          kind,
          scopeId: params.invitationId,
          invitationId: params.invitationId,
          brandId: params.brandId,
        },
      }),
    ),
  );
}
