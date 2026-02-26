import axios from 'axios';

export const getFabricDetail = async (fabricId: string) => {
  const { data } = await axios.get(`/api/fabrics/${fabricId}`);
  return data;
};

export const getFabricSubmissions = async (fabricId: string) => {
  const { data } = await axios.get(`/api/fabrics/${fabricId}/submissions`);
  return data;
};

export const getFabricTests = async (fabricId: string) => {
  const { data } = await axios.get(`/api/fabrics/${fabricId}/tests`);
  return data;
};
