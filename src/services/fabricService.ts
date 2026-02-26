import axios from 'axios';

export async function fetchFabricDetail(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}`);
  return res.data;
}

export async function fetchSubmissionsForFabric(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}/submissions`);
  return res.data;
}

export async function fetchTestsForFabric(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}/tests`);
  return res.data;
}
