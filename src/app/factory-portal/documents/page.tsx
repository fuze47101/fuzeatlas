"use client";

import DocumentRepository from "@/components/DocumentRepository";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useI18n } from "@/i18n";

export default function FactoryPortalDocumentsPage() {
  const { t } = useI18n();
  const tx = t.factoryPortal.documentsPage;
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[
          { label: t.factoryPortal.crumb, href: "/factory-portal" },
          { label: tx.crumbCurrent },
        ]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">{tx.pageTitle}</h1>
      <p className="text-sm text-slate-600 mb-6">{tx.pageSubtitle}</p>
      <DocumentRepository apiPath="/api/factory-portal/documents" />
    </div>
  );
}
