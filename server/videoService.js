const modelMap = {
  'Seedance 2.5': process.env.VIDEO_MODEL_SEEDANCE_25 || '',
  'Seedance 2.0': process.env.VIDEO_MODEL_SEEDANCE_20 || '',
  'سباداتيس 2.0': process.env.VIDEO_MODEL_SPADATIS_20 || '',
};

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const allowedAspectRatios = {
  '9:16': '9:16',
  '16:9': '16:9',
  '4:3': '4:3',
  '1:1': '1:1',
  '3:4': '3:4',
  '21:9': '21:9',
  adaptive: 'adaptive',
};

const supportedQualityMap = {
  '480p': '480p',
  '720p': '720p',
  '1080p': '720p',
  '4K': '720p',
};

const supportedDurations = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];

function normalizeDuration(value) {
  const raw = typeof value === 'string' ? value.replace(/s$/i, '') : value;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return 15;
  }

  if (parsed < 4) {
    return 4;
  }

  if (parsed > 30) {
    return 30;
  }

  return parsed;
}

function mapQuality(modelName, quality) {
  if (modelName === 'Seedance 2.5') {
    return supportedQualityMap[quality] || '720p';
  }

  if (modelName === 'Seedance 2.0' || modelName === 'سباداتيس 2.0') {
    return supportedQualityMap[quality] || '720p';
  }

  return supportedQualityMap[quality] || '720p';
}

function buildStatusUrl(baseUrl, requestId) {
  if (!baseUrl) {
    return '';
  }

  if (baseUrl.includes('{request_id}')) {
    return baseUrl.replace('{request_id}', encodeURIComponent(requestId));
  }

  const normalized = baseUrl.replace(/\/$/, '');
  return `${normalized}/${encodeURIComponent(requestId)}`;
}

