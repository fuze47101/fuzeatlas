"use client";
import { useI18n } from "@/i18n";
import DocumentLibraryView, { type LibraryCategory } from "@/components/DocumentLibraryView";

/* Compliance / technical document categories (labels/desc come from i18n). */
const COMPLIANCE_CATEGORIES: LibraryCategory[] = [
  { id: "SDS_MSDS", labelKey: "catSDS", descKey: "catSDSDesc", icon: "\u{1F9EA}", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "TDS", labelKey: "catTDS", descKey: "catTDSDesc", icon: "\u{1F4C4}", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "BLUESIGN", labelKey: "catBluesign", descKey: "catBluesignDesc", icon: "\u{1F535}", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { id: "ZDHC", labelKey: "catZDHC", descKey: "catZDHCDesc", icon: "\u{1F3C5}", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "OEKO_TEX", labelKey: "catOekoTex", descKey: "catOekoTexDesc", icon: "\u{1F33F}", color: "bg-green-50 text-green-700 border-green-200" },
  { id: "GOTS", labelKey: "catGOTS", descKey: "catGOTSDesc", icon: "\u{1F331}", color: "bg-lime-50 text-lime-700 border-lime-200" },
  { id: "EPA", labelKey: "catEPA", descKey: "catEPADesc", icon: "\u{1F3DB}\u{FE0F}", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "REACH", labelKey: "catREACH", descKey: "catREACHDesc", icon: "\u{1F30D}", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "COA", labelKey: "catCoA", descKey: "catCoADesc", icon: "\u{1F52C}", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "COC", labelKey: "catCoC", descKey: "catCoCDesc", icon: "\u{2705}", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "ISO", labelKey: "catISO", descKey: "catISODesc", icon: "\u{1F4CB}", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { id: "IMPORT_EXPORT", labelKey: "catImportExport", descKey: "catImportExportDesc", icon: "\u{1F6A2}", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { id: "OTHER", labelKey: "catOther", descKey: "catOtherDesc", icon: "\u{1F4C1}", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

export default function ComplianceLibraryPage() {
  const { t } = useI18n();
  return (
    <DocumentLibraryView
      libraryType="COMPLIANCE"
      categories={COMPLIANCE_CATEGORIES}
      text={t.complianceLibrary}
      move={{ label: (t.complianceLibrary as any).moveToMarketing, targetType: "MARKETING" }}
    />
  );
}
