import BulkImportWizard from "@/components/BulkImportWizard";
import { getServerTranslations } from "@/i18n/server";

export default async function BulkImportFactoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).importFactories;
  return (
    <BulkImportWizard
      config={{
        title: T.title,
        subtitle: T.subtitle,
        apiPath: "/api/admin/import/factories",
        backHref: "/factories",
        backLabel: T.backLabel,
        fields: [
          {
            key: "name",
            label: T.factoryNameLabel,
            required: true,
            hint: T.factoryNameHint,
          },
          {
            key: "country",
            label: T.countryLabel,
            required: true,
          },
          {
            key: "distributor",
            label: T.distributorLabel,
            required: false,
            hint: T.distributorHint,
          },
          {
            key: "brands",
            label: T.brandsLabel,
            required: false,
            hint: T.brandsHint,
          },
          {
            key: "city",
            label: T.cityLabel,
            required: false,
          },
          {
            key: "website",
            label: T.websiteLabel,
            required: false,
          },
        ],
        csvSample: `name,country,distributor,brands,city
Penfabric Sdn. Bhd.,Malaysia,Harris & Menuk,"KUIU,Rhone",Penang
Welspun India,India,Harris & Menuk,"Welspun,KUIU",Anjar
Honghao Chemical,China,Global Shine,"Lululemon",Shanghai`,
      }}
    />
  );
}
