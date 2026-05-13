import ActivityLogPage from "@/components/ActivityLogPage";

export default function FactoryPortalActivityLogPage() {
  return (
    <ActivityLogPage
      apiPath="/api/factory-portal/activity-log"
      portalLabel="Factory Portal"
      portalHref="/factory-portal"
    />
  );
}
