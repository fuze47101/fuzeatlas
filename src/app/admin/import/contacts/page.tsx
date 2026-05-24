import BulkImportWizard from "@/components/BulkImportWizard";
import { getServerTranslations } from "@/i18n/server";

export default async function BulkImportContactsPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const sp = (await searchParams) || {};
  const T = (await getServerTranslations(sp.lang)).importContacts;
  return (
    <BulkImportWizard
      config={{
        title: T.title,
        subtitle: T.subtitle,
        apiPath: "/api/admin/import/contacts",
        backHref: "/admin/lead-management",
        backLabel: T.backLabel,
        fields: [
          {
            key: "firstName",
            label: T.firstNameLabel,
            required: true,
          },
          {
            key: "lastName",
            label: T.lastNameLabel,
            required: true,
          },
          {
            key: "email",
            label: T.emailLabel,
            required: false,
            hint: T.emailHint,
          },
          {
            key: "linkedinUrl",
            label: T.linkedinLabel,
            required: false,
            hint: T.linkedinHint,
          },
          {
            key: "brandName",
            label: T.brandNameLabel,
            required: false,
            hint: T.brandNameHint,
          },
          {
            key: "jobTitle",
            label: T.jobTitleLabel,
            required: false,
          },
          {
            key: "phone",
            label: T.phoneLabel,
            required: false,
          },
          {
            key: "title",
            label: T.titleLabel,
            required: false,
            hint: T.titleHint,
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
