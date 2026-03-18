"use client";
import { useEffect, useState } from "react";

export default function LabFormsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/lab-portal")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>;
  if (!data) return <div className="flex items-center justify-center h-64 text-red-400">Unable to load</div>;

  const documents = data.documents || [];

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Forms & Documents</h1>
          <p className="text-sm text-slate-500 mt-1">{data.lab.name} — Upload test forms for each service you offer.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        {documents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-2">📄</div>
            <p className="text-sm mb-2">No forms uploaded yet.</p>
            <p className="text-xs text-slate-400">
              Upload your PDF test request forms here. The FUZE team will convert them into digital forms that customers can fill out online.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-semibold text-sm text-slate-900">{doc.title || doc.filename || "Document"}</div>
                  <div className="text-xs text-slate-500">{new Date(doc.createdAt).toLocaleDateString()}</div>
                </div>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener" className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200">
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 bg-[#00b4c3]/5 border border-[#00b4c3]/20 rounded-xl">
          <p className="text-sm text-slate-700">
            <span className="font-bold text-[#00b4c3]">How it works:</span> Upload your PDF test request forms here. The FUZE team will review them and build digital versions that your customers can complete online when they order tests. Contact <a href="mailto:lab@fuzeatlas.com" className="text-[#00b4c3] underline">lab@fuzeatlas.com</a> for questions.
          </p>
        </div>
      </div>
    </div>
  );
}
