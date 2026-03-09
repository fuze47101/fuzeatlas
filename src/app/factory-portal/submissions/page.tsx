"use client";

import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Submission {
  id: string;
  status: string;
  fabric: {
    id: string;
    note?: string;
    fuzeNumber: number | null;
    construction?: string;
  };
  createdAt: string;
  testResults?: {
    testType: string;
    status: string;
  }[];
}

export default function FactorySubmissionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role !== "FACTORY_USER" && user?.role !== "FACTORY_MANAGER") {
      router.push("/dashboard");
      return;
    }

    const loadSubmissions = async () => {
      try {
        const res = await fetch("/api/factory-portal/submissions");
        const data = await res.json();
        if (data.ok) {
          setSubmissions(data.submissions);
        } else {
          setError(data.error || "Failed to load submissions");
        }
      } catch (e) {
        setError("Failed to load submissions");
      } finally {
        setLoading(false);
      }
    };

    loadSubmissions();
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00b4c3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800",
    IN_REVIEW: "bg-amber-100 text-amber-800",
    APPROVED: "bg-emerald-100 text-emerald-800",
    TESTING: "bg-purple-100 text-purple-800",
    COMPLETE: "bg-emerald-100 text-emerald-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/factory-portal" className="hover:text-[#00b4c3]">Factory Portal</Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">Submissions</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">Fabric Submissions</h1>
          <p className="text-sm text-slate-500 mt-1">Track the status of your fabric submissions</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 mb-4">No submissions yet</p>
          <Link href="/factory-portal/intake"
            className="text-[#00b4c3] hover:underline font-medium text-sm">
            Submit a fabric →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map(submission => (
            <Link key={submission.id} href={`/fabric-submissions/${submission.id}`}
              className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-[#00b4c3] hover:shadow-md transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-900 truncate">
                      {submission.fabric.note?.replace("Intake: ", "").split(" | ")[0] || submission.fabric.construction || `FUZE-${submission.fabric.fuzeNumber}`}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[submission.status] || "bg-slate-100 text-slate-600"}`}>
                      {submission.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="font-mono font-medium">FUZE-{submission.fabric.fuzeNumber}</span>
                    <span>·</span>
                    <span>Submitted {new Date(submission.createdAt).toLocaleDateString()}</span>
                  </div>
                  {submission.testResults && submission.testResults.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {submission.testResults.map((result, idx) => (
                        <span key={idx} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                          {result.testType}: {result.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right ml-4">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
