import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchFabricDetail, fetchSubmissionsForFabric, fetchTestsForFabric } from '../../services/fabricService';

interface Submission {
  id: string;
  title: string;
  submittedBy: string;
  submittedAt: string;
}

interface Test {
  id: string;
  name: string;
  status: string;
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [fabricData, submissionsData, testsData] = await Promise.all([
        fetchFabricDetail(fabricId!),
        fetchSubmissionsForFabric(fabricId!),
        fetchTestsForFabric(fabricId!),
      ]);
      setFabric(fabricData);
      setSubmissions(submissionsData);
      setTests(testsData);
      setLoading(false);
    };
    if (fabricId) {
      load();
    }
  }, [fabricId]);

  if (loading) return <div>Loading...</div>;
  if (!fabric) return <div>Fabric not found</div>;

  return (
    <div>
      <h1>Fabric: {fabric.name}</h1>
      <p>{fabric.description}</p>

      <section>
        <h2>Submissions</h2>
        {submissions.length === 0 ? (
          <div>No submissions found.</div>
        ) : (
          <ul>
            {submissions.map((submission) => (
              <li key={submission.id}>
                <Link to={`/submissions/${submission.id}`}>{submission.title}</Link>
                {' '}by {submission.submittedBy} at {new Date(submission.submittedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Linked Tests</h2>
        {tests.length === 0 ? (
          <div>No tests linked.</div>
        ) : (
          <ul>
            {tests.map((test) => (
              <li key={test.id}>
                <Link to={`/tests/${test.id}`}>{test.name}</Link> - {test.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default FabricDetailPage;
