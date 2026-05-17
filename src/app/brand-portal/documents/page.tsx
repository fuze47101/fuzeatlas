"use client";

/**
 * /brand-portal/documents — Phase 15 IMP-5.
 *
 * Unified document repository scoped to the caller's brand.
 * Backed by /api/brand-portal/documents which routes through
 * src/lib/document-acl.ts listDocumentsForUser().
 */
import DocumentRepository from "@/components/DocumentRepository";
import Breadcrumbs from "@/components/Breadcrumbs";
import { useI18n } from "@/i18n";

export default function BrandPortalDocumentsPage() {
  const { t } = useI18n();
  const tx = t.brandPortal.documentsPage;
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <Breadcrumbs
        className="mb-2"
        items={[
          { label: t.brandPortal.crumb, href: "/brand-portal" },
          { label: tx.crumbCurrent },
        ]}
      />
      <h1 className="text-2xl font-black text-slate-900 mb-1">{tx.pageTitle}</h1>
      <p className="text-sm text-slate-600 mb-6">{tx.pageSubtitle}</p>
      <DocumentRepository
        apiPath="/api/brand-portal/documents"
        trustPackPath="/api/brand-portal/trust-pack"
      />
    </div>
  );
}
