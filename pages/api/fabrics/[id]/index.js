import { getFabricById } from '../../../../server/data/fabrics';

export default function handler(req, res) {
  const {
    query: { id },
    method
  } = req;

  if (method === 'GET') {
    const fabric = getFabricById(id);
    if (!fabric)
      return res.status(404).json({ error: 'Fabric not found' });
    res.status(200).json(fabric);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}
