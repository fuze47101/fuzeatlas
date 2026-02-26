import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Submission {
  id: string;
  createdAt: string;
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
  description: string;
}

const fetchFabricDetail = async (id: string): Promise<FabricDetail> => {
  // Stub: Replace with your API fetch implementation
  return {
    id,
    name: `Fabric #${id}`,
    description: 'Description for fabric',
  };
};

const fetchSubmissions = async (fabricId: string): Promise<Submission[]> => {
  // Stub: Replace with your API fetch implementation
  return [
    {
      id: 'sub1',
      createdAt: '2024-05-12T10:00:00Z',
      user: { id: 'user1', name: 'Alice Bond' },
    },
    {
      id: 'sub2',
      createdAt: '2024-06-04T18:15:00Z',
      user: { id: 'user2', name: 'Clive Atlas' },
    }
  ];
};

const fetchFabricTests = async (fabricId: string): Promise<Test[]> => {
  // Stub: Replace with your API fetch implementation
  return [
    { id: 'test1', name: 'Integration Test 1', status: 'passed' },
    { id: 'test2', name: 'Load Test Alpha', status: 'failed' }
  ];
};

const FabricDetailPage: React.FC = () => {
  const router = useRouter();
  const { fabricId } = router.query;

  const [detail, setDetail] = useState<FabricDetail | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof fabricId === 'string') {
      setLoading(true);
      Promise.all([
        fetchFabricDetail(fabricId),
        fetchSubmissions(fabricId),
        fetchFabricTests(fabricId)
      ]).then(([fDetail, fSubs, fTests]) => {
        setDetail(fDetail);
        setSubmissions(fSubs);
        setTests(fTests);
        setLoading(false);
      })
    }
  }, [fabricId]);

  if (!fabricId || loading) {
    return <div>Loading...</div>;
  }

  if (!detail) {
    return <div>No fabric data found.</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Fabric Detail: {detail.name}</h1>
      <p>{detail.description}</p>

      <h2>Submissions</h2>
      <ul>
        {submissions.length === 0 && <li>No submissions yet.</li>}
        {submissions.map(sub => (
          <li key={sub.id}>
            <Link href={`/submission/${sub.id}`}><a>Submission {sub.id}</a></Link> by {sub.user.name} on {new Date(sub.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>

      <h2>Linked Tests</h2>
      <ul>
        {tests.length === 0 && <li>No tests linked to this fabric.</li>}
        {tests.map(test => (
          <li key={test.id}>
            <Link href={`/tests/${test.id}`}><a>{test.name}</a></Link> - <b>{test.status}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FabricDetailPage;
