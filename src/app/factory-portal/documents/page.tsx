"use client";

import DocumentRepository from "@/components/DocumentRepository";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function FactoryPortalDocumentsPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[{ label: "Factory Portal", href: "/factory-portal" }, { label: "Documents" }]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">Documents</h1>
      <p className="text-sm text-slate-600 mb-6">
        FUZE compliance pack, your brands' protocols, your factory's test
        reports, and your distributor's pricing tiers.
      </p>
      <DocumentRepository apiPath="/api/factory-portal/documents" />
    </div>
  );
}
