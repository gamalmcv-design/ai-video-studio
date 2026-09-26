export async function generateVideo(payload = {}) {
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

  return {
    status: 'error',
    error: 'خدمة التوليد ستُفعّل بعد إعداد محرك التوليد.',
    result: null,
  };
}
