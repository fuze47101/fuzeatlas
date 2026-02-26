const fabrics = [
  {
    id: '1',
    name: 'Cotton Twill',
    description: 'A sturdy cotton fabric, ideal for pants and jackets.'
  },
  {
    id: '2',
    name: 'Linen',
    description: 'A lightweight, breathable fabric made from flax.'
  }
];

export function getFabricById(id) {
  return fabrics.find(fabric => fabric.id === id);
}
