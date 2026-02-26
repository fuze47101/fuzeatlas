import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Submission {
  id: string;
  submittedAt: string;
  user: {
    id: string;
    name: string;
  };
}

interface Test {
  id: string;
  name: string;
  status: string;
}

interface FabricDetail {
  id: string;
  name: string;
  submissions: Submission[];
  tests: Test[];
}

const FabricDetailPage = () => {
  const router = useRouter();
  const { fabricId } = router.query;

  const [fabric, setFabric] = useState<FabricDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fabricId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/fabrics/${fabricId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load fabric data');
        return r.json();
      })
      .then(setFabric)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [fabricId]);

  if (loading) return <div>Loading fabric details...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!fabric) return <div>No fabric found.</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Fabric Details: {fabric.name}</h1>
      <section style={{ marginTop: '2rem' }}>
        <h2>Submissions</h2>
        {fabric.submissions.length === 0 ? (
          <p>No submissions yet.</p>
        ) : (
          <table border={1} cellPadding={8} style={{ width: '100%', marginBottom: '2rem' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Submitted At</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {fabric.submissions.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.user.name}</td>
                  <td>{new Date(s.submittedAt).toLocaleString()}</td>
                  <td><Link href={`/submissions/${s.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h2>Linked Tests</h2>
        {fabric.tests.length === 0 ? (
          <p>No tests linked.</p>
        ) : (
          <table border={1} cellPadding={8} style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {fabric.tests.map(t => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.name}</td>
                  <td>{t.status}</td>
                  <td><Link href={`/tests/${t.id}`}>Details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default FabricDetailPage;
