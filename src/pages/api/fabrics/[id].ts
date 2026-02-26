import { NextApiRequest, NextApiResponse } from 'next';

// Dummy data for illustration
const fabrics = [
  {
    id: '1',
    name: 'Atlas Fabric Alpha',
    submissions: [
      { id: 's1', name: 'Submission 1', submittedAt: '2024-06-02T12:11:00Z' },
      { id: 's2', name: 'Submission 2', submittedAt: '2024-06-01T09:33:00Z' },
    ],
    tests: [
      { id: 't1', title: 'Color Fastness Test'},
      { id: 't2', title: 'Strength Test'},
    ]
  },
  {
    id: '2',
    name: 'Atlas Fabric Beta',
    submissions: [
      { id: 's3', name: 'Submission 3', submittedAt: '2024-06-03T17:01:00Z' }
    ],
    tests: []
  },
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const fabric = fabrics.find(f => f.id === id);
  if (!fabric) {
    return res.status(404).json({ error: 'Not found' });
  }
  return res.status(200).json(fabric);
}
