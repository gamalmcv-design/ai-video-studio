export async function generateScript(payload = {}) {
  const { idea, type, duration, style, language, detailLevel } = payload;

  if (!idea?.trim()) {
    return {
      status: 'error',
      error: 'يرجى كتابة فكرة السكريبت.',
      result: null,
    };
  }

  if (!type || !duration || !style || !language || !detailLevel) {
    return {
      status: 'error',
      error: 'يرجى إكمال إعدادات السكريبت.',
      result: null,
    };
  }

  return {
    status: 'error',
    error: 'خدمة التوليد ستُفعّل بعد إعداد محرك التوليد.',
    result: null,
  };
}
