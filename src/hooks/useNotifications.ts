// @ts-nocheck
/**
 * React hook for managing real-time notifications via SSE
 * Handles connection lifecycle, state management, and API calls for marking notifications as read
 */

import { useEffect, useState, useCallback, useRef } from "react";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  metadata?: any;
};

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationIds: string | string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  isConnected: boolean;
}

/**
 * useNotifications Hook
 * Manages EventSource connection to SSE endpoint and notification state
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const userIdRef = useRef<string | null>(null);

  /**
   * Get user ID from localStorage or header
   */
  const getUserId = useCallback((): string | null => {
    if (userIdRef.current) return userIdRef.current;

    // Try to get from localStorage first
    if (typeof window !== "undefined") {
      const storedUserId = localStorage.getItem("userId");
      if (storedUserId) {
        userIdRef.current = storedUserId;
        return storedUserId;
      }
    }

    return null;
  }, []);

  /**
   * Mark notifications as read via API
   */
  const markAsRead = useCallback(async (notificationIds: string | string[]): Promise<void> => {
    try {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      const userId = getUserId();

      if (!userId) {
        console.error("[useNotifications] No user ID available");
        return;
      }

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark notifications as read: ${response.statusText}`);
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          ids.includes(notif.id) ? { ...notif, read: true } : notif
        )
      );

      // Update unread count
      setUnreadCount((prev) => Math.max(0, prev - ids.length));
    } catch (error) {
      console.error("[useNotifications] Error marking as read:", error);
    }
  }, [getUserId]);

  /**
   * Mark all notifications as read via API
   */
  const markAllRead = useCallback(async (): Promise<void> => {
    try {
      const userId = getUserId();

      if (!userId) {
        console.error("[useNotifications] No user ID available");
        return;
      }

      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({ all: true }),
      });

      if (!response.ok) {
        throw new Error(`Failed to mark all as read: ${response.statusText}`);
      }

      // Update local state
      setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("[useNotifications] Error marking all as read:", error);
    }
  }, [getUserId]);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    const userId = getUserId();
    if (!userId) {
      console.warn("[useNotifications] Cannot connect: no user ID available");
      return;
    }

    try {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      console.log("[useNotifications] Connecting to SSE endpoint...");

      const eventSource = new EventSource("/api/notifications/stream", {
        headers: {
          "x-user-id": userId,
        },
      });

      // Handle connection open
      eventSource.addEventListener("open", () => {
        console.log("[useNotifications] Connected to SSE");
        setIsConnected(true);
      });

      // Handle connected event
      eventSource.addEventListener("connected", (event: Event) => {
        const customEvent = event as MessageEvent;
        console.log("[useNotifications] Received connected event:", customEvent.data);
        setIsConnected(true);
      });

      // Handle initial notifications
      eventSource.addEventListener("initial_notifications", (event: Event) => {
        const customEvent = event as MessageEvent;
        try {
          const parsed = JSON.parse(customEvent.data);
          console.log("[useNotifications] Received initial notifications:", parsed);
          setNotifications(parsed.notifications || []);
          const unread = (parsed.notifications || []).filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        } catch (error) {
          console.error("[useNotifications] Error parsing initial notifications:", error);
        }
      });

      // Handle incoming notifications
      eventSource.addEventListener("notification", (event: Event) => {
        const customEvent = event as MessageEvent;
        try {
          const notification = JSON.parse(customEvent.data);
          console.log("[useNotifications] Received new notification:", notification);

          // Add to notifications array
          setNotifications((prev) => [notification, ...prev]);

          // Update unread count if notification is unread
          if (!notification.read) {
            setUnreadCount((prev) => prev + 1);
          }
        } catch (error) {
          console.error("[useNotifications] Error parsing notification:", error);
        }
      });

      // Handle errors
      eventSource.addEventListener("error", () => {
        console.error("[useNotifications] EventSource error");
        setIsConnected(false);
        // EventSource will attempt to reconnect automatically
      });

      // Handle keepalive (ignore)
      eventSource.addEventListener("keepalive", () => {
        // Just a keepalive, ignore
      });

      eventSourceRef.current = eventSource;
    } catch (error) {
      console.error("[useNotifications] Error connecting to SSE:", error);
      setIsConnected(false);
    }
  }, [getUserId]);

  /**
   * Set up connection and cleanup on mount/unmount
   */
  useEffect(() => {
    // Connect to SSE
    connect();

    // Cleanup function
    return () => {
      if (eventSourceRef.current) {
        console.log("[useNotifications] Closing SSE connection");
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [connect]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    isConnected,
  };
}
