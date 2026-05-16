"use client";

import OrgTeamPage from "@/components/OrgTeamPage";
import { useI18n } from "@/i18n";

export default function FactoryPortalTeamPage() {
  const { t } = useI18n();
  return (
    <OrgTeamPage
      apiPath="/api/factory-portal/team"
      portalLabel={t.factoryPortal.crumb}
      portalHref="/factory-portal"
      inviteRoles={["FACTORY_USER", "FACTORY_MANAGER"]}
      defaultRole="FACTORY_USER"
      entityKey="factory"
    />
  );
}
