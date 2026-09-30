import express from 'express';
import { createImageGeneration, getImageJobStatus } from './imageService.js';
import { createScriptGeneration } from './scriptService.js';
import { createVideoGeneration } from './videoService.js';
import { createMusicGeneration, createVoiceGeneration, getAudioProviderStatuses, getConfiguredVoiceOptions } from './audioService.js';
import { createVideoComposition } from './videoComposerService.js';

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(express.json({ limit: '20mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/api/settings', (_req, res) => {
  res.json({
    ok: true,
    providers: {
      image: process.env.AI_GATEWAY_API_KEY ? 'Connected' : 'Not configured',
      video: process.env.VIDEO_PROVIDER_URL && process.env.VIDEO_PROVIDER_API_KEY ? 'Connected' : 'Not configured',
      script: process.env.SCRIPT_PROVIDER_URL && process.env.SCRIPT_PROVIDER_API_KEY && process.env.SCRIPT_MODEL_ID ? 'Connected' : 'Not configured',
      ...getAudioProviderStatuses(),
    },
    voiceOptions: getConfiguredVoiceOptions(),
    models: {
      image: ['Seedream 5.0 Pro'],
      video: ['Seedance 2.5', 'Seedance 2.0'],
      script: ['النموذج المهيأ على الخادم'],
    },
    defaults: {
      image: { aspectRatio: '1:1', quality: '1.5K' },
      video: { duration: '15s', aspectRatio: '9:16', quality: '720p' },
    },
  });
});

app.post('/api/voice', async (req, res) => {
  const result = await createVoiceGeneration(req.body || {});
  res.status(result.status || 500).json(result);
});

app.post('/api/music', async (req, res) => {
  const result = await createMusicGeneration(req.body || {});
  res.status(result.status || 500).json(result);
});

app.post('/api/compose', async (req, res) => {
  const result = await createVideoComposition(req.body || {});
  res.status(result.status || 500).json(result);
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
