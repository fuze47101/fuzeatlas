import BulkImportWizard from "@/components/BulkImportWizard";

export default function BulkImportBrandsPage() {
  return (
    <BulkImportWizard
      config={{
        title: "Bulk import — Brands",
        subtitle:
          "Paste or upload a CSV of brand candidates from a trade show, list, or research dump. We'll map the columns, preview validation, and write idempotently through the same seed-brand helper the CLI uses.",
        apiPath: "/api/admin/import/brands",
        backHref: "/admin/brand-pipeline",
        backLabel: "Brand Pipeline",
        fields: [
          {
            key: "name",
            label: "Brand name",
            required: true,
            hint: "(natural key — upsert is keyed here)",
          },
          {
            key: "domain",
            label: "Email domain",
            required: true,
            hint: 'e.g. "rhone.com"',
          },
          {
            key: "repEmail",
            label: "Primary AM email",
            required: true,
            hint: "must already exist as an Atlas user",
          },
          {
            key: "tier",
            label: "Required FUZE tier",
            required: false,
            hint: "F1 / F2 / F3 / F4 — defaults F2",
          },
          {
            key: "cadenceBatches",
            label: "ICP cadence (every N batches)",
            required: false,
            hint: "defaults 5",
          },
          {
            key: "country",
            label: "Country",
            required: false,
          },
          {
            key: "website",
            label: "Website",
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
