import OrgTeamPage from "@/components/OrgTeamPage";

export default function LabPortalTeamPage() {
  return (
    <OrgTeamPage
      apiPath="/api/lab-portal/team"
      portalLabel="Lab Portal"
      portalHref="/lab-portal"
      inviteRoles={["LAB_USER"]}
      defaultRole="LAB_USER"
      entityKey="lab"
    />
  );
}
