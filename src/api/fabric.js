export async function fetchFabricById(fabricId) {
  const res = await fetch(`/api/fabrics/${fabricId}`);
  if (!res.ok) throw new Error('Failed to fetch fabric');
  return res.json();
}
