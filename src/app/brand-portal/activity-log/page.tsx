"use client";
import ActivityLogPage from "@/components/ActivityLogPage";
import { useI18n } from "@/i18n";

export default function BrandPortalActivityLogPage() {
  const { t } = useI18n();
  return (
    <ActivityLogPage
      apiPath="/api/brand-portal/activity-log"
      portalLabel={t.brandPortal.crumb}
      portalHref="/brand-portal"
    />
  );
}
