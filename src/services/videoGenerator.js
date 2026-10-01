export async function generateVideo(payload = {}, onStatus = () => {}) {
  const { prompt, mode, model, duration, quality, aspectRatio } = payload;
  const durationSeconds = Number(typeof duration === 'string' ? duration.replace(/s$/i, '') : duration);
  const supportedDurations = new Set([4, 5, 6, 8, 10, 12, 15, 20, 25, 30]);
  const supportedAspectRatios = new Set(['9:16', '16:9', '1:1']);
  const supportedQualities = new Set(['480p', '720p']);
  const referenceImage = payload.referenceImage || null;

  if (!prompt?.trim() && mode !== 'image') {
    return {
      status: 'error',
      error: 'يرجى كتابة وصف الفيديو.',
      result: null,
    };
  }

  if (!model) {
    return {
      status: 'error',
      error: 'يرجى اختيار موديل.',
      result: null,
    };
  }

  if (!supportedDurations.has(durationSeconds) || !supportedQualities.has(quality) || !supportedAspectRatios.has(aspectRatio)) {
    return {
      status: 'error',
      error: 'المدة أو الجودة أو المقاس المختار غير مدعوم من إعداد Seedance الحالي.',
      result: null,
    };
  }

  if (referenceImage && (!/^data:image\/(?:jpeg|png|webp);base64,/.test(referenceImage) || referenceImage.length > 4 * 1024 * 1024 + 128)) {
    return {
      status: 'error',
      error: 'الصورة المرجعية غير صالحة أو تتجاوز حد 3 ميجابايت.',
      result: null,
    };
  }

  onStatus('preparing');
  try {
    onStatus('generating');
    const response = await fetch('/api/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        mode: mode || 'text',
        model,
        duration,
        quality,
        aspectRatio,
        referenceImage,
      }),
    });

    const data = await response.json().catch(() => ({}));
    onStatus('finalizing');
    if (!response.ok || !data?.ok || !data?.videoUrl) {
      return {
        status: 'error',
        error: data?.message || 'تعذر إنشاء الفيديو حاليًا، حاول مرة أخرى.',
        result: null,
      };
    }

    return {
      status: 'success',
      result: { videoUrl: data.videoUrl },
    };
  } catch (error) {
    return {
      status: 'error',
      error: error?.message || 'حدث خطأ أثناء الاتصال بخدمة الفيديو.',
      result: null,
    };
  }
}
