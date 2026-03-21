// @ts-nocheck
/**
 * Enhanced notification system that combines database storage with real-time SSE push
 * Wraps existing notify.ts functions and adds real-time delivery via SSE
 */

import {
  notifyTestResult,
  notifySOWStatusChange,
  notifyNewAccessRequest,
  notifyPipelineChange,
  notifyNewSubmission,
  notifyTestRequestStatus,
} from "@/lib/notify";
import { sseManager } from "@/lib/sse";
import { prisma } from "@/lib/prisma";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  createdAt: Date;
  userId: string;
  read: boolean;
  metadata?: any;
};

/**
 * Push a notification to a user via SSE after creating it in the database
 */
async function pushNotification(userId: string, notification: Notification): Promise<void> {
  try {
    sseManager.sendToUser(userId, {
      type: "notification",
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt.toISOString(),
        read: notification.read,
        metadata: notification.metadata,
      },
    });
  } catch (error) {
    console.error(`[NOTIFY-REALTIME] Failed to push notification to user ${userId}:`, error);
  }
}

/**
 * Get all admin IDs from database
 */
async function getAdminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  return admins.map((a: any) => a.id);
}

/**
 * Get all notifications created and push them to respective users
 * This helper queries the database to get the created notification and pushes it
 */
async function pushCreatedNotifications(userIds: string[], title: string): Promise<void> {
  try {
    // Query for notifications with matching title created in the last 5 seconds
    const now = new Date();
    const fiveSecondsAgo = new Date(now.getTime() - 5000);

    for (const userId of userIds) {
      const notifications = await prisma.notification.findMany({
        where: {
          userId,
          title,
          createdAt: {
            gte: fiveSecondsAgo,
            lte: now,
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      if (notifications.length > 0) {
        const notification = notifications[0];
        await pushNotification(userId, notification as Notification);
      }
    }
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error pushing created notifications:", error);
  }
}

/**
 * Notify test result with real-time SSE push
 */
export async function pushTestResult(params: {
  testId: string;
  testName: string;
  result: string;
  brandId?: string;
  factoryId?: string;
}): Promise<void> {
  try {
    // Create notifications in database
    await notifyTestResult(params);

    // Get affected user IDs
    const userIds: string[] = [];

    // Add admin IDs
    const adminIds = await getAdminIds();
    userIds.push(...adminIds);

    // Add brand user IDs
    if (params.brandId) {
      const brandUsers = await prisma.user.findMany({
        where: { brandId: params.brandId, status: "ACTIVE" },
        select: { id: true },
      });
      userIds.push(...brandUsers.map((u: any) => u.id));
    }

    // Add factory user IDs
    if (params.factoryId) {
      const factoryUsers = await prisma.user.findMany({
        where: { factoryId: params.factoryId, status: "ACTIVE" },
        select: { id: true },
      });
      userIds.push(...factoryUsers.map((u: any) => u.id));
    }

    // Push to all affected users
    await pushCreatedNotifications(userIds, `Test ${params.result}: ${params.testName}`);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushTestResult:", error);
  }
}

/**
 * Notify SOW status change with real-time SSE push
 */
export async function pushSOWUpdate(params: {
  sowId: string;
  sowTitle: string;
  newStatus: string;
  brandId?: string;
  changedBy?: string;
}): Promise<void> {
  try {
    // Create notifications in database
    await notifySOWStatusChange(params);

    // Get affected user IDs
    const userIds: string[] = [];

    // Add admin IDs (except the one who made the change)
    const adminIds = await getAdminIds();
    userIds.push(...adminIds.filter((id) => id !== params.changedBy));

    // Add brand user IDs
    if (params.brandId) {
      const brandUsers = await prisma.user.findMany({
        where: { brandId: params.brandId, status: "ACTIVE" },
        select: { id: true },
      });
      userIds.push(...brandUsers.map((u: any) => u.id));
    }

    // Push to all affected users
    const statusLabels: Record<string, string> = {
      DRAFT: "Draft",
      SENT: "Sent for Signature",
      SIGNED: "Signed",
      ACTIVE: "Active",
      COMPLETE: "Complete",
      CANCELLED: "Cancelled",
    };
    const title = `SOW ${statusLabels[params.newStatus] || params.newStatus}`;
    await pushCreatedNotifications(userIds, title);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushSOWUpdate:", error);
  }
}

/**
 * Notify access request with real-time SSE push
 */
export async function pushAccessRequest(params: {
  requestId: string;
  name: string;
  company: string;
  type: "BRAND" | "FACTORY";
}): Promise<void> {
  try {
    // Create notifications in database
    await notifyNewAccessRequest(params);

    // Get admin IDs
    const adminIds = await getAdminIds();

    // Push to all admins
    const title = `New ${params.type.toLowerCase()} access request`;
    await pushCreatedNotifications(adminIds, title);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushAccessRequest:", error);
  }
}

/**
 * Notify pipeline change with real-time SSE push
 */
export async function pushPipelineChange(params: {
  brandId: string;
  brandName: string;
  oldStage: string;
  newStage: string;
  changedBy?: string;
}): Promise<void> {
  try {
    // Create notifications in database
    await notifyPipelineChange(params);

    // Get team user IDs
    const teamUsers = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["ADMIN", "EMPLOYEE", "SALES_MANAGER", "SALES_REP"] },
      },
      select: { id: true },
    });

    const userIds = teamUsers.filter((u: any) => u.id !== params.changedBy).map((u: any) => u.id);

    // Push to all team members
    const title = `Pipeline: ${params.brandName}`;
    await pushCreatedNotifications(userIds, title);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushPipelineChange:", error);
  }
}

