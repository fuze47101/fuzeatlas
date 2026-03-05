"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  APPROVE: "bg-emerald-100 text-emerald-800",
  REJECT: "bg-amber-100 text-amber-800",
  LOGIN: "bg-slate-100 text-slate-800",
  EXPORT: "bg-purple-100 text-purple-800",
  STAMP: "bg-purple-100 text-purple-800",
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchLogs = async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "50",
      });
      if (filterAction) params.append("action", filterAction);
      if (filterEntity) params.append("entity", filterEntity);
      if (filterDateFrom) params.append("dateFrom", filterDateFrom);
      if (filterDateTo) params.append("dateTo", filterDateTo);

      const res = await fetch(`/api/audit-log?${params}`);
      const data = await res.json();

      if (data.ok) {
        setLogs(data.logs);
        setTotal(data.total);
        setPage(pageNum);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs(1);
  }, [filterAction, filterEntity, filterDateFrom, filterDateTo]);

  const entities = [
    "Brand",
    "Fabric",
    "TestRequest",
    "TestRun",
    "SOW",
    "User",
    "AccessRequest",
  ];
  const actions = ["CREATE", "UPDATE", "DELETE", "APPROVE", "REJECT", "LOGIN", "EXPORT", "STAMP"];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-600 mt-1">
            Track all system changes and user actions
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Action
              </label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              >
                <option value="">All Actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Entity Type
              </label>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              >
                <option value="">All Entities</option>
                {entities.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-600">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-slate-600">
              No audit logs found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      User
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-slate-700">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-600">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">
                          {log.user?.name || "-"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {log.user?.email || "System"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                            ACTION_COLORS[log.action] || "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{log.entity}</div>
                        {log.entityId && (
                          <div className="text-xs text-slate-500 font-mono">
                            {log.entityId.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600">
                          {log.description}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
              <div className="text-sm text-slate-600">
                Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total} logs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchLogs(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchLogs(page + 1)}
                  disabled={page * 50 >= total}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
