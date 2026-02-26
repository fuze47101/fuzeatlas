import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface Submission {
  id: string;
  title: string;
  submittedAt: string;
}

interface Test {
  id: string;
  name: string;
  status: string;
}

interface FabricDetailData {
  id: string;
  name: string;
  description: string;
}

const FabricDetail: React.FC = () => {
  const { fabricId } = useParams<{ fabricId: string }>();
  const [fabric, setFabric] = useState<FabricDetailData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    async function fetchData() {
      try {
        // Fetch fabric detail
        const fabricRes = await fetch(`/api/fabrics/${fabricId}`);
        if (!fabricRes.ok) throw new Error('Failed to fetch fabric.');
        const fabricData = await fabricRes.json();
        setFabric(fabricData);

        // Fetch submissions
        const submissionsRes = await fetch(`/api/fabrics/${fabricId}/submissions`);
        if (!submissionsRes.ok) throw new Error('Failed to fetch submissions.');
        const submissionsData = await submissionsRes.json();
        setSubmissions(submissionsData);

        // Fetch tests
        const testsRes = await fetch(`/api/fabrics/${fabricId}/tests`);
        if (!testsRes.ok) throw new Error('Failed to fetch tests.');
        const testsData = await testsRes.json();
        setTests(testsData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [fabricId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!fabric) return <div>Fabric not found.</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h1>{fabric.name}</h1>
      <p>{fabric.description}</p>
      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <p>No submissions found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Title</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Submitted At</th>
              <th style={{ borderBottom: '1px solid #ccc' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td>{s.title}</td>
                <td>{new Date(s.submittedAt).toLocaleString()}</td>
                <td>
                  <Link to={`/submissions/${s.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h2 style={{ marginTop: 40 }}>Linked Tests</h2>
      {tests.length === 0 ? (
        <p>No tests linked.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc' }}>Status</th>
              <th style={{ borderBottom: '1px solid #ccc' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.status}</td>
                <td>
                  <Link to={`/tests/${t.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FabricDetail;
