"use client";

import DocumentRepository from "@/components/DocumentRepository";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function AdminDocumentsPage() {
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[{ label: "Admin", href: "/admin" }, { label: "Documents" }]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">Document repository</h1>
      <p className="text-sm text-slate-600 mb-6">
        Every document Atlas knows about. Use the search + category tabs to
        narrow down.
      </p>
      <DocumentRepository apiPath="/api/admin/documents-unified" />
    </div>
  );
}
