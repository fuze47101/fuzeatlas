// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  metadata?: any;
}

const TYPE_ICONS: Record<string, string> = {
  TEST_APPROVED: "✅",
  TEST_RESULTS: "🧪",
  ACCESS_REQUEST: "🔑",
  PO_STATUS: "📋",
  SOW_UPDATE: "📝",
  BRAND_ACTIVITY: "🏷️",
  SYSTEM: "⚙️",
};

const TYPE_COLORS: Record<string, string> = {
  TEST_APPROVED: "bg-green-50 border-green-200",
  TEST_RESULTS: "bg-teal-50 border-teal-200",
  ACCESS_REQUEST: "bg-amber-50 border-amber-200",
  PO_STATUS: "bg-blue-50 border-blue-200",
  SOW_UPDATE: "bg-purple-50 border-purple-200",
  BRAND_ACTIVITY: "bg-indigo-50 border-indigo-200",
  SYSTEM: "bg-slate-50 border-slate-200",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const T = t.notificationsPage;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return T.justNow;
    if (diff < 3600) return `${Math.floor(diff / 60)}${T.minSuffix}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}${T.hourSuffix}`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}${T.daySuffix}`;
    return date.toLocaleDateString();
  }

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const params = filter === "unread" ? "?unreadOnly=true" : "";
      const res = await fetch(`/api/notifications${params}`, {
        headers: { "x-user-id": user.id },
      });
      const data = await res.json();
      if (data.ok) {
        setNotifications(data.notifications || []);
      }
    } catch (e) {
      console.error("Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
    } catch {}
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date().toISOString() }))
      );
    } catch {}
  };

  const handleArchiveOld = async () => {
    if (!user?.id) return;
    if (!confirm("Archive all notifications older than 30 days? They'll be hidden from this list but kept in history.")) return;
    try {
      const r = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ archive: true, archiveOlderThanDays: 30 }),
      });
      const d = await r.json();
      if (d.ok) {
        const cutoffMs = Date.now() - 30 * 86400000;
        setNotifications((prev) =>
          prev.filter((n) => new Date(n.createdAt).getTime() >= cutoffMs),
        );
      }
    } catch {}
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Get unique types for the filter
  const types = [...new Set(notifications.map((n) => n.type))];

  // Apply type filter
  const filtered = typeFilter === "ALL" ? notifications : notifications.filter((n) => n.type === typeFilter);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-10 flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-400 text-sm">{T.loading}</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-10 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{T.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} ${T.unreadLabel}` : T.allCaughtUp} · {notifications.length} {T.totalLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 text-sm font-medium text-[#00b4c3] bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              {T.markAllRead}
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleArchiveOld}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title="Archive everything older than 30 days. History is preserved, just hidden from the default list."
            >
              Archive {">"} 30 days
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filter === "all" ? "bg-[#00b4c3] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {T.filterAll}
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              filter === "unread" ? "bg-[#00b4c3] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {T.filterUnread} ({unreadCount})
          </button>
        </div>
        {types.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="ALL">{T.allTypes}</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_ICONS[t] || "📌"} {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🔔</div>
          <p className="text-slate-500 font-medium">
            {filter === "unread" ? T.emptyUnreadTitle : T.emptyAllTitle}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {filter === "unread"
              ? T.emptyUnreadBody
              : T.emptyAllBody}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`bg-white border rounded-xl p-4 transition-all ${
                n.read ? "border-slate-200 opacity-75" : `${TYPE_COLORS[n.type] || "border-teal-200 bg-teal-50/30"} shadow-sm`
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl flex-shrink-0 mt-0.5">
                  {TYPE_ICONS[n.type] || "📌"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`text-sm font-semibold ${n.read ? "text-slate-600" : "text-slate-900"}`}>
                        {n.title}
                      </h3>
                      <p className={`text-sm mt-0.5 ${n.read ? "text-slate-400" : "text-slate-600"}`}>
                        {n.message}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {n.link && (
                      <Link
                        href={n.link}
                        className="text-xs font-medium text-[#00b4c3] hover:underline"
                        onClick={() => !n.read && handleMarkAsRead([n.id])}
                      >
                        {T.viewDetails}
                      </Link>
                    )}
                    {!n.read && (
                      <button
                        onClick={() => handleMarkAsRead([n.id])}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        {T.markAsRead}
                      </button>
                    )}
                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                      {n.type.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
