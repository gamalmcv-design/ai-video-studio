import { isIP } from 'node:net';

const modelMap = {
  'Seedance 2.5': process.env.VIDEO_MODEL_SEEDANCE_25 || '',
  'Seedance 2.0': process.env.VIDEO_MODEL_SEEDANCE_20 || '',
  'سباداتيس 2.0': process.env.VIDEO_MODEL_SPADATIS_20 || '',
};

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname === 'metadata.google.internal' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) return false;
    if (isIP(hostname) === 4) {
      const [first, second] = hostname.split('.').map(Number);
      if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
      if (first === 169 && second === 254) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && second === 168) return false;
      if (first === 100 && second >= 64 && second <= 127) return false;
    }
    if (isIP(hostname) === 6 && /^(::|::1|::ffff:|fc|fd|fe80)/i.test(hostname)) return false;
    return true;
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
};

const supportedDurations = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
const maxReferenceImageBytes = 3 * 1024 * 1024;

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function extractMediaUrl(data) {
  const mediaUrl = data?.output?.media_url;
  return (Array.isArray(mediaUrl) ? mediaUrl[0] : mediaUrl) ||
    data?.output?.url ||
    data?.video_url ||
    data?.url ||
    data?.result?.videoUrl ||
    null;
}

function normalizeReferenceImage(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw createValidationError('الصورة المرجعية غير صالحة.');
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw createValidationError('الصورة المرجعية يجب أن تصل بصيغة Data URL من نوع PNG أو JPEG أو WebP.');
  const imageBytes = Buffer.from(match[2], 'base64');
  if (!imageBytes.length || imageBytes.length > maxReferenceImageBytes || imageBytes.toString('base64') !== match[2]) {
    throw createValidationError('الصورة المرجعية فارغة أو تتجاوز حد 3 ميجابايت.');
  }
  const mimeType = match[1];
  const validSignature = mimeType === 'image/png'
    ? imageBytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : mimeType === 'image/jpeg'
      ? imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
      : imageBytes.length >= 12 && imageBytes.toString('ascii', 0, 4) === 'RIFF' && imageBytes.toString('ascii', 8, 12) === 'WEBP';
  if (!validSignature) throw createValidationError('نوع الصورة لا يطابق محتواها الفعلي.');
  return value;
}

const pixazoSeedance25Adapter = {
  supportsImageToVideo: false,
  buildTextToVideoRequest(normalized, modelId) {
    return {
      content: [{ type: 'text', text: normalized.prompt }],
      ratio: normalized.aspectRatio,
      resolution: normalized.quality,
      duration: normalized.duration,
      generate_audio: true,
      watermark: false,
      output_format: 'mp4',
      model: modelId,
    };
  },
};

function normalizeDuration(value) {
  const raw = typeof value === 'string' ? value.replace(/s$/i, '') : value;
  return Number(raw);
}

function mapQuality(modelName, quality) {
  if (!Object.hasOwn(supportedQualityMap, quality)) {
    throw createValidationError('جودة الفيديو المختارة غير مدعومة. اختر 480p أو 720p.');
  }
  return supportedQualityMap[quality];
}

function buildStatusUrl(baseUrl, requestId) {
  if (!baseUrl) {
    return '';
  }

  if (baseUrl.includes('{request_id}')) {
    return baseUrl.replace('{request_id}', encodeURIComponent(requestId));
  }

  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.endsWith(`/${encodeURIComponent(requestId)}`)) return normalized;
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
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createValidationError('بيانات طلب الفيديو غير صالحة.');
  }
  if (!payload.model) {
    throw createValidationError('يرجى اختيار موديل الفيديو.');
  }
  if (!payload.duration) {
    throw createValidationError('يرجى اختيار مدة الفيديو.');
  }
  if (!payload.quality) {
    throw createValidationError('يرجى اختيار جودة الفيديو.');
  }
  if (!payload.aspectRatio) {
    throw createValidationError('يرجى اختيار مقاس الفيديو.');
  }

  const mode = payload.mode || 'text';
  if (!['text', 'image'].includes(mode)) {
    throw createValidationError('طريقة إنشاء الفيديو غير مدعومة.');
  }
  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  const referenceImage = normalizeReferenceImage(payload.referenceImage);

  if (mode === 'image' && !referenceImage && !prompt.trim()) {
    throw createValidationError('يرجى رفع صورة أو كتابة وصف الفيديو.');
  }
  if (mode === 'text' && !prompt.trim()) {
    throw createValidationError('يرجى كتابة وصف الفيديو.');
  }

  if (!allowedAspectRatios[payload.aspectRatio]) {
    throw createValidationError('هذا المقاس غير متاح لهذا الموديل.');
  }

  const duration = normalizeDuration(payload.duration);
  if (!Number.isInteger(duration) || !supportedDurations.includes(duration)) {
    throw createValidationError('مدة الفيديو غير مدعومة. اختر مدة من القائمة حتى 30 ثانية.');
  }
  const normalizedQuality = mapQuality(payload.model, payload.quality);

  return {
    model: payload.model,
    prompt,
    duration,
    quality: normalizedQuality,
    aspectRatio: allowedAspectRatios[payload.aspectRatio],
    mode,
    referenceImage,
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
  const endpoint = statusUrl;

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
      const mediaUrl = extractMediaUrl(data);

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
  let normalized;
  try {
    normalized = validateVideoRequest(payload);
  } catch (error) {
    if (!Number.isInteger(error?.statusCode)) throw error;
    return {
      ok: false,
      status: error.statusCode,
      message: error.message,
      developerMessage: 'Invalid video generation request',
    };
  }

  if (normalized.referenceImage && !pixazoSeedance25Adapter.supportsImageToVideo) {
    return {
      ok: false,
      status: 422,
      message: 'مزود الفيديو الحالي غير مهيأ لـ Image-to-Video: لا يوجد في عقده الحالي حقل موثق للصورة المرجعية. استخدم وصفًا نصيًا أو جهّز Adapter موثقًا يدعم الصور.',
      developerMessage: 'The Pixazo Seedance adapter supports text-to-video only; no verified image-reference request field is configured.',
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

  const requestBody = pixazoSeedance25Adapter.buildTextToVideoRequest(normalized, modelId);

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

  const directVideoUrl = data?.videoUrl || data?.outputUrl || extractMediaUrl(data);

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

  const safePollingUrl = buildStatusUrl(pollingUrl, requestId);
  const allowedPollingOrigins = [providerUrl, providerStatusUrl]
    .filter(Boolean)
    .map((url) => {
      try { return new URL(url.replace('{request_id}', 'request-id')).origin; } catch { return null; }
    })
    .filter(Boolean);
  let pollingOrigin = '';
  try { pollingOrigin = new URL(safePollingUrl).origin; } catch { /* rejected below */ }
  if (!isHttpUrl(safePollingUrl) || !allowedPollingOrigins.includes(pollingOrigin)) {
    return {
      ok: false,
      status: 502,
      message: 'أعاد مزود الفيديو عنوان تحقق غير آمن أو غير متوافق.',
      developerMessage: 'Polling URL must use a configured provider origin.',
    };
  }

  const pollingResult = await pollVideoStatus(safePollingUrl, requestId, providerApiKey);

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
