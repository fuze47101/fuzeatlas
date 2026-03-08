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
