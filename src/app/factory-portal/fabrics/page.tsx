"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Fabric {
  id: string;
  fuzeNumber: number | null;
  customerCode?: string;
  note?: string;
  weightGsm?: number;
  construction?: string;
  createdAt: string;
}

export default function FactoryFabricsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }

    const loadFabrics = async () => {
      try {
        const res = await fetch("/api/factory-portal/fabrics");
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
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    ARCHIVED: "bg-slate-100 text-slate-800",
    PENDING: "bg-amber-100 text-amber-800",
  };

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
          <p className="text-sm text-slate-500 mt-1">All fabrics submitted for FUZE treatment</p>
        </div>
        <Link href="/factory-portal/intake"
          className="px-4 py-2.5 bg-gradient-to-r from-[#00b4c3] to-[#009ba8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-[#00b4c3]/30 transition-all">
          Add Fabric
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Fabrics List */}
      {fabrics.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">No fabrics yet</p>
          <Link href="/factory-portal/intake"
            className="text-[#00b4c3] hover:underline font-medium text-sm">
            Submit your first fabric →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {fabrics.map(fabric => (
            <Link key={fabric.id} href={`/fabrics/${fabric.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-[#00b4c3] hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-900 truncate">
                      {fabric.note?.replace("Intake: ", "").split(" | ")[0] || fabric.construction || `FUZE-${fabric.fuzeNumber}`}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="font-mono font-medium">FUZE-{fabric.fuzeNumber}</span>
                    {fabric.customerCode && <><span>·</span><span>{fabric.customerCode}</span></>}
                    {fabric.weightGsm && <><span>·</span><span>{fabric.weightGsm} GSM</span></>}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-xs text-slate-400">{new Date(fabric.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
