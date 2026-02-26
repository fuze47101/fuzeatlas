import { getSubmissionsByFabricId } from '../../../../server/data/submissions';

export default function handler(req, res) {
  const {
    query: { id },
    method
  } = req;

  if (method === 'GET') {
    const submissions = getSubmissionsByFabricId(id);
    res.status(200).json(submissions);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${method} Not Allowed`);
  }
}
