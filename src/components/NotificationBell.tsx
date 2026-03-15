// @ts-nocheck
/**
 * NotificationBell Component
 * A client-side component that displays a notification bell icon with unread count badge,
 * dropdown list of notifications, and toast notifications for new incoming messages.
 * Uses FUZE Atlas teal color scheme.
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";

/**
 * Inline bell SVG icon component
 */
const BellIcon = ({ className = "w-6 h-6" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

/**
 * Inline close icon
 */
const CloseIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * Toast notification component
 */
function Toast({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border-l-4 border-teal-500 p-4 animate-slide-in z-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{notification.title}</h4>
          <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="Close notification"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Notification item in dropdown list
 */
function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const handleClick = async () => {
    if (!notification.read) {
      await onRead(notification.id);
    }
    if (notification.link) {
      // Navigate to the link (in a real app, use Next.js router)
      window.location.href = notification.link;
    }
  };

  const timeAgo = getTimeAgo(new Date(notification.createdAt));

  return (
    <button
      onClick={handleClick}
      className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
        !notification.read ? "bg-teal-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {!notification.read && (
          <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <h5 className={`text-sm font-medium text-gray-900 ${!notification.read ? "font-semibold" : ""}`}>
            {notification.title}
          </h5>
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-1">{timeAgo}</p>
        </div>
      </div>
    </button>
  );
}

/**
 * Main NotificationBell component
 */
export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllRead, isConnected } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const prevUnreadCountRef = useRef(unreadCount);

  // Show toast for new notifications
  useEffect(() => {
    if (unreadCount > prevUnreadCountRef.current && notifications.length > 0) {
      const newestNotification = notifications[0];
      setToastNotification(newestNotification);
    }
    prevUnreadCountRef.current = unreadCount;
  }, [unreadCount, notifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
  };

  return (
    <>
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-lg transition-colors ${
          isConnected
            ? "hover:bg-gray-100 text-gray-700"
            : "text-gray-400 cursor-not-allowed opacity-50"
        }`}
        aria-label={`Notifications (${unreadCount} unread)`}
        title={isConnected ? "Notifications" : "Connecting to notifications..."}
      >
        <BellIcon className="w-6 h-6" />

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-teal-500 rounded-full min-w-5">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}

        {/* Connection status indicator */}
        <div
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500" : "bg-red-500"
          }`}
          title={isConnected ? "Connected" : "Disconnected"}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-40 max-h-96 flex flex-col"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleMarkAsRead}
                />
              ))
            )}
          </div>

          {/* Footer link */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <a
                href="/notifications"
                className="text-xs text-teal-600 hover:text-teal-700 font-medium"
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <Toast
          notification={toastNotification}
          onClose={() => setToastNotification(null)}
        />
      )}

      {/* Styles for animations */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }

        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
}

/**
 * Helper function to format time elapsed
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return "Just now";
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;

  const weeks = Math.floor(secondsAgo / 604800);
  return `${weeks}w ago`;
}
