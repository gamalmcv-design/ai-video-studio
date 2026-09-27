async function pollImageJob(jobId, { maxAttempts = 20, intervalMs = 3000 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const response = await fetch(`/api/image?jobId=${encodeURIComponent(jobId)}`, {
      method: 'GET',
    });

    const data = await response.json().catch(() => ({}));

    if (data?.ok && data?.imageUrl) {
      return {
        status: 'success',
        result: { imageUrl: data.imageUrl },
      };
    }

    if (data?.ok && data?.resultStatus === 'completed') {
      return {
        status: 'success',
        result: { imageUrl: data.imageUrl || null },
      };
    }

    if (data?.ok && data?.resultStatus === 'failed') {
      return {
        status: 'error',
        error: 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
        result: null,
      };
    }
  }

  return {
    status: 'error',
    error: 'استغرقت المهمة وقتًا أطول من المتوقع. حاول مرة أخرى.',
    result: null,
  };
}

export async function generateImage(payload = {}) {
  const {
    description,
    mode,
    model,
    aspectRatio,
    quality,
    referenceImage,
  } = payload;

  const prompt = (description || '').trim();

  if (!prompt && mode !== 'image') {
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

  try {
    const response = await fetch('/api/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        mode: mode || 'image',
        model,
        aspectRatio,
        quality,
        referenceImage,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        status: 'error',
        error: data?.message || 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
        result: null,
      };
    }

    if (data?.imageUrl) {
      return {
        status: 'success',
        result: { imageUrl: data.imageUrl },
      };
    }

    if (data?.jobId) {
      return pollImageJob(data.jobId);
    }

    return {
      status: 'error',
      error: 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
      result: null,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error?.message || 'حدث خطأ أثناء الاتصال بالخدمة.',
      result: null,
    };
  }
}
