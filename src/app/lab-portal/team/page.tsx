"use client";
import OrgTeamPage from "@/components/OrgTeamPage";
import { useI18n } from "@/i18n";

export default function LabPortalTeamPage() {
  const { t } = useI18n();
  return (
    <OrgTeamPage
      apiPath="/api/lab-portal/team"
      portalLabel={t.labPortal.crumb}
      portalHref="/lab-portal"
      inviteRoles={["LAB_USER"]}
      defaultRole="LAB_USER"
      entityKey="lab"
    />
  );
}
