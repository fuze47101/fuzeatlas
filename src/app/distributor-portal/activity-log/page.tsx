import ActivityLogPage from "@/components/ActivityLogPage";

export default function DistributorPortalActivityLogPage() {
  return (
    <ActivityLogPage
      apiPath="/api/distributor-portal/activity-log"
      portalLabel="Distributor Portal"
      portalHref="/distributor-portal"
    />
  );
}
