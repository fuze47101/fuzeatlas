import ActivityLogPage from "@/components/ActivityLogPage";

export default function BrandPortalActivityLogPage() {
  return (
    <ActivityLogPage
      apiPath="/api/brand-portal/activity-log"
      portalLabel="Brand Portal"
      portalHref="/brand-portal"
    />
  );
}
