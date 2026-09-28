import { generateImage as aiGenerateImage } from 'ai';

const imageModelMap = {
  'Seedream 5.0 Pro': 'bytedance/seedream-5.0-pro',
};

const supportedAspectRatios = new Set(['16:9', '9:16', '1:1', '3:4', '4:5']);
const supportedQualities = new Set(['1K', '1.5K', '2K']);
const qualitySizeMap = {
  '1K': {
    '16:9': '1280x720',
    '9:16': '720x1280',
    '1:1': '1024x1024',
    '3:4': '1024x1366',
    '4:5': '1024x1280',
  },
  '1.5K': {
    '16:9': '1536x864',
    '9:16': '864x1536',
    '1:1': '1536x1536',
    '3:4': '1368x1824',
    '4:5': '1440x1800',
  },
  '2K': {
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '1:1': '2048x2048',
    '3:4': '1536x2048',
    '4:5': '1638x2048',
  },
};

function resolveExactSize(quality, aspectRatio) {
  if (!supportedQualities.has(quality)) {
    throw new Error('مستوى الجودة المختار غير مدعوم حاليًا بواسطة Seedream 5.0 Pro.');
  }

  if (!supportedAspectRatios.has(aspectRatio)) {
    throw new Error('نسبة الصورة المختارة غير مدعومة حاليًا بواسطة Seedream 5.0 Pro.');
  }

  const exactSize = qualitySizeMap[quality]?.[aspectRatio];
  if (!exactSize) {
    throw new Error('هذا المزيج بين الجودة والنسبة غير مدعوم حاليًا بواسطة Seedream 5.0 Pro.');
  }

  return exactSize;
}

function ensureSupportedModel(modelName) {
  if (!modelName || !imageModelMap[modelName]) {
    throw new Error('يرجى اختيار موديل صالح.');
  }

  return modelName;
}

function toDataUrlFromImage(imageLike) {
  if (!imageLike) {
    return null;
  }

  if (typeof imageLike === 'string') {
    if (imageLike.startsWith('data:')) {
      return imageLike;
    }

    if (imageLike.startsWith('http://') || imageLike.startsWith('https://')) {
      return imageLike;
    }

    return `data:image/png;base64,${imageLike}`;
  }

  if (imageLike.base64) {
    const mimeType = imageLike.mimeType || 'image/png';
    return `data:${mimeType};base64,${imageLike.base64}`;
  }

  if (imageLike.uint8Array) {
    const bytes = imageLike.uint8Array;
    const base64 = Buffer.from(bytes).toString('base64');
    const mimeType = imageLike.mimeType || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  }

  if (imageLike.buffer) {
    const base64 = Buffer.from(imageLike.buffer).toString('base64');
    const mimeType = imageLike.mimeType || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  }

  return null;
}

export function validateImageRequest(payload = {}) {
  const mode = payload.mode || 'image';
  const prompt = String(payload.prompt ?? payload.description ?? '').trim();
  const modelName = ensureSupportedModel(payload.model);

  if (!modelName) {
    throw new Error('يرجى اختيار موديل.');
  }

  if (mode === 'image' && !payload.referenceImage && !prompt) {
    throw new Error('يرجى كتابة وصف الصورة.');
  }

  if (mode === 'text' && !prompt) {
    throw new Error('يرجى كتابة وصف الصورة.');
  }

  if (!prompt) {
    throw new Error('يرجى كتابة وصف الصورة.');
  }

  const aspectRatio = typeof payload.aspectRatio === 'string' ? payload.aspectRatio.trim() : undefined;
  const quality = typeof payload.quality === 'string' ? payload.quality.trim() : undefined;
  const sizeFromPayload = typeof payload.size === 'string' ? payload.size.trim() : undefined;

  if (aspectRatio && !supportedAspectRatios.has(aspectRatio)) {
    throw new Error('نسبة الصورة المختارة غير مدعومة في هذا النموذج.');
  }

  if (quality && !supportedQualities.has(quality)) {
    throw new Error('مستوى الجودة المختار غير مدعوم حاليًا بواسطة Seedream 5.0 Pro.');
  }

  const resolvedSize = quality && aspectRatio ? resolveExactSize(quality, aspectRatio) : sizeFromPayload;

  if (resolvedSize && !/^\d+x\d+$/.test(resolvedSize)) {
    throw new Error('حجم الصورة غير مدعوم في هذا النموذج.');
  }

  return {
    model: modelName,
    mode,
    prompt,
    referenceImage: payload.referenceImage || null,
    aspectRatio,
    quality,
    size: resolvedSize || sizeFromPayload || null,
  };
}

export function resolveModelId(modelName) {
  const modelId = imageModelMap[modelName];

  if (!modelId) {
    throw new Error('موديل غير متاح في هذه البيئة.');
  }

  return modelId;
}

export async function createImageGeneration(payload = {}) {
  try {
    const normalized = validateImageRequest(payload);
    const apiKey = process.env.AI_GATEWAY_API_KEY;

    if (!apiKey) {
      return {
        ok: false,
        status: 503,
        message: 'لم يتم تهيئة مزود الصور في الخادم. أضف متغير البيئة AI_GATEWAY_API_KEY.',
      };
    }

    console.info('Image generation config', {
      model: resolveModelId(normalized.model),
      aspectRatio: normalized.aspectRatio,
      quality: normalized.quality,
      size: normalized.size,
    });

    const generationOptions = {
      model: resolveModelId(normalized.model),
      prompt: normalized.prompt,
    };

    if (normalized.aspectRatio) {
      generationOptions.aspectRatio = normalized.aspectRatio;
    }

    if (normalized.size) {
      generationOptions.size = normalized.size;
    }

    const result = await aiGenerateImage(generationOptions);

    const imageData = result?.image || result?.output?.image || null;
    const imageUrl = toDataUrlFromImage(imageData);

    if (!imageUrl) {
      return {
        ok: false,
        status: 502,
        message: 'تعذر إنشاء الصورة حاليًا، لم يرد رابط صورة صالح من خادم AI Gateway.',
      };
    }

    return {
      ok: true,
      status: 200,
      imageUrl,
      jobId: null,
    };
  } catch (error) {
    console.error('AI Gateway image generation failed:', error);

    const errorMessage = error?.message || 'حدث خطأ أثناء الاتصال بخدمة AI Gateway.';
    const lower = String(errorMessage).toLowerCase();

    if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('forbidden')) {
      return {
        ok: false,
        status: 401,
        message: 'مفتاح AI Gateway غير صالح أو غير مصرح به.',
      };
    }

    if (lower.includes('402') || lower.includes('payment')) {
      return {
        ok: false,
        status: 402,
        message: 'حساب AI Gateway غير مفعّل أو غير مدفوع.',
      };
    }

    if (lower.includes('429') || lower.includes('rate limit')) {
      return {
        ok: false,
        status: 429,
        message: 'تم تجاوز الحد المسموح من الطلبات. حاول لاحقًا.',
      };
    }

    if (lower.includes('400') || lower.includes('bad request')) {
      return {
        ok: false,
        status: 400,
        message: errorMessage,
      };
    }

    return {
      ok: false,
      status: 500,
      message: errorMessage,
    };
  }
}

export async function getImageJobStatus() {
  return {
    ok: false,
    status: 501,
    message: 'لم تعد عمليات التحقق بالاستقصاء مطلوبة مع AI Gateway؛ التوليد يحدث مباشرةً.',
  };
}
