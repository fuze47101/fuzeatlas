import BulkImportWizard from "@/components/BulkImportWizard";

export default function BulkImportFactoriesPage() {
  return (
    <BulkImportWizard
      config={{
        title: "Bulk import — Factories",
        subtitle:
          "Paste or upload a CSV of factories. We'll upsert by name (natural key), link to a distributor if you give one, and stamp SupplyChainLink rows for each brand that already exists in Atlas. Brands that don't exist yet are reported as 'missing' so you can run a brand import first.",
        apiPath: "/api/admin/import/factories",
        backHref: "/factories",
        backLabel: "Factories",
        fields: [
          {
            key: "name",
            label: "Factory name",
            required: true,
            hint: "(natural key — upsert is keyed here)",
          },
          {
            key: "country",
            label: "Country",
            required: true,
          },
          {
            key: "distributor",
            label: "Distributor",
            required: false,
            hint: "case-insensitive match on Distributor.name; skipped if not found",
          },
          {
            key: "brands",
            label: "Brands",
            required: false,
            hint: "comma-separated; each name must exist as a Brand",
          },
          {
            key: "city",
            label: "City",
            required: false,
          },
          {
            key: "website",
            label: "Website",
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
