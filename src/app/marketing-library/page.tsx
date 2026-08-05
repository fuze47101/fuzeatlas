"use client";
import { useI18n } from "@/i18n";
import DocumentLibraryView, { type LibraryCategory } from "@/components/DocumentLibraryView";

/* Marketing collateral categories (labels/desc come from i18n). */
const MARKETING_CATEGORIES: LibraryCategory[] = [
  { id: "BROCHURE", labelKey: "catBrochure", descKey: "catBrochureDesc", icon: "\u{1F4D6}", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "SELL_SHEET", labelKey: "catSellSheet", descKey: "catSellSheetDesc", icon: "\u{1F4C4}", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "ONE_PAGER", labelKey: "catOnePager", descKey: "catOnePagerDesc", icon: "\u{1F4C3}", color: "bg-sky-50 text-sky-700 border-sky-200" },
  { id: "PRESENTATION", labelKey: "catPresentation", descKey: "catPresentationDesc", icon: "\u{1F4CA}", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "CASE_STUDY", labelKey: "catCaseStudy", descKey: "catCaseStudyDesc", icon: "\u{1F4DA}", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "SOCIAL", labelKey: "catSocial", descKey: "catSocialDesc", icon: "\u{1F4F1}", color: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  { id: "LOGO_BRAND", labelKey: "catLogoBrand", descKey: "catLogoBrandDesc", icon: "\u{1F3A8}", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { id: "VIDEO", labelKey: "catVideo", descKey: "catVideoDesc", icon: "\u{1F3A5}", color: "bg-red-50 text-red-700 border-red-200" },
  { id: "OTHER", labelKey: "catOther", descKey: "catOtherDesc", icon: "\u{1F4C1}", color: "bg-slate-50 text-slate-700 border-slate-200" },
];

export default function MarketingLibraryPage() {
  const { t } = useI18n();
  return (
    <DocumentLibraryView
      libraryType="MARKETING"
      categories={MARKETING_CATEGORIES}
      text={t.marketingLibrary}
      move={{ label: (t.marketingLibrary as any).moveToLibrary, targetType: "COMPLIANCE" }}
    />
  );
}
