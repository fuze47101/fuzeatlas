"use client";
import LibraryView from "@/components/LibraryView";
import { useI18n } from "@/i18n";

export default function BrandPortalLibraryPage() {
  const { t } = useI18n();
  return <LibraryView crumbLabel={t.brandPortal.crumb} crumbHref="/brand-portal" />;
}
