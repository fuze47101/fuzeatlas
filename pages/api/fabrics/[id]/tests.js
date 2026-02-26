import { getTestsByFabricId } from '../../../../server/data/tests';

export default function handler(req, res) {
  const {
    query: { id },
    method
  } = req;

  if (method === 'GET') {
    const tests = getTestsByFabricId(id);
    res.status(200).json(tests);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}
