"use client";
import ActivityLogPage from "@/components/ActivityLogPage";
import { useI18n } from "@/i18n";

export default function DistributorPortalActivityLogPage() {
  const { t } = useI18n();
  return (
    <ActivityLogPage
      apiPath="/api/distributor-portal/activity-log"
      portalLabel={t.distributorPortal.crumb}
      portalHref="/distributor-portal"
    />
  );
}
