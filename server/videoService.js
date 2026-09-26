const modelMap = {
  'Seedance 2.5': process.env.VIDEO_MODEL_SEEDANCE_25 || '',
  'سباداتيس 2.0': process.env.VIDEO_MODEL_SPADATIS_20 || '',
};

const allowedAspectRatios = {
  '9:16': '9:16',
  '16:9': '16:9',
  '1:1': '1:1',
};

const supportedQualityMap = {
  '480p': '480p',
  '760p': '760p',
  '1080p': '1080p',
  '4K': '4K',
};

const supportedDurations = ['10s', '15s', '20s', '25s', '30s'];

function normalizeDuration(value) {
  return supportedDurations.includes(value) ? value : '15s';
}

function mapQuality(modelName, quality) {
  if (modelName === 'Seedance 2.5' && quality === '760p') {
    return '1080p';
  }

  if (modelName === 'سباداتيس 2.0' && quality === '4K') {
    return '1080p';
  }

  return supportedQualityMap[quality] || '1080p';
}

export function validateVideoRequest(payload) {
  if (!payload.model) {
    throw new Error('يرجى اختيار موديل الفيديو.');
  }

  if (!payload.duration) {
    throw new Error('يرجى اختيار مدة الفيديو.');
  }

  if (!payload.quality) {
    throw new Error('يرجى اختيار جودة الفيديو.');
  }

  if (!payload.aspectRatio) {
    throw new Error('يرجى اختيار مقاس الفيديو.');
  }

  if (payload.mode === 'image' && !payload.referenceImage && !payload.prompt?.trim()) {
    throw new Error('يرجى رفع صورة أو كتابة وصف الفيديو.');
  }

  if (payload.mode === 'text' && !payload.prompt?.trim()) {
    throw new Error('يرجى كتابة وصف الفيديو.');
  }

  if (!allowedAspectRatios[payload.aspectRatio]) {
    throw new Error('هذا المقاس غير متاح لهذا الموديل.');
  }

  return {
    model: payload.model,
    prompt: payload.prompt?.trim() || '',
    duration: normalizeDuration(payload.duration),
    quality: mapQuality(payload.model, payload.quality),
    aspectRatio: allowedAspectRatios[payload.aspectRatio],
    mode: payload.mode || 'text',
    referenceImage: payload.referenceImage || null,
  };
}

export function getVideoModelId(modelName) {
  const modelId = modelMap[modelName];

  if (!modelId) {
    throw new Error('موديل غير مدعوم في إعدادات الخادم.');
  }

  return modelId;
}

export async function createVideoGeneration(payload) {
  const normalized = validateVideoRequest(payload);

  const providerUrl = process.env.VIDEO_PROVIDER_URL;
  const providerApiKey = process.env.VIDEO_PROVIDER_API_KEY;

  if (!providerUrl || !providerApiKey) {
    return {
      ok: false,
      status: 503,
      message: 'لم يتم تهيئة مزود الفيديو في الخادم. أضف إعدادات المزود في متغيرات البيئة فقط.',
      developerMessage: 'Missing VIDEO_PROVIDER_URL or VIDEO_PROVIDER_API_KEY',
    };
  }

  const modelId = getVideoModelId(normalized.model);

  const requestBody = {
    model: modelId,
    prompt: normalized.prompt,
    duration: normalized.duration,
    quality: normalized.quality,
    aspectRatio: normalized.aspectRatio,
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
      message: 'تعذر إنشاء الفيديو حاليًا، حاول مرة أخرى.',
      developerMessage: data?.error || 'Video provider request failed',
    };
  }

  const data = await response.json();
  const videoUrl = data.videoUrl || data.outputUrl || data.url || data.result?.videoUrl || null;

  if (!videoUrl) {
    return {
      ok: false,
      status: 502,
      message: 'تعذر إنشاء الفيديو حاليًا، حاول مرة أخرى.',
      developerMessage: 'Video provider response did not include a video URL',
    };
  }

  return {
    ok: true,
    status: 200,
    videoUrl,
    model: normalized.model,
    duration: normalized.duration,
    quality: normalized.quality,
    aspectRatio: normalized.aspectRatio,
  };
}
