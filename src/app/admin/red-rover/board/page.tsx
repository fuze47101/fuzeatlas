"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { HydrationFrame, useMountLog } from "@/components/HydrationFrame";
import { RedRoverBoard, type BoardTarget } from "@/components/RedRoverBoard";

export default function RedRoverBoardPageOuter() {
  return (
    <HydrationFrame name="/admin/red-rover/board">
      <RedRoverBoardPage />
    </HydrationFrame>
  );
}

function RedRoverBoardPage() {
  useMountLog("red-rover-board");
  const { user, loading } = useAuth();
  const router = useRouter();
  const [targets, setTargets] = useState<BoardTarget[]>([]);
  const [fetching, setFetching] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const isAdmin = !!user && ["ADMIN", "EMPLOYEE", "SALES_MANAGER"].includes(user.role);

  const load = useCallback(async () => {
    setFetching(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/red-rover", { cache: "no-store" });
      if (!res.ok) setErr(`API ${res.status}`);
      else {
        const j = await res.json();
        setTargets(j.targets || []);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace("/home");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  if (loading || (fetching && targets.length === 0)) {
    return <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-slate-500">Loading board…</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">🚀 Red Rover — Board</h1>
          <p className="text-sm text-slate-500">Drag a target between stages to update it (writes a status-change to its timeline).</p>
        </div>
        <Link
          href="/admin/red-rover"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Table view
        </Link>
      </div>
      {err && (
        <div className="mb-4 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load: {err}
        </div>
      )}
      <RedRoverBoard targets={targets} onReload={load} />
    </div>
  );
}
