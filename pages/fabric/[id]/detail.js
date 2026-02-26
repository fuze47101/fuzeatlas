import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = url => fetch(url).then(res => res.json());

export default function FabricDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data, error } = useSWR(() => id ? `/api/fabrics/${id}` : null, fetcher);
  const { data: submissions } = useSWR(() => id ? `/api/fabrics/${id}/submissions` : null, fetcher);
  const { data: tests } = useSWR(() => id ? `/api/fabrics/${id}/tests` : null, fetcher);

  if (error) return <div>Error loading fabric details</div>;
  if (!data) return <div>Loading fabric details...</div>;

  return (
    <div style={{ padding: 32 }}>
      <h1>Fabric Detail</h1>
      <h2>{data.name}</h2>
      <p>ID: {data.id}</p>
      <p>Description: {data.description}</p>

      <hr />

      <h3>Submissions</h3>
      {submissions && submissions.length > 0 ? (
        <ul>
          {submissions.map(sub => (
            <li key={sub.id}>
              <Link href={`/submissions/${sub.id}`}>{sub.title || sub.id}</Link>
              {sub.status && <span style={{ marginLeft: 8, color: '#888' }}>({sub.status})</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No submissions found.</p>
      )}

      <hr />

      <h3>Linked Tests</h3>
      {tests && tests.length > 0 ? (
        <ul>
          {tests.map(test => (
            <li key={test.id}>
              <Link href={`/tests/${test.id}`}>{test.name || test.id}</Link>
              {test.status && <span style={{ marginLeft: 8, color: '#888' }}>({test.status})</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p>No linked tests found.</p>
      )}
    </div>
  );
}
