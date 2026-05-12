import OrgTeamPage from "@/components/OrgTeamPage";

export default function FactoryPortalTeamPage() {
  return (
    <OrgTeamPage
      apiPath="/api/factory-portal/team"
      portalLabel="Factory Portal"
      portalHref="/factory-portal"
      inviteRoles={["FACTORY_USER", "FACTORY_MANAGER"]}
      defaultRole="FACTORY_USER"
      entityKey="factory"
    />
  );
}
