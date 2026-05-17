"use client";
import OrgTeamPage from "@/components/OrgTeamPage";
import { useI18n } from "@/i18n";

export default function DistributorPortalTeamPage() {
  const { t } = useI18n();
  return (
    <OrgTeamPage
      apiPath="/api/distributor-portal/team"
      portalLabel={t.distributorPortal.crumb}
      portalHref="/distributor-portal"
      inviteRoles={["DISTRIBUTOR_USER"]}
      defaultRole="DISTRIBUTOR_USER"
      entityKey="distributor"
    />
  );
}
