"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/i18n";

// Helper: Format CFU values to scientific notation
function formatCFU(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "0";
  if (value < 1000) return value.toFixed(0);
  const exp = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exp);
  const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const supExp = String(exp)
    .split("")
    .map((d) => superscripts[parseInt(d)])
    .join("");
  return `${mantissa.toFixed(1)} × 10${supExp}`;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  ICP: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
  ANTIBACTERIAL: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  FUNGAL: { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  ODOR: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
  UV: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
  MICROFIBER: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    dot: "bg-teal-500",
  },
  OTHER: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
};

interface Document {
  id: string;
  filename: string;
  kind: string;
}

interface AIReviewData {
  anomalies?: Array<{
    severity: "high" | "medium" | "low";
    type: string;
    message: string;
    testIndex?: number;
  }>;
  passAssessment?: string;
  mathChecks?: Array<{ name: string; passed: boolean }>;
  confidence?: number;
  notes?: string;
}

interface TestRun {
  id: string;
  testType: string;
  testNumber: number;
  testMethodRaw?: string;
  testMethodStd?: string;
  testReportNumber?: string;
  testDate?: string;
  washCount?: number;
  testNumberInReport?: number;
  aiReviewData?: AIReviewData;
  aiReviewDate?: string;
  aiReviewNotes?: string;
  lab?: { id: string; name: string };
  submission?: {
    id: string;
    fuzeFabricNumber?: number;
    brand?: { id: string; name: string };
    factory?: { id: string; name: string };
    fabric?: { id: string; fuzeNumber?: number; customerCode?: string };
  };
  icpResult?: { agValue?: number; auValue?: number; unit?: string };
  abResult?: {
    organism?: string;
    strainNumber?: string;
    testMethodStd?: string;
    brothMedia?: string;
    surfactant?: string;
    sterilization?: string;
    contactTime?: string;
    incubationTemp?: string;
    agarMedium?: string;
    inoculumCFU?: number;
    controlCFU?: number;
    treatedCFU?: number;
    percentReduction?: number;
    growthValue?: number;
    activityValue?: number;
    methodPass?: boolean;
    methodPassReason?: string;
    organism1?: string;
    organism2?: string;
    result1?: number;
    result2?: number;
    pass?: boolean;
  };
  fungalResult?: { writtenResult?: string; pass?: boolean };
  odorResult?: { testedOdor?: string; result?: string; pass?: boolean };
  documents?: Document[];
  brandVisible?: boolean;
  brandApprovedAt?: string;
}

interface ApiResponse {
  ok: boolean;
  testRun?: TestRun;
  error?: string;
}

