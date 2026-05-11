"use client";

import DocumentRepository from "@/components/DocumentRepository";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function LabPortalDocumentsPage() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[{ label: "Lab Portal", href: "/lab-portal" }, { label: "Documents" }]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">Documents</h1>
      <p className="text-sm text-slate-600 mb-6">
        Your lab's accreditation docs, FUZE compliance pack, and protocols for
        brands you're assigned to test.
      </p>
      <DocumentRepository apiPath="/api/lab-portal/documents" />
    </div>
  );
}
