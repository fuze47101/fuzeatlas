// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── SMS/Email Templates ───────────────────────────────
const SMS_TEMPLATES = {
  intro: {
    label: "Intro",
    build: (c: any) =>
      `Hi ${c.firstName || "there"}, this is Andrew from FUZE Biotech. We make an antimicrobial textile treatment — zero binders, zero curing, proven to 100 washes. ${c.brand?.name ? `Reaching out because ${c.brand.name} could benefit.` : ""} Would love 5 min to share how it works. Can I send you a quick overview? -Andrew (877) 386-3608`,
  },
  sustainability: {
    label: "Sustainability",
    build: (c: any) =>
      `Hi ${c.firstName || "there"}, Andrew from FUZE Biotech. Quick question — is ${c.brand?.name || "your team"} tracking chemical reduction in your supply chain? Our antimicrobial eliminates binders, curing energy, and wastewater treatment chemicals. Zero VOCs on application. Happy to share the data. -Andrew (877) 386-3608`,
  },
  competitive: {
    label: "Competitive Displacement",
    build: (c: any) =>
      `Hi ${c.firstName || "there"}, Andrew from FUZE Biotech. If ${c.brand?.name || "you're"} using traditional antimicrobials (zinc pyrithione, quats, silver chloride), we can show you a cleaner alternative — no binders, no curing, no wastewater chemicals, and better wash durability. Free sample available. -Andrew (877) 386-3608`,
  },
  sample_offer: {
    label: "Free Sample",
    build: (c: any) =>
      `Hi ${c.firstName || "there"}, Andrew from FUZE Biotech. We'd like to send ${c.brand?.name || "you"} a complimentary FUZE treatment sample — 19L bottle treats ~1,000 linear meters. No cost, no commitment. Want me to arrange shipping? -Andrew (877) 386-3608`,
  },
  followup: {
    label: "Follow-up",
    build: (c: any) =>
      `Hi ${c.firstName || "there"}, following up from FUZE Biotech. Still happy to send you a free sample or walk through our antimicrobial treatment data. No pressure — just want to make sure it's on your radar. -Andrew (877) 386-3608`,
  },
};

const EMAIL_TEMPLATES = {
  intro: {
    label: "Warm Intro",
    subject: (c: any) => `FUZE Antimicrobial for ${c.brand?.name || "Your Brand"}`,
    build: (c: any) =>
      `Hi ${c.firstName || "there"},\n\nI'm Andrew Peterson, founder of FUZE Biotech. We've developed an antimicrobial textile treatment that's fundamentally different from what's on the market today.\n\nFUZE uses a metamaterial suspended in ultrapure water — no binders, no curing step, no wastewater chemicals. It integrates into existing dyebath, pad-dry-cure, or spray processes and delivers antimicrobial performance proven to 100+ wash cycles.\n\nI'd love to explore whether this could be a fit for ${c.brand?.name || "your product line"}.\n\nWould you be open to a quick call this week?\n\nBest,\nAndrew Peterson\nCEO, FUZE Biotech\n(877) 386-3608\nandrew@fuzebiotech.com`,
  },
  sustainability: {
    label: "Sustainability Angle",
    subject: (c: any) => `Cleaner antimicrobial chemistry for ${c.brand?.name || "your supply chain"}`,
    build: (c: any) =>
      `Hi ${c.firstName || "there"},\n\nQuick question — is ${c.brand?.name || "your team"} tracking chemical inputs and wastewater impact in your textile supply chain?\n\nWe built FUZE specifically to eliminate the worst parts of traditional antimicrobial treatments:\n\n- Zero chemical binders (eliminates formaldehyde-based crosslinkers)\n- Zero curing energy (no 160°C oven step)\n- Zero wastewater treatment chemicals (no caustic soda, no magnesium)\n- Zero VOCs on application\n\nOur metamaterial technology is produced via liquid laser ablation from recycled electronics — solar-capable, minimal waste.\n\nI can send over our environmental impact data if that's useful for your sustainability reporting.\n\nBest,\nAndrew Peterson\nCEO, FUZE Biotech\n(877) 386-3608`,
  },
  sample_offer: {
    label: "Free Sample Offer",
    subject: (c: any) => `Complimentary FUZE sample for ${c.brand?.name || "your team"}`,
    build: (c: any) =>
      `Hi ${c.firstName || "there"},\n\nI'd like to offer ${c.brand?.name || "your team"} a complimentary FUZE antimicrobial treatment sample — a 19L bottle that treats approximately 1,000 linear meters of fabric.\n\nNo cost, no commitment. We just ask that you run it through your standard testing protocol so you can see the performance data firsthand.\n\nFUZE works with three application methods: exhaust (dyebath), pad-dry-cure, or spray — whatever your factories already use.\n\nWant me to arrange shipping?\n\nBest,\nAndrew Peterson\nCEO, FUZE Biotech\n(877) 386-3608`,
  },
};

