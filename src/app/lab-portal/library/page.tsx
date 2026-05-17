"use client";
import LibraryView from "@/components/LibraryView";
import { useI18n } from "@/i18n";

export default function LabPortalLibraryPage() {
  const { t } = useI18n();
  return <LibraryView crumbLabel={t.labPortal.crumb} crumbHref="/lab-portal" />;
}
