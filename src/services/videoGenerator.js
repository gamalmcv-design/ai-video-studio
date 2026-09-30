export async function generateVideo(payload = {}, onStatus = () => {}) {
  const { prompt, mode, model, duration, quality, aspectRatio } = payload;

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

  if (!duration || !quality || !aspectRatio) {
    return {
      status: 'error',
      error: 'يرجى إكمال إعدادات الفيديو.',
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
        referenceImage: payload.referenceImage || null,
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
