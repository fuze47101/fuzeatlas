"use client";
import ActivityLogPage from "@/components/ActivityLogPage";
import { useI18n } from "@/i18n";

export default function LabPortalActivityLogPage() {
  const { t } = useI18n();
  return (
    <ActivityLogPage
      apiPath="/api/lab-portal/activity-log"
      portalLabel={t.labPortal.crumb}
      portalHref="/lab-portal"
    />
  );
}
