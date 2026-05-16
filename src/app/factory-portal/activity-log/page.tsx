"use client";

import ActivityLogPage from "@/components/ActivityLogPage";
import { useI18n } from "@/i18n";

export default function FactoryPortalActivityLogPage() {
  const { t } = useI18n();
  return (
    <ActivityLogPage
      apiPath="/api/factory-portal/activity-log"
      portalLabel={t.factoryPortal.crumb}
      portalHref="/factory-portal"
    />
  );
}
