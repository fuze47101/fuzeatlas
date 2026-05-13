import ActivityLogPage from "@/components/ActivityLogPage";

export default function LabPortalActivityLogPage() {
  return (
    <ActivityLogPage
      apiPath="/api/lab-portal/activity-log"
      portalLabel="Lab Portal"
      portalHref="/lab-portal"
    />
  );
}
