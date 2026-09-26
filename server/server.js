import express from 'express';
import { createImageGeneration, getImageJobStatus } from './imageService.js';
import { createScriptGeneration } from './scriptService.js';
import { createVideoGeneration } from './videoService.js';

const app = express();
const PORT = 3001;

app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.post('/api/image', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await createImageGeneration(payload);

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
      message: 'حدث خطأ أثناء إنشاء الصورة. حاول مرة أخرى.',
    });
  }
});

app.get('/api/image/:jobId', async (req, res) => {
  try {
    const result = await getImageJobStatus(req.params.jobId);

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
      jobId: req.params.jobId,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ أثناء التحقق من حالة الصورة.',
    });
  }
});

app.post('/api/script', async (req, res) => {
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
      message: 'حدث خطأ أثناء إنشاء السكريبت. حاول مرة أخرى.',
    });
  }
});

app.post('/api/video', async (req, res) => {
  try {
    const payload = req.body || {};
    const result = await createVideoGeneration(payload);

    if (!result.ok) {
      return res.status(result.status || 500).json({
        ok: false,
        message: result.message,
      });
    }

    return res.json({
      ok: true,
      videoUrl: result.videoUrl,
      model: result.model,
      duration: result.duration,
      quality: result.quality,
      aspectRatio: result.aspectRatio,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'حدث خطأ أثناء إنشاء الفيديو. حاول مرة أخرى.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Video backend running at http://localhost:${PORT}`);
});
