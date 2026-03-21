// @ts-nocheck
/**
 * Server-Sent Events (SSE) connection manager
 * Manages real-time notification delivery to connected clients
 */

export type SSEEvent = {
  type: string;
  data: any;
  id?: string;
};

class SSEConnectionManager {
  private connections: Map<string, Set<ReadableStreamDefaultController>> = new Map();
  private heartbeatIntervals: Map<string, Map<ReadableStreamDefaultController, NodeJS.Timeout>> = new Map();

  /**
   * Add a new SSE connection for a user
   */
  addConnection(userId: string, controller: ReadableStreamDefaultController): void {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
      this.heartbeatIntervals.set(userId, new Map());
    }

    this.connections.get(userId)!.add(controller);

    // Set up heartbeat for this connection
    const heartbeatInterval = setInterval(() => {
      try {
        controller.enqueue(`:keepalive\n\n`);
      } catch (error) {
        // Connection may be closed, will be cleaned up in removeConnection
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.get(userId)!.set(controller, heartbeatInterval);

    console.log(`[SSE] Added connection for user ${userId}. Total connections: ${this.getConnectionCount()}`);
  }

  /**
   * Remove an SSE connection for a user
   */
  removeConnection(userId: string, controller: ReadableStreamDefaultController): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    userConnections.delete(controller);

    // Clear heartbeat for this connection
    const heartbeatMap = this.heartbeatIntervals.get(userId);
    if (heartbeatMap) {
      const interval = heartbeatMap.get(controller);
      if (interval) {
        clearInterval(interval);
        heartbeatMap.delete(controller);
      }
    }

    // Clean up empty user entries
    if (userConnections.size === 0) {
      this.connections.delete(userId);
      this.heartbeatIntervals.delete(userId);
    }

    console.log(`[SSE] Removed connection for user ${userId}. Total connections: ${this.getConnectionCount()}`);
  }

  /**
   * Send an SSE event to a specific user's all connections
   */
  sendToUser(userId: string, event: SSEEvent): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      console.log(`[SSE] No active connections for user ${userId}`);
      return;
    }

    const eventId = event.id || `${Date.now()}`;
    const eventData = JSON.stringify(event.data);
    const message = `id: ${eventId}\nevent: ${event.type}\ndata: ${eventData}\n\n`;

    const failedConnections: ReadableStreamDefaultController[] = [];

    userConnections.forEach((controller) => {
      try {
        controller.enqueue(message);
      } catch (error) {
        console.error(`[SSE] Error sending to connection for user ${userId}:`, error);
        failedConnections.push(controller);
      }
    });

    // Clean up failed connections
    failedConnections.forEach((controller) => {
      this.removeConnection(userId, controller);
    });

    console.log(`[SSE] Sent event "${event.type}" to user ${userId} (${userConnections.size} active connections)`);
  }

  /**
   * Broadcast an SSE event to all users with a specific role
   * Note: This is a placeholder for role-based broadcasting.
   * Full implementation would require querying users by role from database.
   */
  broadcastToRole(role: string, event: SSEEvent): void {
    console.log(`[SSE] Broadcasting event "${event.type}" to role "${role}"`);
    // Implementation would query users with given role and call sendToUser for each
    // This requires database access, so actual implementation depends on use case
  }

  /**
   * Get total number of active connections across all users
   */
  getConnectionCount(): number {
    let count = 0;
    this.connections.forEach((connections) => {
      count += connections.size;
    });
    return count;
  }

  /**
   * Get connection count for a specific user
   */
  getUserConnectionCount(userId: string): number {
    const userConnections = this.connections.get(userId);
    return userConnections ? userConnections.size : 0;
  }

  /**
   * Cleanup all connections (useful for graceful shutdown)
   */
  closeAll(): void {
    this.connections.forEach((userConnections, userId) => {
      userConnections.forEach((controller) => {
        try {
          controller.close();
        } catch (error) {
          console.error(`[SSE] Error closing connection for user ${userId}:`, error);
        }
      });
      userConnections.clear();
    });

    this.heartbeatIntervals.forEach((heartbeatMap) => {
      heartbeatMap.forEach((interval) => {
        clearInterval(interval);
      });
      heartbeatMap.clear();
    });

    this.connections.clear();
    this.heartbeatIntervals.clear();
    console.log("[SSE] All connections closed");
  }
}

// Singleton instance
export const sseManager = new SSEConnectionManager();
