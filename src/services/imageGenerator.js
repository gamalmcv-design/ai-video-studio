export async function generateImage(payload = {}) {
  const { description, mode, model, aspectRatio, quality } = payload;

  if (!description?.trim() && mode !== 'image') {
    return {
      status: 'error',
      error: 'يرجى كتابة وصف الصورة.',
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

  if (!aspectRatio || !quality) {
    return {
      status: 'error',
      error: 'يرجى إكمال إعدادات الصورة.',
      result: null,
    };
  }

  return {
    status: 'error',
    error: 'خدمة التوليد ستُفعّل بعد إعداد محرك التوليد.',
    result: null,
  };
}
