import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface Submission {
  id: string;
  name: string;
  createdAt: string;
}

interface Test {
  id: string;
  title: string;
  result: string;
  submissionId: string;
}

interface Fabric {
  id: string;
  name: string;
  description: string;
}

const FabricDetailPage: React.FC = () => {
  const { fabricId } = useParams<{ fabricId: string }>();
  const [fabric, setFabric] = useState<Fabric | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/fabrics/${fabricId}`).then(r => r.json()),
      fetch(`/api/fabrics/${fabricId}/submissions`).then(r => r.json()),
      fetch(`/api/fabrics/${fabricId}/tests`).then(r => r.json())
    ])
      .then(([fabricData, submissionsData, testsData]) => {
        setFabric(fabricData);
        setSubmissions(Array.isArray(submissionsData) ? submissionsData : []);
        setTests(Array.isArray(testsData) ? testsData : []);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load fabric details');
        setLoading(false);
      });
  }, [fabricId]);

  if (loading) return <div>Loading fabric details...</div>;
  if (error) return <div>{error}</div>;
  if (!fabric) return <div>Fabric not found.</div>;

  return (
    <div style={{padding: '2em'}}>
      <h1>Fabric: {fabric.name}</h1>
      <p>{fabric.description}</p>
      <h2>Submissions</h2>
      {submissions.length === 0 ? (
        <div>No submissions found.</div>
      ) : (
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Created At</th>
              <th>Tests</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map(sub => (
              <tr key={sub.id} style={{borderBottom: '1px solid #ccc'}}>
                <td>{sub.id}</td>
                <td>{sub.name}</td>
                <td>{new Date(sub.createdAt).toLocaleString()}</td>
                <td>
                  {tests.filter(test => test.submissionId === sub.id).length === 0 ? (
                    <span>No tests</span>
                  ) : (
                    <ul>
                      {tests.filter(test => test.submissionId === sub.id).map(test => (
                        <li key={test.id}>
                          <Link to={`/tests/${test.id}`}>{test.title}</Link> - {test.result}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FabricDetailPage;
