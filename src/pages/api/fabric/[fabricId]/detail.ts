import { NextApiRequest, NextApiResponse } from 'next';

// Mock/fake storage functions -- replace with actual data source
const mockSubmissions = [
  { id: 'sub-001', name: 'Initial Submission', createdAt: '2024-05-15T12:10:00Z', fabricId: 'fabric-100' },
  { id: 'sub-002', name: 'Update 1', createdAt: '2024-06-02T11:21:00Z', fabricId: 'fabric-100' }
];

const mockTests = [
  { id: 'test-001', title: 'Durability Test', status: 'Passed', fabricId: 'fabric-100' },
  { id: 'test-002', title: 'Stretch Test', status: 'Pending', fabricId: 'fabric-100' }
];

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { fabricId } = req.query;

  // In real logic, filter from database by fabricId
  const submissions = mockSubmissions.filter(s => s.fabricId === fabricId);
  const tests = mockTests.filter(t => t.fabricId === fabricId);

  res.status(200).json({ submissions, tests });
}
