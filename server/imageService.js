const imageModelMap = {
  'Seedream 4.5': process.env.IMAGE_MODEL_SEEDREAM_45 || '',
  'Seedream 4.0': process.env.IMAGE_MODEL_SEEDREAM_40 || '',
};

const aspectRatioMap = {
  '1:1': '1:1',
  '9:16': '9:16',
  '16:9': '16:9',
  '4:5': '4:5',
  '3:4': '3:4',
};

const supportedQualityMap = {
  '480p': '480p',
  '720p': '720p',
  '1080p': '1080p',
  '4K': '4K',
};

function ensureSupportedModel(modelName) {
  if (!modelName || !imageModelMap[modelName]) {
    throw new Error('يرجى اختيار موديل صالح.');
  }

  return modelName;
}

export function validateImageRequest(payload) {
  const mode = payload.mode || 'image';
  const prompt = (payload.prompt || '').trim();
  const modelName = ensureSupportedModel(payload.model);
  const aspectRatio = payload.aspectRatio;
  const quality = payload.quality;

  if (!modelName) {
    throw new Error('يرجى اختيار موديل.');
  }

  if (mode === 'image' && !payload.referenceImage && !prompt) {
    throw new Error('يرجى كتابة وصف الصورة.');
  }

  if (mode === 'text' && !prompt) {
    throw new Error('يرجى كتابة وصف الصورة.');
  }

  if (!aspectRatio || !aspectRatioMap[aspectRatio]) {
    throw new Error('هذا المقاس غير متاح لهذا الموديل.');
  }

  if (!quality || !supportedQualityMap[quality]) {
    throw new Error('هذه الجودة غير مدعومة لهذا الموديل.');
  }

  return {
    model: modelName,
    mode,
    prompt: prompt || '',
    aspectRatio: aspectRatioMap[aspectRatio],
    quality: supportedQualityMap[quality],
    referenceImage: payload.referenceImage || null,
  };
}

export function resolveModelId(modelName) {
  const modelId = imageModelMap[modelName];

  if (!modelId) {
    throw new Error('موديل غير متاح في هذه البيئة.');
  }

  return modelId;
}

export async function createImageGeneration(payload) {
  try {
    const normalized = validateImageRequest(payload);
    const providerUrl = process.env.IMAGE_PROVIDER_URL;
    const providerApiKey = process.env.IMAGE_PROVIDER_API_KEY;

    if (!providerUrl || !providerApiKey) {
      return {
        ok: false,
        status: 503,
        message: 'لم يتم تهيئة مزود الصور في الخادم. أضف متغيرات البيئة المطلوبة.',
      };
    }

    const requestBody = {
      model: resolveModelId(normalized.model),
      prompt: normalized.prompt,
      aspectRatio: normalized.aspectRatio,
      quality: normalized.quality,
      mode: normalized.mode,
      image: normalized.referenceImage || undefined,
    };

    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status || 500,
        message: 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
        details: data?.error || 'Image provider request failed',
      };
    }

    const data = await response.json();
    const resultUrl = data.imageUrl || data.url || data.outputUrl || data.result?.imageUrl || null;
    const jobId = data.jobId || data.id || data.taskId || null;

    if (resultUrl) {
      return {
        ok: true,
        status: 200,
        imageUrl: resultUrl,
        jobId,
      };
    }

    if (jobId) {
      return {
        ok: true,
        status: 202,
        jobId,
        message: 'جاري إنشاء الصورة...',
      };
    }

    return {
      ok: false,
      status: 502,
      message: 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
      details: 'Image provider response did not include a usable result URL or job ID',
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error?.message || 'حدث خطأ أثناء الاتصال بالخدمة.',
    };
  }
}

export async function getImageJobStatus(jobId) {
  const providerUrl = process.env.IMAGE_PROVIDER_URL;
  const providerApiKey = process.env.IMAGE_PROVIDER_API_KEY;
  const statusUrl = process.env.IMAGE_PROVIDER_STATUS_URL;

  if (!providerUrl || !providerApiKey || !jobId) {
    return {
      ok: false,
      status: 503,
      message: 'لم يتم تهيئة مزود الصور في الخادم. أضف متغيرات البيئة المطلوبة.',
    };
  }

  let statusEndpoint = statusUrl || providerUrl;

  if (statusEndpoint.includes('{jobId}')) {
    statusEndpoint = statusEndpoint.replace('{jobId}', encodeURIComponent(jobId));
  } else if (statusEndpoint.includes('/jobs')) {
    statusEndpoint = `${statusEndpoint.replace(/\/$/, '')}/${encodeURIComponent(jobId)}`;
  } else if (statusEndpoint.includes('?')) {
    statusEndpoint = `${statusEndpoint}&jobId=${encodeURIComponent(jobId)}`;
  } else {
    statusEndpoint = `${statusEndpoint}?jobId=${encodeURIComponent(jobId)}`;
  }

  const response = await fetch(statusEndpoint, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${providerApiKey}`,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status || 500,
      message: 'تعذر التحقق من حالة الصورة. حاول مرة أخرى.',
    };
  }

  const data = await response.json();
  const imageUrl = data.imageUrl || data.url || data.outputUrl || data.result?.imageUrl || null;
  const status = data.status || (imageUrl ? 'completed' : 'pending');

  if (status === 'completed' || imageUrl) {
    return {
      ok: true,
      status: 200,
      imageUrl,
      jobId,
      resultStatus: 'completed',
    };
  }

  if (status === 'failed' || data.error) {
    return {
      ok: false,
      status: 400,
      message: 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.',
    };
  }

  return {
    ok: true,
    status: 202,
    jobId,
    resultStatus: 'pending',
  };
}
