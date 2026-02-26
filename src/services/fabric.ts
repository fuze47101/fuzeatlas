import axios from 'axios';

export async function getFabricById(id: string) {
  const res = await axios.get(`/api/fabrics/${id}`);
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