function safeErrorMessage(data) {
  const raw =
    data?.message ||
    data?.error ||
    data?.detail ||
    data?.error?.message ||
    data?.title ||
    data?.description ||
    data?.statusText ||
    'تعذر إنشاء الفيديو حاليًا.';

  if (typeof raw === 'string') {
    return raw.replace(/\s+/g, ' ').trim().replace(/(api[-_ ]?key|authorization|token)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]');
  }

  if (raw && typeof raw === 'object') {
    const nested = raw.message || raw.error || raw.detail || raw.title || raw.description;
    return typeof nested === 'string'
      ? nested.replace(/\s+/g, ' ').trim().replace(/(api[-_ ]?key|authorization|token)(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
      : 'تعذر إنشاء الفيديو حاليًا.';
  }

  return 'تعذر إنشاء الفيديو حاليًا.';
}

function extractErrorMessage(status, data) {
  if (status === 400) return 'طلب غير صالح في مزود الفيديو.';
  if (status === 401) return 'غير مصرح للوصول إلى مزود الفيديو.';
  if (status === 402) return 'تحتاج إلى تفعيل رصيد مزود الفيديو.';
  if (status === 403) return 'تم رفض الوصول إلى مزود الفيديو.';
  if (status === 429) return 'تم تجاوز حد الطلبات. حاول لاحقًا.';
  if (status === 500) return 'خطأ في مزود الفيديو. حاول مرة أخرى.';

  return safeErrorMessage(data);
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

  const normalizedQuality = mapQuality(payload.model, payload.quality);

  return {
    model: payload.model,
    prompt: payload.prompt?.trim() || '',
    duration: normalizeDuration(payload.duration),
    quality: normalizedQuality,
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

async function pollVideoStatus(statusUrl, requestId, providerApiKey, maxAttempts = 30) {
  const endpoint = buildStatusUrl(statusUrl, requestId);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': providerApiKey,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const safeMessage = safeErrorMessage(data);
      return {
        ok: false,
        status: response.status || 500,
        message: `Pixazo HTTP status: ${response.status || 500}\nPixazo error: ${safeMessage}`,
        developerMessage: safeMessage,
      };
    }

    const data = await response.json().catch(() => ({}));
    const status = String(data?.status || data?.state || '').toUpperCase();

    if (status === 'COMPLETED') {
      const mediaUrl =
        data?.output?.media_url?.[0] ||
        data?.output?.media_url ||
        data?.output?.url ||
        data?.video_url ||
        data?.url ||
        data?.result?.videoUrl ||
        null;

      if (!mediaUrl) {
        return {
          ok: false,
          status: 502,
          message: 'تعذر الحصول على رابط الفيديو بعد اكتماله.',
          developerMessage: 'Completed response did not include media_url',
        };
      }

      if (!isHttpUrl(mediaUrl)) {
        return {
          ok: false,
          status: 502,
          message: 'أعاد مزود الفيديو رابطًا غير صالح.',
          developerMessage: 'Provider output URL must use HTTP or HTTPS.',
        };
      }

      return {
        ok: true,
        status: 200,
        videoUrl: mediaUrl,
      };
    }

    if (status === 'FAILED' || status === 'ERROR') {
      const safeMessage = safeErrorMessage(data);
      return {
        ok: false,
        status: 500,
        message: `Pixazo last status: ${status}\nPixazo error: ${safeMessage}`,
        developerMessage: safeMessage,
      };
    }

    if (status === 'QUEUED' || status === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    ok: false,
    status: 504,
    message: 'استغرقت عملية إنشاء الفيديو وقتًا أطول من المتوقع.',
    developerMessage: 'Video generation timed out during polling',
  };
}

export async function createVideoGeneration(payload) {
  const normalized = validateVideoRequest(payload);

  if (normalized.referenceImage) {
    return {
      ok: false,
      status: 422,
      message: 'تكامل Seedance الحالي لا يرسل الصور المرجعية إلى المزود. استخدم وصفًا نصيًا أو أعد المحاولة بعد تهيئة دعم الصور من المزود.',
      developerMessage: 'The configured provider adapter has no verified image-reference request contract.',
    };
  }

  const providerUrl = process.env.VIDEO_PROVIDER_URL;
  const providerApiKey = process.env.VIDEO_PROVIDER_API_KEY;
  const providerStatusUrl = process.env.VIDEO_PROVIDER_STATUS_URL;

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
    content: [
      {
        type: 'text',
        text: normalized.prompt,
      },
    ],
    ratio: normalized.aspectRatio,
    resolution: normalized.quality,
    duration: normalized.duration,
    generate_audio: true,
    watermark: false,
    output_format: 'mp4',
    model: modelId,
  };

  const response = await fetch(providerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': providerApiKey,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const safeMessage = safeErrorMessage(data);
    return {
      ok: false,
      status: response.status || 500,
      message: `Pixazo HTTP status: ${response.status || 500}\nPixazo error: ${safeMessage}`,
      developerMessage: safeMessage,
    };
  }

  const data = await response.json().catch(() => ({}));

  const directVideoUrl =
    data?.videoUrl ||
    data?.outputUrl ||
    data?.url ||
    data?.result?.videoUrl ||
    data?.output?.media_url?.[0] ||
    null;

  if (directVideoUrl) {
    if (!isHttpUrl(directVideoUrl)) {
      return {
        ok: false,
        status: 502,
        message: 'أعاد مزود الفيديو رابطًا غير صالح.',
        developerMessage: 'Provider output URL must use HTTP or HTTPS.',
      };
    }
    return {
      ok: true,
      status: 200,
      videoUrl: directVideoUrl,
      model: normalized.model,
      duration: normalized.duration,
      quality: normalized.quality,
      aspectRatio: normalized.aspectRatio,
    };
  }

  const requestId = data?.request_id || data?.requestId || data?.id || data?.jobId || null;
  const pollingUrl = data?.polling_url || data?.pollingUrl || data?.statusUrl || data?.status_url || providerStatusUrl || null;

  if (!requestId) {
    return {
      ok: false,
      status: 502,
      message: 'لم يرد مزود الفيديو بمعرّف المهمة المطلوبة.',
      developerMessage: 'Missing request_id in provider response',
    };
  }

  if (!pollingUrl) {
    return {
      ok: false,
      status: 502,
      message: 'لم يرد مزود الفيديو بعنوان التحقق من الحالة.',
      developerMessage: 'Missing polling url in provider response',
    };
  }

  const pollingResult = await pollVideoStatus(pollingUrl, requestId, providerApiKey);

  if (!pollingResult.ok) {
    return {
      ok: false,
      status: pollingResult.status || 500,
      message: pollingResult.message || 'تعذر إنشاء الفيديو حاليًا.',
      developerMessage: pollingResult.developerMessage || 'Video polling failed',
    };
  }

  return {
    ok: true,
    status: 200,
    videoUrl: pollingResult.videoUrl,
    model: normalized.model,
    duration: normalized.duration,
    quality: normalized.quality,
    aspectRatio: normalized.aspectRatio,
  };
}