/**
 * Notify new fabric submission with real-time SSE push
 */
export async function pushNewSubmission(params: {
  factoryName: string;
  fabricName: string;
  submittedBy: string;
}): Promise<void> {
  try {
    // Create notifications in database
    await notifyNewSubmission(params);

    // Get admin IDs
    const adminIds = await getAdminIds();

    // Push to all admins
    const title = "New Fabric Submission";
    await pushCreatedNotifications(adminIds, title);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushNewSubmission:", error);
  }
}

/**
 * Notify test request status change with real-time SSE push
 */
export async function pushTestRequestStatus(params: {
  testRequestId: string;
  status: string;
  createdByUserId?: string;
}): Promise<void> {
  try {
    // Create notifications in database
    await notifyTestRequestStatus(params);

    // Get affected user IDs
    const userIds: string[] = [];
    if (params.createdByUserId) {
      userIds.push(params.createdByUserId);
    }

    // Push to affected users
    const statusLabels: Record<string, string> = {
      APPROVED: "Approved",
      SUBMITTED: "Submitted to Lab",
      IN_PROGRESS: "In Progress",
      RESULTS_RECEIVED: "Results Received",
      COMPLETE: "Complete",
      CANCELLED: "Cancelled",
    };
    const title = `Test Request ${statusLabels[params.status] || params.status}`;
    await pushCreatedNotifications(userIds, title);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushTestRequestStatus:", error);
  }
}

/**
 * System alert - push notification directly to specified user(s)
 * This creates a notification in the database and sends it via SSE
 */
export async function pushSystemAlert(
  userIds: string | string[],
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    const recipients = Array.isArray(userIds) ? userIds : [userIds];

    for (const userId of recipients) {
      // Create notification in database
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: "SYSTEM",
          title,
          message,
          link,
          metadata: { isSystemAlert: true },
        },
      });

      // Push via SSE
      await pushNotification(userId, notification as Notification);
    }

    console.log(
      `[NOTIFY-REALTIME] System alert sent to ${recipients.length} user(s): "${title}"`
    );
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushSystemAlert:", error);
  }
}

/**
 * Generic notification push - for custom notifications not covered by specific functions
 */
export async function pushCustomNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link,
        metadata,
      },
    });

    // Push via SSE
    await pushNotification(userId, notification as Notification);
    console.log(`[NOTIFY-REALTIME] Custom notification sent to user ${userId}: "${title}"`);
  } catch (error) {
    console.error("[NOTIFY-REALTIME] Error in pushCustomNotification:", error);
  }
}
