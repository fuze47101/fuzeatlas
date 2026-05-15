import BulkImportWizard from "@/components/BulkImportWizard";

export default function BulkImportContactsPage() {
  return (
    <BulkImportWizard
      config={{
        title: "Bulk import — Contacts",
        subtitle:
          "Paste or upload a CSV of contacts. Email is the natural key — we upsert by email when present. Rows with no email but a LinkedIn URL are imported as 'email missing' so the existing Apollo enrichment job can chase them. Rows with neither are rejected.",
        apiPath: "/api/admin/import/contacts",
        backHref: "/admin/lead-management",
        backLabel: "Lead Management",
        fields: [
          {
            key: "firstName",
            label: "First name",
            required: true,
          },
          {
            key: "lastName",
            label: "Last name",
            required: true,
          },
          {
            key: "email",
            label: "Email",
            required: false,
            hint: "required if no LinkedIn URL",
          },
          {
            key: "linkedinUrl",
            label: "LinkedIn URL",
            required: false,
            hint: "fallback identifier when email missing",
          },
          {
            key: "brandName",
            label: "Brand name",
            required: false,
            hint: "case-insensitive match on Brand.name; unlinked if not found",
          },
          {
            key: "jobTitle",
            label: "Job title",
            required: false,
          },
          {
            key: "phone",
            label: "Phone",
            required: false,
          },
          {
            key: "title",
            label: "Title (honorific)",
            required: false,
            hint: 'e.g. "Mr.", "Dr."',
          },
        ],
        csvSample: `firstName,lastName,email,brandName,jobTitle,linkedinUrl
Nicole,McCasey,nicole@nike.com,Nike,VP Sourcing,https://linkedin.com/in/nicolemccasey
Alec,Miller,alec@hurricanevc.com,Hurricane Ventures,President,
Wei,Chen,,Penfabric,Quality Manager,https://linkedin.com/in/wei-chen-penfabric`,
      }}
    />
  );
}
