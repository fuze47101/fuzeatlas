import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

const FabricDetailPage = () => {
  const { fabricId } = useParams();
  const [fabric, setFabric] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFabricData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [fabricRes, submissionsRes, testsRes] = await Promise.all([
          axios.get(`/api/fabrics/${fabricId}`),
          axios.get(`/api/fabrics/${fabricId}/submissions`),
          axios.get(`/api/fabrics/${fabricId}/tests`)
        ]);
        setFabric(fabricRes.data);
        setSubmissions(submissionsRes.data);
        setTests(testsRes.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load fabric details');
      } finally {
        setLoading(false);
      }
    };
    fetchFabricData();
  }, [fabricId]);

  if (loading) return <div>Loading fabric details...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!fabric) return <div>Fabric not found.</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Fabric: {fabric.name}</h1>
      <div style={{ marginBottom: '2rem' }}>
        <h2>Info</h2>
        <ul>
          <li><strong>ID:</strong> {fabric.id}</li>
          <li><strong>Description:</strong> {fabric.description || 'N/A'}</li>
          <li><strong>Created:</strong> {fabric.createdAt ? new Date(fabric.createdAt).toLocaleString() : 'N/A'}</li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>Submissions</h2>
        {submissions.length === 0 ? (
          <div>No submissions yet.</div>
        ) : (
          <table border="1" cellPadding="6" cellSpacing="0" width="100%">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Date</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <tr key={sub.id}>
                  <td>{sub.id}</td>
                  <td>{sub.user?.name || 'Unknown'}</td>
                  <td>{sub.createdAt ? new Date(sub.createdAt).toLocaleString() : 'N/A'}</td>
                  <td><Link to={`/submissions/${sub.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h2>Linked Tests</h2>
        {tests.length === 0 ? (
          <div>No tests linked to this fabric.</div>
        ) : (
          <table border="1" cellPadding="6" cellSpacing="0" width="100%">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {tests.map(test => (
                <tr key={test.id}>
                  <td>{test.id}</td>
                  <td>{test.name}</td>
                  <td>{test.status}</td>
                  <td><Link to={`/tests/${test.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FabricDetailPage;
