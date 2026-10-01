export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'الطريقة غير مسموحة.' });
  }

  try {
    const { createVideoGeneration } = await import('../server/videoService.js');
    const payload = req.body || {};
    const hasProviderUrl = Boolean(process.env.VIDEO_PROVIDER_URL);
    const hasApiKey = Boolean(process.env.VIDEO_PROVIDER_API_KEY);

    console.log('[video-api-diagnostics]', {
      hasProviderUrl,
      hasApiKey,
      model: payload?.model || null,
    });

    const result = await createVideoGeneration(payload);

    console.log('[video-api-result]', {
      status: result?.status || 500,
      message: result?.message || null,
    });

    if (!result.ok) {
      return res.status(result.status || 500).json({
        ok: false,
        message: result.message,
        developerMessage: result.developerMessage || undefined,
      });
    }

    return res.status(200).json({
      ok: true,
      videoUrl: result.videoUrl,
      model: result.model,
      duration: result.duration,
      quality: result.quality,
      aspectRatio: result.aspectRatio,
    });
  } catch (error) {
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
    console.log('[video-api-catch]', {
      message: status === 400 ? error.message : 'Video generation failed',
    });

    return res.status(status).json({
      ok: false,
      message: status === 400 ? error.message : 'حدث خطأ أثناء إنشاء الفيديو. حاول مرة أخرى.',
    });
  }
}
