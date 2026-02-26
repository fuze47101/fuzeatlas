import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Submission {
  id: string;
  title: string;
  createdAt: string;
}

interface Test {
  id: string;
  name: string;
  submissionId: string;
}

interface FabricDetail {
  id: string;
  name: string;
  description: string;
}

const fetchFabricDetail = async (id: string): Promise<FabricDetail> => {
  const res = await fetch(`/api/fabrics/${id}`);
  if (!res.ok) throw new Error('Failed to fetch fabric detail');
  return res.json();
};

const fetchSubmissions = async (id: string): Promise<Submission[]> => {
  const res = await fetch(`/api/fabrics/${id}/submissions`);
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
};

const fetchTests = async (fabricId: string): Promise<Test[]> => {
  const res = await fetch(`/api/fabrics/${fabricId}/tests`);
  if (!res.ok) throw new Error('Failed to fetch tests');
  return res.json();
};

const FabricDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;

  const [fabric, setFabric] = useState<FabricDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || typeof id !== 'string') return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetchFabricDetail(id),
      fetchSubmissions(id),
      fetchTests(id)
    ])
      .then(([fabricData, submissionsData, testsData]) => {
        setFabric(fabricData);
        setSubmissions(submissionsData);
        setTests(testsData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!fabric) return <div>No fabric data found.</div>;

  return (
    <div style={{ padding: 24 }}>
      <h1>Fabric Detail: {fabric.name}</h1>
      <p>{fabric.description}</p>
      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <div>No submissions yet.</div>
      ) : (
        <ul>
          {submissions.map((sub) => (
            <li key={sub.id} style={{ marginBottom: 12 }}>
              <strong>{sub.title}</strong> <span style={{ color: '#888' }}>({new Date(sub.createdAt).toLocaleString()})</span>
              <div style={{ marginLeft: 24 }}>
                <span>Linked Tests:</span>
                <ul>
                  {tests.filter((t) => t.submissionId === sub.id).length === 0 ? (
                    <li>No linked tests.</li>
                  ) : (
                    tests
                      .filter((t) => t.submissionId === sub.id)
                      .map((t) => (
                        <li key={t.id}>
                          <Link href={`/tests/${t.id}`} legacyBehavior><a>{t.name}</a></Link>
                        </li>
                      ))
                  )}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FabricDetailPage;
