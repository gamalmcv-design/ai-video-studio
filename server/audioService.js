const MAX_VOICE_TEXT = 5000;
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const SUPPORTED_MUSIC_PRESETS = new Set(['cinematic', 'energetic', 'dramatic', 'calm', 'advertising']);

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function providerStatus(urlName, keyName, modelName) {
  const url = process.env[urlName];
  const key = process.env[keyName];
  const model = modelName ? process.env[modelName] : 'configured';
  return !url || !key || !model ? 'Not configured' : 'Connected';
}

export function getConfiguredVoiceOptions() {
  try {
    const value = JSON.parse(process.env.VOICE_OPTIONS_JSON || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((option) => option && /^[\w.-]{1,64}$/u.test(option.id) && typeof option.label === 'string')
      .map(({ id, label, language, type }) => ({ id, label, language: language || 'ar', type: type || 'neutral' }));
  } catch {
    return [];
  }
}

export function getAudioProviderStatuses() {
  return {
    voice: providerStatus('VOICE_PROVIDER_URL', 'VOICE_PROVIDER_API_KEY', 'VOICE_MODEL_ID'),
    music: providerStatus('MUSIC_PROVIDER_URL', 'MUSIC_PROVIDER_API_KEY', 'MUSIC_MODEL_ID'),
    composer: providerStatus('COMPOSER_PROVIDER_URL', 'COMPOSER_PROVIDER_API_KEY'),
  };
}

async function fetchProvider(url, apiKey, body, timeoutMs = 60000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function createVoiceGeneration(payload = {}) {
  const text = typeof payload.text === 'string' ? payload.text : '';
  const speed = Number(payload.speed ?? 1);
  const voice = typeof payload.voice === 'string' ? payload.voice : '';

  if (!text.trim() || text.length > MAX_VOICE_TEXT) {
    return { ok: false, status: 400, message: 'أدخل نصًا صوتيًا لا يتجاوز 5000 حرف.' };
  }
  if (!/^[\w.-]{1,64}$/u.test(voice)) {
    return { ok: false, status: 400, message: 'اختر معرّف صوت صالحًا من مزود الصوت.' };
  }
  const voiceOptions = getConfiguredVoiceOptions();
  const configuredVoice = voiceOptions.find((option) => option.id === voice);
  if (voiceOptions.length && !configuredVoice) {
    return { ok: false, status: 400, message: 'الصوت المحدد غير متاح في إعدادات مزود الصوت.' };
  }
  if (configuredVoice && payload.language && configuredVoice.language !== payload.language) {
    return { ok: false, status: 400, message: 'الصوت المحدد لا يدعم اللغة المختارة وفق إعدادات المزود.' };
  }
  if (configuredVoice && payload.voiceType && configuredVoice.type !== payload.voiceType) {
    return { ok: false, status: 400, message: 'نوع الصوت لا يطابق الصوت المختار.' };
  }
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) {
    return { ok: false, status: 400, message: 'سرعة الصوت يجب أن تكون بين 0.5 و2.' };
  }

  const url = process.env.VOICE_PROVIDER_URL;
  const apiKey = process.env.VOICE_PROVIDER_API_KEY;
  const model = process.env.VOICE_MODEL_ID;
  if (!url || !apiKey || !model) {
    return { ok: false, status: 503, message: 'خدمة الصوت غير مهيأة. أضف إعدادات مزود متوافق في الخادم.' };
  }
  if (!isHttpUrl(url)) return { ok: false, status: 503, message: 'عنوان مزود الصوت غير صالح.' };

  try {
    const response = await fetchProvider(url, apiKey, {
      model,
      input: text,
      voice,
      response_format: 'mp3',
      speed,
    });
    if (!response.ok) return { ok: false, status: response.status || 502, message: 'تعذر إنشاء الصوت لدى المزود.' };
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    if (!contentType.startsWith('audio/')) return { ok: false, status: 502, message: 'أعاد مزود الصوت صيغة غير صوتية.' };
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return { ok: false, status: 502, message: 'حجم الصوت الناتج غير صالح.' };
    return { ok: true, status: 200, audioBase64: bytes.toString('base64'), mimeType: contentType };
  } catch (error) {
    return { ok: false, status: 502, message: error?.name === 'AbortError' ? 'انتهت مهلة إنشاء الصوت.' : 'تعذر الاتصال بمزود الصوت.' };
  }
}

export async function createMusicGeneration(payload = {}) {
  const preset = payload.preset;
  const durationSeconds = Number(payload.durationSeconds);
  if (!SUPPORTED_MUSIC_PRESETS.has(preset)) return { ok: false, status: 400, message: 'اختر نمط موسيقى صالحًا.' };
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 600) {
    return { ok: false, status: 400, message: 'مدة الموسيقى يجب أن تكون بين ثانية و10 دقائق.' };
  }

  const url = process.env.MUSIC_PROVIDER_URL;
  const apiKey = process.env.MUSIC_PROVIDER_API_KEY;
  const model = process.env.MUSIC_MODEL_ID;
  if (!url || !apiKey || !model) {
    return { ok: false, status: 503, message: 'خدمة الموسيقى غير مهيأة. أضف إعدادات مزود متوافق في الخادم.' };
  }
  if (!isHttpUrl(url)) return { ok: false, status: 503, message: 'عنوان مزود الموسيقى غير صالح.' };

  try {
    const response = await fetchProvider(url, apiKey, {
      model,
      preset,
      durationSeconds,
      loop: Boolean(payload.loop),
    });
    if (!response.ok) return { ok: false, status: response.status || 502, message: 'تعذر إنشاء الموسيقى لدى المزود.' };
    const contentType = response.headers.get('content-type') || '';
    if (contentType.startsWith('audio/')) {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) return { ok: false, status: 502, message: 'حجم الموسيقى الناتجة غير صالح.' };
      return { ok: true, status: 200, audioBase64: bytes.toString('base64'), mimeType: contentType };
    }
    const data = await response.json().catch(() => ({}));
    if (typeof data.audioUrl === 'string' && isHttpUrl(data.audioUrl)) {
      return { ok: true, status: 200, audioUrl: data.audioUrl };
    }
    return { ok: false, status: 502, message: 'صيغة استجابة مزود الموسيقى غير مدعومة.' };
  } catch (error) {
    return { ok: false, status: 502, message: error?.name === 'AbortError' ? 'انتهت مهلة إنشاء الموسيقى.' : 'تعذر الاتصال بمزود الموسيقى.' };
  }
}