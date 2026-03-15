// @ts-nocheck
/**
 * Server-Sent Events (SSE) endpoint for real-time notifications
 * GET /api/notifications/stream
 *
 * Returns a streaming response that sends notifications in real-time to connected clients.
 * Clients connect via EventSource API and receive notifications as they are created.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sseManager } from "@/lib/sse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    // Extract user ID from header
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[SSE] Client connected for user: ${userId}`);

    // Create a readable stream with SSE format
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection message
        try {
          controller.enqueue(`event: connected\ndata: {"status":"connected","userId":"${userId}"}\n\n`);
        } catch (error) {
          console.error("[SSE] Error sending connection message:", error);
          controller.close();
          return;
        }

        // Fetch recent unread notifications (last 10) as initial payload
        try {
          const recentNotifications = await prisma.notification.findMany({
            where: {
              userId,
              read: false,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          if (recentNotifications.length > 0) {
            const notificationsData = JSON.stringify({
              notifications: recentNotifications.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                message: n.message,
                link: n.link,
                read: n.read,
                createdAt: n.createdAt.toISOString(),
                metadata: n.metadata,
              })),
            });
            controller.enqueue(`event: initial_notifications\ndata: ${notificationsData}\n\n`);
          }
        } catch (error) {
          console.error("[SSE] Error fetching initial notifications:", error);
        }

        // Register this connection with the SSE manager
        sseManager.addConnection(userId, controller);

        // Handle connection close
        const onClose = () => {
          console.log(`[SSE] Client disconnected for user: ${userId}`);
          sseManager.removeConnection(userId, controller);
        };

        // Set up listener for controller abort (connection close)
        if (controller.signal) {
          controller.signal.addEventListener("abort", onClose);
        }

        // Alternative: handle when client closes connection
        const originalClose = controller.close.bind(controller);
        controller.close = function () {
          onClose();
          return originalClose();
        };
      },

      cancel() {
        console.log(`[SSE] Stream cancelled for user: ${userId}`);
        sseManager.removeConnection(userId, {} as ReadableStreamDefaultController);
      },
    });

    // Return the stream with proper SSE headers
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[SSE] Error in stream endpoint:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
