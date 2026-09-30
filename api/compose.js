import { createVideoComposition } from '../server/videoComposerService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'الطريقة غير مسموحة.' });
  const result = await createVideoComposition(req.body || {});
  return res.status(result.status || 500).json(result);
}