export default function TestDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = params.id as string;

  const [test, setTest] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAILocal, setExpandedAILocal] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/tests/${id}`)
      .then((res) => res.json())
      .then((data: ApiResponse) => {
        if (data.ok && data.testRun) {
          setTest(data.testRun);
        } else {
          setError(data.error || "Test not found");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto">
        <Link
          href="/tests"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm mb-6"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t.common.back}
        </Link>
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-red-600 font-medium">{error || t.tests.noTests}</p>
        </div>
      </div>
    );
  }

  const colors = TYPE_COLORS[test.testType] || TYPE_COLORS.OTHER;
  const hasRichAB =
    test.abResult &&
    (test.abResult.organism ||
      test.abResult.inoculumCFU !== undefined ||
      test.abResult.brothMedia);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header with back link */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/tests"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t.common.back}
        </Link>

        <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text}`}>
          {test.testType}
        </span>

        {/* Brand Visibility Stamp */}
        <div className="ml-auto flex items-center gap-3">
          {/* Certificate Download Button */}
          {(() => {
            let hasPassed = false;
            if (test.testType === "ICP" && test.icpResult) hasPassed = !!(test.icpResult.agValue || test.icpResult.auValue);
            else if (test.testType === "ANTIBACTERIAL" && test.abResult) hasPassed = test.abResult.methodPass !== false;
            else if (test.testType === "FUNGAL" && test.fungalResult) hasPassed = test.fungalResult.pass === true;
            else if (test.testType === "ODOR" && test.odorResult) hasPassed = test.odorResult.pass === true;

            return hasPassed ? (
              <a href={`/api/tests/${test.id}/certificate`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-1.5 bg-slate-600 text-white rounded-full text-xs font-semibold hover:bg-slate-700 transition-colors flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m7-4a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Download Certificate
              </a>
            ) : null;
          })()}

          <div>
            {test.brandVisible ? (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Approved for Brand Portal
                </span>
                <button
                  onClick={() => {
                    fetch(`/api/tests/${test.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandVisible: false }) })
                      .then(r => r.json()).then(d => { if (d.ok) setTest({ ...test, brandVisible: false, brandApprovedAt: undefined }); });
                  }}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                  title="Remove from brand portal"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  fetch(`/api/tests/${test.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandVisible: true }) })
                    .then(r => r.json()).then(d => { if (d.ok) setTest({ ...test, brandVisible: true, brandApprovedAt: new Date().toISOString() }); });
                }}
                className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold hover:bg-emerald-100 hover:text-emerald-700 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Stamp for Brand Portal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Header info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {test.testReportNumber && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {t.tests.testReport}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {test.testReportNumber}
            </p>
          </div>
        )}
        {test.testDate && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {t.common.date}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {new Date(test.testDate).toLocaleDateString()}
            </p>
          </div>
        )}
        {test.lab && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              {t.tests.lab}
            </p>
            <p className="text-lg font-semibold text-slate-900">
              {test.lab.name}
            </p>
          </div>
        )}
      </div>

      {/* Test Metadata Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4">{t.tests.testMethod}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                {t.tests.testType}
              </p>
              <p className="text-slate-900 font-medium">{test.testType}</p>
            </div>
            {test.testMethodStd && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.methodStd}
                </p>
                <p className="text-slate-900 font-medium">{test.testMethodStd}</p>
              </div>
            )}
            {test.testDate && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.common.date}
                </p>
                <p className="text-slate-900 font-medium">
                  {new Date(test.testDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {test.testReportNumber && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.testReport}
                </p>
                <p className="text-slate-900 font-medium">
                  {test.testReportNumber}
                </p>
              </div>
            )}
            {test.washCount !== undefined && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.washCount}
                </p>
                <p className="text-slate-900 font-medium">{test.washCount}</p>
              </div>
            )}
            {test.testNumberInReport && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.testNumber} in {t.tests.result}
                </p>
                <p className="text-slate-900 font-medium">
                  {test.testNumberInReport}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Linked Entities Card */}
      {test.submission && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">
            Linked Entities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {test.submission.brand && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.brand}
                </p>
                <Link
                  href={`/brands/${test.submission.brand.id}`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {test.submission.brand.name}
                </Link>
              </div>
            )}
            {test.submission.factory && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.factory}
                </p>
                <Link
                  href={`/factories/${test.submission.factory.id}`}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  {test.submission.factory.name}
                </Link>
              </div>
            )}
            {test.submission.fabric && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.fabric}
                </p>
                <div className="space-y-1">
                  <Link
                    href={`/fabrics/${test.submission.fabric.id}`}
                    className="block text-blue-600 hover:text-blue-700 font-medium"
                  >
                    FUZE #{test.submission.fabric.fuzeNumber}
                  </Link>
                  {test.submission.fabric.customerCode && (
                    <p className="text-xs text-slate-500">
                      {test.submission.fabric.customerCode}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ICP Results */}
      {test.icpResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{t.tests.icp}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {test.icpResult.agValue !== undefined && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Ag Content
                </p>
                <div className="flex items-baseline gap-2">
                  <p
                    className={`text-2xl font-bold ${
                      test.icpResult.agValue > 50
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {test.icpResult.agValue}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {test.icpResult.unit || "ppm"}
                  </p>
                </div>
              </div>
            )}
            {test.icpResult.auValue !== undefined && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
                  Gold (Au)
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-blue-600">
                    {test.icpResult.auValue}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {test.icpResult.unit || "ppm"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Antibacterial Results — Rich View */}
      {test.abResult && hasRichAB && (
        <div className="space-y-4">
          {/* Organism Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-slate-900 text-lg mb-2">
              {test.abResult.organism || "Organism"}
            </h3>
            {test.abResult.strainNumber && (
              <p className="text-sm text-slate-600">
                Strain: {test.abResult.strainNumber}
              </p>
            )}
          </div>

          {/* Test Conditions */}
          {(test.abResult.brothMedia ||
            test.abResult.surfactant ||
            test.abResult.sterilization ||
            test.abResult.contactTime ||
            test.abResult.incubationTemp ||
            test.abResult.agarMedium) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="font-medium text-slate-900 mb-4">
                Test Conditions
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {test.abResult.brothMedia && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.brothMedia}
                    </p>
                    <p className="text-slate-900">{test.abResult.brothMedia}</p>
                  </div>
                )}
                {test.abResult.surfactant && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.surfactant}
                    </p>
                    <p className="text-slate-900">{test.abResult.surfactant}</p>
                  </div>
                )}
                {test.abResult.sterilization && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.sterilization}
                    </p>
                    <p className="text-slate-900">
                      {test.abResult.sterilization}
                    </p>
                  </div>
                )}
                {test.abResult.contactTime && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.contactTime}
                    </p>
                    <p className="text-slate-900">
                      {test.abResult.contactTime}
                    </p>
                  </div>
                )}
                {test.abResult.incubationTemp && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.incubationTemp}
                    </p>
                    <p className="text-slate-900">
                      {test.abResult.incubationTemp}
                    </p>
                  </div>
                )}
                {test.abResult.agarMedium && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.agarMedium}
                    </p>
                    <p className="text-slate-900">
                      {test.abResult.agarMedium}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CFU Results */}
          {(test.abResult.inoculumCFU !== undefined ||
            test.abResult.controlCFU !== undefined ||
            test.abResult.treatedCFU !== undefined) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="font-medium text-slate-900 mb-4">CFU Results</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {test.abResult.inoculumCFU !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.inoculum}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatCFU(test.abResult.inoculumCFU)}
                    </p>
                  </div>
                )}
                {test.abResult.controlCFU !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.controlCFU}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatCFU(test.abResult.controlCFU)}
                    </p>
                  </div>
                )}
                {test.abResult.treatedCFU !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.treatedCFU}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {formatCFU(test.abResult.treatedCFU)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Derived Values */}
          {(test.abResult.percentReduction !== undefined ||
            test.abResult.growthValue !== undefined ||
            test.abResult.activityValue !== undefined) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h4 className="font-medium text-slate-900 mb-4">Derived Values</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {test.abResult.percentReduction !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.percentReduction}
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {test.abResult.percentReduction.toFixed(2)}%
                    </p>
                  </div>
                )}
                {test.abResult.growthValue !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.growthValue} (F)
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {test.abResult.growthValue.toFixed(2)}
                    </p>
                  </div>
                )}
                {test.abResult.activityValue !== undefined && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                      {t.tests.activityValue} (A)
                    </p>
                    <p className="text-lg font-semibold text-slate-900">
                      {test.abResult.activityValue === null
                        ? "—"
                        : test.abResult.activityValue.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Method Pass/Fail */}
          {test.abResult.methodPass !== undefined && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    test.abResult.methodPass
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {test.abResult.methodPass ? t.tests.methodPass : t.tests.methodFail}
                </span>
                {test.abResult.methodPassReason && (
                  <p className="text-sm text-slate-600">
                    {test.abResult.methodPassReason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Antibacterial Results — Legacy View */}
      {test.abResult && !hasRichAB && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">
            {t.tests.antibacterial}
          </h3>
          <div className="space-y-3">
            {test.abResult.organism1 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.organism}
                </p>
                <p className="text-slate-900 font-medium">
                  {test.abResult.organism1}
                </p>
              </div>
            )}
            {test.abResult.result1 !== undefined && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.result}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {test.abResult.result1.toFixed(2)}%
                </p>
              </div>
            )}
            {test.abResult.pass !== undefined && (
              <div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    test.abResult.pass
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {test.abResult.pass ? t.tests.methodPass : t.tests.methodFail}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fungal Results */}
      {test.fungalResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{t.tests.fungal}</h3>
          <div className="space-y-3">
            {test.fungalResult.writtenResult && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.result}
                </p>
                <p className="text-slate-900 font-medium">
                  {test.fungalResult.writtenResult}
                </p>
              </div>
            )}
            {test.fungalResult.pass !== undefined && (
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  test.fungalResult.pass
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {test.fungalResult.pass ? "Pass" : "Fail"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Odor Results */}
      {test.odorResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{t.tests.odor}</h3>
          <div className="space-y-3">
            {test.odorResult.testedOdor && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  Tested Odor
                </p>
                <p className="text-slate-900 font-medium">
                  {test.odorResult.testedOdor}
                </p>
              </div>
            )}
            {test.odorResult.result && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                  {t.tests.result}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {test.odorResult.result}
                </p>
              </div>
            )}
            {test.odorResult.pass !== undefined && (
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  test.odorResult.pass
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {test.odorResult.pass ? "Pass" : "Fail"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI Review Panel */}
      {test.aiReviewData && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setExpandedAILocal(!expandedAILocal)}
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-slate-900">{t.tests.aiReview}</h3>
              {test.aiReviewData.anomalies &&
                test.aiReviewData.anomalies.length > 0 && (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                    {test.aiReviewData.anomalies.length}
                  </span>
                )}
            </div>
            <svg
              className={`w-5 h-5 text-slate-400 transition-transform ${
                expandedAILocal ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>

          {expandedAILocal && (
            <div className="border-t border-slate-200 px-5 py-4 space-y-6">
              {/* Anomalies */}
              {test.aiReviewData.anomalies &&
                test.aiReviewData.anomalies.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">
                      {t.tests.anomalies}
                    </h4>
                    <div className="space-y-2">
                      {test.aiReviewData.anomalies.map((anom, idx) => (
                        <div key={idx} className="flex gap-3 p-3 bg-slate-50 rounded-lg">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                              anom.severity === "high"
                                ? "bg-red-100 text-red-700"
                                : anom.severity === "medium"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {anom.severity}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">
                              {anom.type}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {anom.message}
                            </p>
                            {anom.testIndex !== undefined && (
                              <p className="text-xs text-slate-500 mt-1">
                                Test #{anom.testIndex}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Pass Assessment */}
              {test.aiReviewData.passAssessment && (
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    Pass Assessment
                  </h4>
                  <p className="text-slate-600 text-sm">
                    {test.aiReviewData.passAssessment}
                  </p>
                </div>
              )}

              {/* Math Checks */}
              {test.aiReviewData.mathChecks &&
                test.aiReviewData.mathChecks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-slate-900 mb-3">
                      Math Checks
                    </h4>
                    <div className="space-y-2">
                      {test.aiReviewData.mathChecks.map((check, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          {check.passed ? (
                            <svg
                              className="w-4 h-4 text-green-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4 text-red-600"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          <span>{check.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Confidence */}
              {test.aiReviewData.confidence !== undefined && (
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    {t.tests.confidence}
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full"
                        style={{
                          width: `${test.aiReviewData.confidence * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-sm font-medium text-slate-900 min-w-fit">
                      {(test.aiReviewData.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              )}

              {/* AI Notes */}
              {test.aiReviewNotes && (
                <div>
                  <h4 className="font-medium text-slate-900 mb-2">
                    {t.tests.aiNotes}
                  </h4>
                  <p className="text-slate-600 text-sm">{test.aiReviewNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Documents */}
      {test.documents && test.documents.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Documents</h3>
          <div className="space-y-2">
            {test.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg group"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M4 3a2 2 0 012-2h5.293A1 1 0 0112 2.414l3.293 3.293A1 1 0 0115 7.121V16a2 2 0 01-2 2H6a2 2 0 01-2-2V3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {doc.filename}
                    </p>
                    {doc.kind && (
                      <p className="text-xs text-slate-500">{doc.kind}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    View Report
                  </a>
                  <a
                    href={`/api/documents/${doc.id}`}
                    download={doc.filename}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-300 transition-colors"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
