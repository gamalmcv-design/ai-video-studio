export async function generateMusic(payload = {}) {
  const { preset, durationSeconds, loop } = payload;
  if (!preset || !Number.isInteger(Number(durationSeconds))) {
    return { status: 'error', error: 'أكمل إعدادات الموسيقى أولًا.' };
  }

  try {
    const response = await fetch('/api/music', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, durationSeconds: Number(durationSeconds), loop: Boolean(loop) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (!data?.audioUrl && !data?.audioBase64)) {
      return { status: 'error', error: data?.message || 'تعذر إنشاء الموسيقى.' };
    }
    return {
      status: 'success',
      audioUrl: data.audioUrl || `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`,
      mimeType: data.mimeType || 'audio/mpeg',
    };
  } catch (error) {
    return { status: 'error', error: error?.message || 'تعذر الاتصال بخدمة الموسيقى.' };
  }
}