// ─── Status Colors ─────────────────────────────────────
const OUTREACH_COLORS: Record<string, string> = {
  not_contacted: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-100 text-blue-700",
  responded: "bg-green-100 text-green-700",
  meeting_booked: "bg-purple-100 text-purple-700",
  not_interested: "bg-red-100 text-red-600",
};

const EMAIL_COLORS: Record<string, string> = {
  verified: "bg-green-100 text-green-700",
  extrapolated: "bg-yellow-100 text-yellow-700",
  unavailable: "bg-red-100 text-red-600",
  unknown: "bg-gray-100 text-gray-500",
};

// ─── Main Page ─────────────────────────────────────────
export default function LeadManagementPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [filterOutreach, setFilterOutreach] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterPipeline, setFilterPipeline] = useState("LEAD");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  // Modal state
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendChannel, setSendChannel] = useState<"sms" | "email">("sms");
  const [sendTemplate, setSendTemplate] = useState("intro");
  const [sendBody, setSendBody] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);

  // Enrichment
  const [enriching, setEnriching] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterVertical) params.set("vertical", filterVertical);
    if (filterOutreach) params.set("outreachStatus", filterOutreach);
    if (filterEmail) params.set("emailStatus", filterEmail);
    if (filterPipeline) params.set("pipelineStage", filterPipeline);
    params.set("page", String(page));
    params.set("limit", "50");

    fetch(`/api/admin/outreach?${params}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setBrands(j.brands);
          setStats(j.stats);
          setPagination(j.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [search, filterVertical, filterOutreach, filterEmail, filterPipeline, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open send modal for a contact
  const openSendModal = (contact: any, channel: "sms" | "email") => {
    setSelectedContact(contact);
    setSendChannel(channel);
    setSendTemplate("intro");
    setSendResult(null);

    const templates = channel === "sms" ? SMS_TEMPLATES : EMAIL_TEMPLATES;
    const tmpl = templates.intro;
    setSendBody(tmpl.build(contact));
    if (channel === "email" && "subject" in tmpl) {
      setSendSubject((tmpl as any).subject(contact));
    }
    setShowSendModal(true);
  };

  // Update body when template changes
  const handleTemplateChange = (templateKey: string) => {
    setSendTemplate(templateKey);
    if (!selectedContact) return;

    const templates = sendChannel === "sms" ? SMS_TEMPLATES : EMAIL_TEMPLATES;
    const tmpl = (templates as any)[templateKey];
    if (tmpl) {
      setSendBody(tmpl.build(selectedContact));
      if (sendChannel === "email" && "subject" in tmpl) {
        setSendSubject(tmpl.subject(selectedContact));
      }
    }
  };

  // Send message
  const handleSend = async () => {
    if (!selectedContact) return;
    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/admin/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: selectedContact.id,
          channel: sendChannel,
          template: sendTemplate,
          subject: sendChannel === "email" ? sendSubject : undefined,
          body: sendBody,
        }),
      });
      const data = await res.json();
      setSendResult(data);
      if (data.ok) {
        // Refresh data after successful send
        setTimeout(fetchData, 500);
      }
    } catch (err: any) {
      setSendResult({ ok: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  // Enrich a contact via Apollo
  const handleEnrich = async (contactId: string) => {
    setEnriching((prev) => new Set(prev).add(contactId));
    try {
      const res = await fetch("/api/admin/outreach/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchData(); // Refresh to show enriched data
      } else {
        alert(`Enrichment failed: ${data.error || data.details}`);
      }
    } catch (err: any) {
      alert(`Enrichment error: ${err.message}`);
    } finally {
      setEnriching((prev) => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  // Update outreach status
  const handleStatusChange = async (contactId: string, newStatus: string) => {
    try {
      await fetch(`/api/admin/outreach/contact/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreachStatus: newStatus }),
      });
      fetchData();
    } catch {}
  };

  // Quick action: mark LinkedIn reached or email sent
  const handleOutreachCheck = async (contactId: string, action: "linkedin_reached" | "email_sent") => {
    try {
      await fetch(`/api/admin/outreach/contact/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchData();
    } catch {}
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Lead Management & Outreach</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage contacts, enrich via Apollo, send SMS/email outreach
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <StatCard label="Total Contacts" value={stats.totalContacts} />
          <StatCard label="With Email" value={stats.withEmail} color="text-green-600" />
          <StatCard label="With Phone" value={stats.withPhone} color="text-blue-600" />
          <StatCard label="Enriched" value={stats.enriched} color="text-purple-600" />
          <StatCard label="Not Contacted" value={stats.byOutreachStatus?.not_contacted || 0} color="text-gray-500" />
          <StatCard label="Contacted" value={(stats.byOutreachStatus?.contacted || 0) + (stats.byOutreachStatus?.responded || 0)} color="text-cyan-600" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search brands or contacts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm w-64"
        />
        <select
          value={filterPipeline}
          onChange={(e) => { setFilterPipeline(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Pipeline Stages</option>
          <option value="LEAD">Lead</option>
          <option value="PRESENTATION">Presentation</option>
          <option value="BRAND_TESTING">Brand Testing</option>
          <option value="FACTORY_ONBOARDING">Factory Onboarding</option>
          <option value="PRODUCTION">Production</option>
          <option value="ARCHIVE">Archive</option>
        </select>
        <select
          value={filterVertical}
          onChange={(e) => { setFilterVertical(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Verticals</option>
          <option value="apparel">Apparel</option>
          <option value="hospitality">Hospitality</option>
          <option value="workwear">Workwear</option>
          <option value="home_textiles">Home Textiles</option>
        </select>
        <select
          value={filterOutreach}
          onChange={(e) => { setFilterOutreach(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Outreach Status</option>
          <option value="not_contacted">Not Contacted</option>
          <option value="contacted">Contacted</option>
          <option value="responded">Responded</option>
          <option value="meeting_booked">Meeting Booked</option>
          <option value="not_interested">Not Interested</option>
        </select>
        <select
          value={filterEmail}
          onChange={(e) => { setFilterEmail(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All Email Status</option>
          <option value="verified">Verified</option>
          <option value="extrapolated">Extrapolated</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Brand/Contact Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading leads...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-3 py-3 text-center">LI</th>
                  <th className="px-3 py-3 text-center">Emailed</th>
                  <th className="px-4 py-3">Outreach</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {brands.map((brand) =>
                  brand.contacts.length > 0 ? (
                    brand.contacts.map((contact: any, idx: number) => (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        {idx === 0 && (
                          <td className="px-4 py-3 font-medium align-top" rowSpan={brand.contacts.length}>
                            <Link href={`/brands/${brand.id}`} className="text-blue-600 hover:underline">
                              {brand.name}
                            </Link>
                            <div className="text-xs text-gray-400 mt-1">
                              {brand.pipelineStage?.replace(/_/g, " ")}
                            </div>
                            {brand.salesRep && (
                              <div className="text-xs text-gray-400">{brand.salesRep.name}</div>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="font-medium">
                            {contact.firstName} {contact.lastName}
                            {!contact.firstName && contact.name}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {contact.linkedinUrl && (
                              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#0077B5] text-white rounded text-[10px] font-bold hover:bg-[#006097] transition">
                                in Profile
                              </a>
                            )}
                            {contact.enrichedAt && (
                              <span className="text-xs text-purple-500" title={`Enriched ${new Date(contact.enrichedAt).toLocaleDateString()}`}>
                                enriched
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">
                          {contact.jobTitle || contact.title || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {contact.email ? (
                            <div>
                              <span className="text-xs">{contact.email}</span>
                              {contact.emailStatus && (
                                <span className={`ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${EMAIL_COLORS[contact.emailStatus] || EMAIL_COLORS.unknown}`}>
                                  {contact.emailStatus}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                          {contact.personalEmail && (
                            <div className="text-[10px] text-gray-400 mt-0.5">{contact.personalEmail}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {contact.phone || <span className="text-gray-400">—</span>}
                        </td>
                        {/* LinkedIn Reached Checkbox */}
                        <td className="px-3 py-3 text-center">
                          {contact.linkedinUrl ? (
                            <button
                              onClick={() => {
                                if (contact.outreachCount > 0 && contact.outreachStatus !== "not_contacted") return; // Already marked
                                handleOutreachCheck(contact.id, "linkedin_reached");
                              }}
                              className={`w-6 h-6 rounded border-2 inline-flex items-center justify-center transition ${
                                contact.outreachMessages?.some((m: any) => m.channel === "linkedin") ||
                                (contact.outreachCount > 0 && contact.lastContactedAt)
                                  ? "bg-[#0077B5] border-[#0077B5] text-white"
                                  : "border-gray-300 hover:border-[#0077B5] text-transparent hover:text-[#0077B5]"
                              }`}
                              title={contact.lastContactedAt ? `Reached ${new Date(contact.lastContactedAt).toLocaleDateString()}` : "Mark as LinkedIn reached"}
                            >
                              ✓
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        {/* Email Sent Checkbox */}
                        <td className="px-3 py-3 text-center">
                          {contact.email ? (
                            <button
                              onClick={() => {
                                if (contact.outreachMessages?.some((m: any) => m.channel === "email")) return;
                                handleOutreachCheck(contact.id, "email_sent");
                              }}
                              className={`w-6 h-6 rounded border-2 inline-flex items-center justify-center transition ${
                                contact.outreachMessages?.some((m: any) => m.channel === "email")
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : contact.outreachCount >= 2
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "border-gray-300 hover:border-blue-500 text-transparent hover:text-blue-500"
                              }`}
                              title={contact.outreachMessages?.find((m: any) => m.channel === "email")
                                ? `Emailed ${new Date(contact.outreachMessages.find((m: any) => m.channel === "email").sentAt).toLocaleDateString()}`
                                : "Mark as emailed"}
                            >
                              ✓
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={contact.outreachStatus || "not_contacted"}
                            onChange={(e) => handleStatusChange(contact.id, e.target.value)}
                            className={`text-xs rounded px-2 py-1 border-0 ${OUTREACH_COLORS[contact.outreachStatus || "not_contacted"]}`}
                          >
                            <option value="not_contacted">Not Contacted</option>
                            <option value="contacted">Contacted</option>
                            <option value="responded">Responded</option>
                            <option value="meeting_booked">Meeting Booked</option>
                            <option value="not_interested">Not Interested</option>
                          </select>
                          {contact.outreachCount > 0 && (
                            <div className="text-[10px] text-gray-400 mt-0.5">
                              {contact.outreachCount} msgs
                              {contact.lastContactedAt && ` | ${new Date(contact.lastContactedAt).toLocaleDateString()}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {contact.phone && (
                              <button
                                onClick={() => openSendModal(contact, "sms")}
                                className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs hover:bg-green-100"
                                title="Send SMS"
                              >
                                SMS
                              </button>
                            )}
                            {contact.email && (
                              <button
                                onClick={() => openSendModal(contact, "email")}
                                className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100"
                                title="Send Email"
                              >
                                Email
                              </button>
                            )}
                            {!contact.enrichedAt && (
                              <button
                                onClick={() => handleEnrich(contact.id)}
                                disabled={enriching.has(contact.id)}
                                className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs hover:bg-purple-100 disabled:opacity-50"
                                title="Enrich via Apollo"
                              >
                                {enriching.has(contact.id) ? "..." : "Enrich"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr key={brand.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/brands/${brand.id}`} className="text-blue-600 hover:underline">
                          {brand.name}
                        </Link>
                        <div className="text-xs text-gray-400 mt-1">{brand.pipelineStage?.replace(/_/g, " ")}</div>
                      </td>
                      <td colSpan={8} className="px-4 py-3 text-gray-400 text-xs italic">
                        No contacts — needs enrichment
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <span className="text-xs text-gray-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} brands)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="px-3 py-1 text-xs border rounded disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Send Message Modal */}
      {showSendModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">
                  Send {sendChannel === "sms" ? "SMS" : "Email"} to {selectedContact.firstName} {selectedContact.lastName}
                </h2>
                <button onClick={() => setShowSendModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                  &times;
                </button>
              </div>

              <div className="space-y-4">
                {/* Template selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Template</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sendChannel === "sms" ? SMS_TEMPLATES : EMAIL_TEMPLATES).map(([key, tmpl]) => (
                      <button
                        key={key}
                        onClick={() => handleTemplateChange(key)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          sendTemplate === key
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    To: {sendChannel === "sms" ? selectedContact.phone : selectedContact.email}
                  </label>
                </div>

                {/* Subject (email only) */}
                {sendChannel === "email" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subject</label>
                    <input
                      type="text"
                      value={sendSubject}
                      onChange={(e) => setSendSubject(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}

                {/* Message body */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Message {sendChannel === "sms" && `(${sendBody.length} chars)`}
                  </label>
                  <textarea
                    value={sendBody}
                    onChange={(e) => setSendBody(e.target.value)}
                    rows={sendChannel === "sms" ? 6 : 12}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  />
                </div>

                {/* Result */}
                {sendResult && (
                  <div className={`p-3 rounded-lg text-sm ${sendResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {sendResult.ok ? "Message sent successfully!" : `Error: ${sendResult.error || sendResult.failReason}`}
                  </div>
                )}

                {/* Send button */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSend}
                    disabled={sending || !sendBody}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? "Sending..." : `Send ${sendChannel === "sms" ? "SMS" : "Email"}`}
                  </button>
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card Component ──────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <div className={`text-2xl font-bold ${color || "text-gray-900"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}
