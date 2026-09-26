import { createImageGeneration, getImageJobStatus } from '../server/imageService.js';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const result = await createImageGeneration(req.body || {});

      if (!result.ok) {
        return res.status(result.status || 500).json({
          ok: false,
          message: result.message,
        });
      }

      return res.status(result.status || 200).json({
        ok: true,
        imageUrl: result.imageUrl || null,
        jobId: result.jobId || null,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: 'حدث خطأ أثناء الاتصال بالخدمة.',
      });
    }
  }

  if (req.method === 'GET') {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({
        ok: false,
        message: 'معرّف المهمة غير موجود.',
      });
    }

    try {
      const result = await getImageJobStatus(jobId);

      if (!result.ok) {
        return res.status(result.status || 500).json({
          ok: false,
          message: result.message,
        });
      }

      return res.status(result.status || 200).json({
        ok: true,
        resultStatus: result.resultStatus || 'pending',
        imageUrl: result.imageUrl || null,
        jobId: result.jobId || jobId,
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        message: 'حدث خطأ أثناء التحقق من حالة الصورة.',
      });
    }
  }

  return res.status(405).json({
    ok: false,
    message: 'الطريقة غير مسموحة.',
  });
}
