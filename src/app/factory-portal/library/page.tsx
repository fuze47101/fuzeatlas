"use client";
import LibraryView from "@/components/LibraryView";
import { useI18n } from "@/i18n";

export default function FactoryPortalLibraryPage() {
  const { t } = useI18n();
  return <LibraryView crumbLabel={t.factoryPortal.crumb} crumbHref="/factory-portal" />;
}
