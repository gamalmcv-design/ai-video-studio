import { generateImage as aiGenerateImage } from 'ai';

const imageModelMap = {
  'Seedream 5.0 Pro': 'bytedance/seedream-5.0-pro',
};

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

  return {
    model: modelName,
    mode,
    prompt,
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

    console.info('Calling Vercel AI Gateway for image generation with model bytedance/seedream-5.0-pro');

    const result = await aiGenerateImage({
      model: resolveModelId(normalized.model),
      prompt: normalized.prompt,
    });

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
