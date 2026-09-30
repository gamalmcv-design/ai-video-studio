export async function generateVoice(payload = {}) {
  const { text, voice, language, voiceType, speed } = payload;
  if (!text?.trim() || !voice?.trim()) {
    return { status: 'error', error: 'أدخل النص ومعرّف الصوت.' };
  }

  try {
    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, language, voiceType, speed }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.audioBase64) {
      return { status: 'error', error: data?.message || 'تعذر إنشاء التعليق الصوتي.' };
    }
    return {
      status: 'success',
      audioUrl: `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`,
      mimeType: data.mimeType || 'audio/mpeg',
    };
  } catch (error) {
    return { status: 'error', error: error?.message || 'تعذر الاتصال بخدمة الصوت.' };
  }
}