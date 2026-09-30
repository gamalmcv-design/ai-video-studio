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

  try {
    const response = await fetch('/api/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, type, duration, style, language, detailLevel }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok || !data?.script) {
      return {
        status: 'error',
        error: data?.message || 'تعذر إنشاء السكريبت حاليًا، حاول مرة أخرى.',
        result: null,
      };
    }

    return {
      status: 'success',
      result: data.script,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error?.message || 'حدث خطأ أثناء الاتصال بخدمة الكتابة.',
      result: null,
    };
  }
}
