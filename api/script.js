import { createScriptGeneration } from '../server/scriptService.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'الطريقة غير مسموحة.' });
  }

  try {
    const payload = req.body || {};
    const result = await createScriptGeneration(payload);

    if (!result.ok) {
      return res.status(result.status || 500).json({
        ok: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      ok: true,
      script: result.script,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ أثناء إنشاء السكريبت.',
    });
  }
}
