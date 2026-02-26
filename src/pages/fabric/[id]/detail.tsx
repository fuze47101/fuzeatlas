import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface Submission {
  id: string;
  name: string;
  submittedAt: string;
}

interface Test {
  id: string;
  name: string;
  status: string;
  runAt: string;
}

interface FabricDetail {
  id: string;
  name: string;
  description?: string;
  submissions: Submission[];
  tests: Test[];
}

const fetchFabricDetail = async (id: string): Promise<FabricDetail> => {
  // Replace with a real endpoint or data fetching logic
  // This is mock data
  return {
    id,
    name: `Fabric ${id}`,
    description: `Description for fabric ${id}.`,
    submissions: [
      {
        id: 'sub1',
        name: 'Submission 1',
        submittedAt: '2024-06-14T12:00:00Z'
      },
      {
        id: 'sub2',
        name: 'Submission 2',
        submittedAt: '2024-06-15T09:45:00Z'
      }
    ],
    tests: [
      {
        id: 'test1',
        name: 'Basic Integration Test',
        status: 'PASSED',
        runAt: '2024-06-15T10:10:00Z'
      },
      {
        id: 'test2',
        name: 'Compliance Check',
        status: 'FAILED',
        runAt: '2024-06-15T11:30:00Z'
      }
    ]
  };
};

const FabricDetailPage: React.FC = () => {
  const router = useRouter();
  const { id } = router.query;
  const [fabricDetail, setFabricDetail] = useState<FabricDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof id === 'string') {
      setLoading(true);
      fetchFabricDetail(id).then(detail => {
        setFabricDetail(detail);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading || !fabricDetail) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>{fabricDetail.name}</h1>
      {fabricDetail.description && (
        <p>{fabricDetail.description}</p>
      )}
      <h2>Submissions</h2>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Submitted At</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          {fabricDetail.submissions.length === 0 ? (
            <tr><td colSpan={4}>No submissions found.</td></tr>
          ) : (
            fabricDetail.submissions.map(sub => (
              <tr key={sub.id}>
                <td>{sub.id}</td>
                <td>{sub.name}</td>
                <td>{new Date(sub.submittedAt).toLocaleString()}</td>
                <td><Link href={`/submission/${sub.id}`}>Detail</Link></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <h2>Linked Tests</h2>
      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Status</th>
            <th>Run At</th>
            <th>View</th>
          </tr>
        </thead>
        <tbody>
          {fabricDetail.tests.length === 0 ? (
            <tr><td colSpan={5}>No tests found.</td></tr>
          ) : (
            fabricDetail.tests.map(test => (
              <tr key={test.id}>
                <td>{test.id}</td>
                <td>{test.name}</td>
                <td>{test.status}</td>
                <td>{new Date(test.runAt).toLocaleString()}</td>
                <td><Link href={`/test/${test.id}`}>Detail</Link></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FabricDetailPage;
