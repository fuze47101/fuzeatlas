"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode?: string;
  factoryCode?: string;
  note?: string;
  weightGsm?: number;
  widthInches?: number;
  construction?: string;
  yarnType?: string;
  createdAt: string;
}

export default function FactoryFabricsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }

    const loadFabrics = async () => {
      try {
        const qs = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`/api/factory-portal/fabrics${qs}`);
        const data = await res.json();
        if (data.ok) {
          setFabrics(data.fabrics);
        } else {
          setError(data.error || "Failed to load fabrics");
        }
      } catch (e) {
        setError("Failed to load fabrics");
      } finally {
        setLoading(false);
      }
    };

    loadFabrics();
  }, [user, router, search]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">My Fabrics</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">My Fabrics</h1>
          <p className="text-sm text-slate-500 mt-1">
            {fabrics.length} fabric{fabrics.length !== 1 ? "s" : ""} registered for FUZE treatment
          </p>
        </div>
        <Link href="/factory-portal/intake"
          className="px-4 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all">
          Add Fabric
        </Link>
      </div>

      {/* Search */}
      {fabrics.length > 0 || search ? (
        <div className="mb-6">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by code, construction, FUZE number..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#00b4c3] focus:border-transparent outline-none"
            />
          </div>
        </div>
      ) : null}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Fabrics Table */}
      {fabrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-2">
            {search ? "No fabrics match your search" : "No fabrics yet"}
          </p>
          {search ? (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="text-[#00b4c3] hover:underline font-medium text-sm"
            >
              Clear search
            </button>
          ) : (
            <Link href="/factory-portal/intake"
              className="text-[#00b4c3] hover:underline font-medium text-sm">
              Submit your first fabric &rarr;
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">FUZE #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Your Code</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Construction</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Weight</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Yarn</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fabrics.map(fabric => (
                <tr key={fabric.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/fabrics/${fabric.id}`)}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-[#00b4c3]">FUZE-{fabric.fuzeNumber}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {fabric.customerCode || fabric.factoryCode || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell truncate max-w-[200px]">
                    {fabric.construction || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {fabric.weightGsm ? `${fabric.weightGsm} GSM` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {fabric.yarnType || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden lg:table-cell">
                    {new Date(fabric.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
