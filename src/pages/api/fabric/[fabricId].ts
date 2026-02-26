import { NextApiRequest, NextApiResponse } from 'next';

// Dummy data for demonstration - replace with actual DB or service integration
const FABRICS = [
  {
    id: '1',
    name: 'Atlas Fabric',
    description: 'The primary fabric for Atlas project.'
  },
  {
    id: '2',
    name: 'Omega Fabric',
    description: 'An experimental branch.'
  }
];

const SUBMISSIONS = {
  '1': [
    { id: 'sub-1', createdAt: '2023-12-01T10:00:00Z', author: 'alice' },
    { id: 'sub-2', createdAt: '2024-01-18T15:42:00Z', author: 'bob' }
  ],
  '2': [
    { id: 'sub-3', createdAt: '2024-01-22T09:30:00Z', author: 'carol' }
  ]
};

const TESTS = {
  '1': [
    { id: 'test-1', name: 'Core Functionality', status: 'passed' },
    { id: 'test-2', name: 'Edge Case Coverage', status: 'failed' }
  ],
  '2': [
    { id: 'test-3', name: 'Basic Check', status: 'passed' }
  ]
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fabricId } = req.query;
  const fabric = FABRICS.find(f => f.id === fabricId);

  if (!fabric) {
    res.status(404).json({ error: 'Fabric not found' });
    return;
  }

  res.status(200).json({
    fabric,
    submissions: SUBMISSIONS[fabric.id] || [],
    tests: TESTS[fabric.id] || []
  });
}
