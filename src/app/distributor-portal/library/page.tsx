"use client";
import LibraryView from "@/components/LibraryView";
import { useI18n } from "@/i18n";

export default function DistributorPortalLibraryPage() {
  const { t } = useI18n();
  return <LibraryView crumbLabel={t.distributorPortal.crumb} crumbHref="/distributor-portal" />;
}
