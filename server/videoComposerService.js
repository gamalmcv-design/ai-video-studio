import { isIP } from 'node:net';

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname === 'metadata.google.internal') return false;
    if (isIP(hostname) === 4) {
      const [first, second] = hostname.split('.').map(Number);
      if (first === 0 || first === 10 || first === 127 || first >= 224) return false;
      if (first === 169 && second === 254) return false;
      if (first === 172 && second >= 16 && second <= 31) return false;
      if (first === 192 && second === 168) return false;
      if (first === 100 && second >= 64 && second <= 127) return false;
    }
    if (isIP(hostname) === 6 && (/^(::|::1|fc|fd|fe80)/i.test(hostname))) return false;
    return true;
  } catch {
    return false;
  }
}

export async function createVideoComposition(payload = {}) {
  const videoUrl = payload.videoUrl;
  if (typeof videoUrl !== 'string' || !isHttpUrl(videoUrl)) {
    return { ok: false, status: 400, message: 'رابط الفيديو الأساسي غير صالح.' };
  }
  if (payload.subtitles && (typeof payload.subtitles !== 'string' || payload.subtitles.length > 250000)) {
    return { ok: false, status: 400, message: 'ملف الترجمة غير صالح أو كبير جدًا.' };
  }
  for (const key of ['voiceUrl', 'musicUrl']) {
    const value = payload[key];
    const isAudioDataUrl = typeof value === 'string' && /^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 7_000_000;
    if (value && (typeof value !== 'string' || (!isHttpUrl(value) && !isAudioDataUrl))) {
      return { ok: false, status: 400, message: 'أحد روابط الصوت غير صالح.' };
    }
  }
  const subtitleSettings = payload.subtitleSettings && typeof payload.subtitleSettings === 'object'
    ? payload.subtitleSettings
    : {};

  const url = process.env.COMPOSER_PROVIDER_URL;
  const apiKey = process.env.COMPOSER_PROVIDER_API_KEY;
  if (!url || !apiKey) return { ok: false, status: 503, message: 'خدمة تركيب الفيديو غير مهيأة على الخادم.' };
  if (!isHttpUrl(url)) return { ok: false, status: 503, message: 'عنوان خدمة التركيب غير صالح.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl,
        voiceUrl: payload.voiceUrl || null,
        musicUrl: payload.musicUrl || null,
        subtitles: payload.subtitles || null,
        settings: {
          volume: Math.max(0, Math.min(1, Number(payload.volume ?? 0.3))),
          fadeInSeconds: Math.max(0, Math.min(10, Number(payload.fadeInSeconds ?? 1))),
          fadeOutSeconds: Math.max(0, Math.min(10, Number(payload.fadeOutSeconds ?? 1))),
          transition: ['none', 'fade', 'dissolve'].includes(payload.transition) ? payload.transition : 'none',
          subtitles: payload.subtitles ? {
            language: ['ar', 'en', 'ar-en'].includes(subtitleSettings.language) ? subtitleSettings.language : 'ar',
            fontSize: ['small', 'medium', 'large'].includes(subtitleSettings.fontSize) ? subtitleSettings.fontSize : 'medium',
            position: ['top', 'bottom'].includes(subtitleSettings.position) ? subtitleSettings.position : 'bottom',
            style: ['clean', 'outlined', 'boxed'].includes(subtitleSettings.style) ? subtitleSettings.style : 'clean',
            background: Boolean(subtitleSettings.background),
            alignment: ['left', 'center', 'right'].includes(subtitleSettings.alignment) ? subtitleSettings.alignment : 'center',
          } : null,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status || 502, message: 'تعذر تركيب الفيديو لدى المزود.' };
    const data = await response.json().catch(() => ({}));
    if (!isHttpUrl(data.videoUrl)) return { ok: false, status: 502, message: 'لم يُرجع مزود التركيب رابط فيديو صالحًا.' };
    return { ok: true, status: 200, videoUrl: data.videoUrl };
  } catch (error) {
    return { ok: false, status: 502, message: error?.name === 'AbortError' ? 'انتهت مهلة تركيب الفيديو.' : 'تعذر الاتصال بخدمة تركيب الفيديو.' };
  } finally {
    clearTimeout(timer);
  }
}