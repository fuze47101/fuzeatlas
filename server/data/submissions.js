const submissions = [
  {
    id: 's1',
    fabricId: '1',
    title: 'Submission Alpha',
    status: 'approved'
  },
  {
    id: 's2',
    fabricId: '1',
    title: 'Submission Beta',
    status: 'pending'
  },
  {
    id: 's3',
    fabricId: '2',
    title: 'Submission Gamma',
    status: 'rejected'
  }
];

export function getSubmissionsByFabricId(fabricId) {
  return submissions.filter(sub => sub.fabricId === fabricId);
}
