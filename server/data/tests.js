const tests = [
  {
    id: 't1',
    fabricId: '1',
    name: 'Martindale Abrasion',
    status: 'passed'
  },
  {
    id: 't2',
    fabricId: '1',
    name: 'Colourfastness',
    status: 'failed'
  },
  {
    id: 't3',
    fabricId: '2',
    name: 'Tear Strength',
    status: 'pending'
  }
];

export function getTestsByFabricId(fabricId) {
  return tests.filter(test => test.fabricId === fabricId);
}
