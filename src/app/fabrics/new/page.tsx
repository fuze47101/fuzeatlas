"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewFabricPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/fabrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, submission: { notes } })
    });
    setLoading(false);
    if (res.ok) {
      const { fabric } = await res.json();
      router.push(`/fabrics/${fabric.id}`);
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create fabric.');
    }
  }

  return (
    <div className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Create New Fabric</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Name *</label>
          <input
            className="border px-2 py-1 w-full"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea
            className="border px-2 py-1 w-full"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">First Submission Notes *</label>
          <textarea
            className="border px-2 py-1 w-full"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            required
            minLength={2}
          />
        </div>
        {error && <div className="text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {loading ? 'Creating...' : 'Create Fabric'}
        </button>
      </form>
    </div>
  );
}
