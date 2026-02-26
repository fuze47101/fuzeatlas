import axios from 'axios';

export async function getFabricDetail(fabricId: string) {
  const res = await axios.get(`/api/fabrics/${fabricId}`);
  return res.data;
}
