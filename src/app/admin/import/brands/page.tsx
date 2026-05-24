import BulkImportWizard from "@/components/BulkImportWizard";
import { getServerTranslations } from "@/i18n/server";

export default async function BulkImportBrandsPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).importBrands;
  return (
    <BulkImportWizard
      config={{
        title: T.title,
        subtitle: T.subtitle,
        apiPath: "/api/admin/import/brands",
        backHref: "/admin/brand-pipeline",
        backLabel: T.backLabel,
        fields: [
          {
            key: "name",
            label: T.brandNameLabel,
            required: true,
            hint: T.brandNameHint,
          },
          {
            key: "domain",
            label: T.domainLabel,
            required: true,
            hint: T.domainHint,
          },
          {
            key: "repEmail",
            label: T.repEmailLabel,
            required: true,
            hint: T.repEmailHint,
          },
          {
            key: "tier",
            label: T.tierLabel,
            required: false,
            hint: T.tierHint,
          },
          {
            key: "cadenceBatches",
            label: T.cadenceLabel,
            required: false,
            hint: T.cadenceHint,
          },
          {
            key: "country",
            label: T.countryLabel,
            required: false,
          },
          {
            key: "website",
            label: T.websiteLabel,
            required: false,
          },
        ],
        csvSample: `name,domain,repEmail,tier,country
Rhone,rhone.com,barth@fuze47.com,F2,USA
KUIU,kuiu.com,barth@fuze47.com,F1,USA
Lululemon,lululemon.com,andrew@fuze47.com,F2,Canada`,
      }}
    />
  );
}
