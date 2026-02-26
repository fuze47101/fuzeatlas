import axios from 'axios';

export async function getFabricDetail(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}`);
  return res.data;
}

export async function getFabricSubmissions(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}/submissions`);
  return res.data;
}

export async function getFabricTests(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}/tests`);
  return res.data;
}
