import OrgTeamPage from "@/components/OrgTeamPage";

export default function DistributorPortalTeamPage() {
  return (
    <OrgTeamPage
      apiPath="/api/distributor-portal/team"
      portalLabel="Distributor Portal"
      portalHref="/distributor-portal"
      inviteRoles={["DISTRIBUTOR_USER"]}
      defaultRole="DISTRIBUTOR_USER"
      entityKey="distributor"
    />
  );
}
