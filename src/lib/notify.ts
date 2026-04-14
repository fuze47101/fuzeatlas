// @ts-nocheck
/**
 * Auto-notification triggers for FUZE Atlas (F-031)
 * Creates in-app notifications when important events occur.
 * Each function creates a Notification record in the database.
 */

import { prisma } from "@/lib/prisma";

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
  await Promise.all(adminIds.map((id) => createNotification({ userId: id, type, title, message, link })));
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
    `/tests/${testId}`
  );

  // Notify brand users if linked
  if (brandId) {
    const brandUsers = await prisma.user.findMany({
      where: { brandId, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      brandUsers.map((u: any) =>
        createNotification({
          userId: u.id,
          type: "TEST_RESULTS",
          title: `Test Results: ${testName}`,
          message: `Your test "${testName}" result: ${result}`,
          link: `/brand-portal/tests`,
        })
      )
    );
  }

  // Notify factory users if linked
  if (factoryId) {
    const factoryUsers = await prisma.user.findMany({
      where: { factoryId, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      factoryUsers.map((u: any) =>
        createNotification({
          userId: u.id,
          type: "TEST_RESULTS",
          title: `Test Results: ${testName}`,
          message: `Test "${testName}" result: ${result}`,
          link: `/factory-portal/submissions`,
        })
      )
    );
  }
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
    DRAFT: "Draft", SENT: "Sent for Signature", SIGNED: "Signed",
    ACTIVE: "Active", COMPLETE: "Complete", CANCELLED: "Cancelled",
  };

  // Notify admins (except the one who made the change)
  const adminIds = await getAdminIds();
  await Promise.all(
    adminIds.filter((id) => id !== changedBy).map((id) =>
      createNotification({
        userId: id,
        type: "SOW_UPDATE",
        title: `SOW ${statusLabels[newStatus] || newStatus}`,
        message: `"${sowTitle}" status changed to ${statusLabels[newStatus] || newStatus}.`,
        link: `/sow/${sowId}`,
      })
    )
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
        })
      )
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
    `/settings/access-requests`
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
    teamUsers.filter((u: any) => u.id !== changedBy).map((u: any) =>
      createNotification({
        userId: u.id,
        type: "BRAND_ACTIVITY",
        title: `Pipeline: ${brandName}`,
        message: `${brandName} moved from ${oldStage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")}.`,
        link: `/brands/${brandId}`,
      })
    )
  );
}

/** When a new fabric submission comes in from the factory portal */
export async function notifyNewSubmission(params: {
  factoryName: string;
  fabricName: string;
  submittedBy: string;
}) {
  await notifyAdmins(
    "BRAND_ACTIVITY",
    "New Fabric Submission",
    `${params.factoryName} submitted "${params.fabricName}" (by ${params.submittedBy}).`,
    `/fabrics`
  );
}

/** When a test request status changes */
export async function notifyTestRequestStatus(params: {
  testRequestId: string;
  status: string;
  createdByUserId?: string;
}) {
  const { testRequestId, status, createdByUserId } = params;

  const statusLabels: Record<string, string> = {
    APPROVED: "Approved", SUBMITTED: "Submitted to Lab", IN_PROGRESS: "In Progress",
    RESULTS_RECEIVED: "Results Received", COMPLETE: "Complete", CANCELLED: "Cancelled",
  };

  // Notify the person who created the test request
  if (createdByUserId) {
    await createNotification({
      userId: createdByUserId,
      type: "PO_STATUS",
      title: `Test Request ${statusLabels[status] || status}`,
      message: `Your test request has been ${(statusLabels[status] || status).toLowerCase()}.`,
      link: `/test-requests`,
    });
  }
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
  const { orderId, orderNumber, orderType, factoryName, volumeLiters, hangtagQty, totalPrice, accountManagerId, brandName } = params;

  const detail = volumeLiters ? `${volumeLiters}L` : hangtagQty ? `${hangtagQty} hangtags` : "";
  const brandNote = brandName ? ` for ${brandName}` : "";

  // Notify account manager
  if (accountManagerId) {
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
    `/admin/orders`
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
  const { orderId, orderNumber, newStatus, factoryId, factoryName, trackingNumber, carrier, distributorId } = params;

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

  // Notify factory users
  const factoryUsers = await prisma.user.findMany({
    where: { factoryId, status: "ACTIVE" },
    select: { id: true },
  });

  await Promise.all(
    factoryUsers.map((u: any) =>
      createNotification({
        userId: u.id,
        type: "PO_STATUS",
        title: `Order ${label}: ${orderNumber}`,
        message,
        link: `/factory-portal/orders`,
      })
    )
  );

  // If shipped/delivered, also notify distributor users
  if (distributorId && ["SHIPPED", "DELIVERED"].includes(newStatus)) {
    const distUsers = await prisma.user.findMany({
      where: { distributorId, status: "ACTIVE" },
      select: { id: true },
    });
    await Promise.all(
      distUsers.map((u: any) =>
        createNotification({
          userId: u.id,
          type: "PO_STATUS",
          title: `Order ${label}: ${orderNumber}`,
          message: `Order ${orderNumber} for ${factoryName}: ${label.toLowerCase()}.`,
          link: `/distributor-portal/orders`,
        })
      )
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
    `/admin/consumption`
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
    const { entityType, entityId, activityType, content, contactName, loggedByUserId, loggedByName } = params;
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
        })
      )
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
