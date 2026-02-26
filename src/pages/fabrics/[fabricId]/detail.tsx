import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Submission {
  id: string;
  name: string;
  createdAt: string;
}

interface Test {
  id: string;
  name: string;
  status: string;
}

const FabricDetailPage: React.FC = () => {
  const router = useRouter();
  const { fabricId } = router.query;
  const [fabricName, setFabricName] = useState<string>('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!fabricId) return;
    setLoading(true);
    const fetchData = async () => {
      try {
        const [fabricRes, submissionsRes, testsRes] = await Promise.all([
          fetch(`/api/fabrics/${fabricId}`),
          fetch(`/api/fabrics/${fabricId}/submissions`),
          fetch(`/api/fabrics/${fabricId}/tests`)
        ]);
        const fabricData = await fabricRes.json();
        const submissionsData = await submissionsRes.json();
        const testsData = await testsRes.json();

        setFabricName(fabricData.name || '');
        setSubmissions(submissionsData || []);
        setTests(testsData || []);
        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };
    fetchData();
  }, [fabricId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Fabric Detail: {fabricName}</h1>
      <section style={{ marginTop: 32 }}>
        <h2>Submissions</h2>
        {submissions.length === 0 ? (
          <div>No submissions found.</div>
        ) : (
          <ul>
            {submissions.map((submission) => (
              <li key={submission.id}>
                <Link href={`/submissions/${submission.id}`}>{submission.name}</Link>
                <span style={{ marginLeft: 8, color: '#888' }}>
                  (created {new Date(submission.createdAt).toLocaleString()})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section style={{ marginTop: 32 }}>
        <h2>Linked Tests</h2>
        {tests.length === 0 ? (
          <div>No tests linked to this fabric.</div>
        ) : (
          <ul>
            {tests.map((test) => (
              <li key={test.id}>
                <Link href={`/tests/${test.id}`}>{test.name}</Link>
                <span style={{ marginLeft: 8, color: '#888' }}>
                  (status: {test.status})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default FabricDetailPage;
