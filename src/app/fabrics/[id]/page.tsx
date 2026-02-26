"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function FabricDetailPage() {
  const { id } = useParams();
  const [fabric, setFabric] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(0);
  
  useEffect(() => {
    fetch(`/api/fabrics`)
      .then(res => res.json())
      .then(data => {
        const f = data.fabrics.find((f: any) => f.id === id);
        setFabric(f);
        setSubmissions(f?.submissions || []);
      });
  }, [id, refreshFlag]);

  async function handleAddSubmission(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fabricId: id, notes })
    });
    setLoading(false);
    if (res.ok) {
      setNotes('');
      setRefreshFlag(f => f + 1);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to add submission.');
    }
  }

  if (!fabric) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">{fabric.name}</h1>
        <div className="mb-4 text-gray-700">{fabric.description}</div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Submissions</h2>
        <ul className="space-y-2 mb-4">
          {submissions.length > 0 ? (
            submissions.map((s: any) => (
              <li key={s.id} className="border p-2 rounded">
                <div className="text-gray-800">{s.notes}</div>
                <div className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleString()}</div>
              </li>
            ))
          ) : (
            <li className="text-gray-500">No submissions yet.</li>
          )}
        </ul>
        <form onSubmit={handleAddSubmission} className="space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add notes..."
            minLength={2}
            required
            className="border px-2 py-1 w-full"
          />
          {error && <div className="text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            {loading ? 'Adding...' : 'Add Submission'}
          </button>
        </form>
      </div>
    </div>
  );
}
