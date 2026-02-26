import type { NextApiRequest, NextApiResponse } from 'next';

// Fake in-memory store - replace with real backend/DB lookup
const FAKE_FABRICS: Record<string, any> = {
  'f001': {
    id: 'f001',
    name: 'Atlas Fabric Alpha',
    submissions: [
      { id: 's100', submittedAt: '2024-06-01T18:22:00Z', user: { id: 'u1', name: 'Alice' } },
      { id: 's101', submittedAt: '2024-06-05T10:10:00Z', user: { id: 'u2', name: 'Bob' } },
    ],
    tests: [
      { id: 't200', name: 'Durability Test', status: 'passed' },
      { id: 't202', name: 'Shrinkage Test', status: 'pending' },
    ],
  },
  'f002': {
    id: 'f002',
    name: 'Beta Fabric',
    submissions: [],
    tests: [],
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fabricId } = req.query;
  if (typeof fabricId !== 'string') return res.status(400).json({ error: 'Invalid fabricId' });
  const fabric = FAKE_FABRICS[fabricId];
  if (!fabric) return res.status(404).json({ error: 'Fabric not found' });
  res.status(200).json(fabric);
}
