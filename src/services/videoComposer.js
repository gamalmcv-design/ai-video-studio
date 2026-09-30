export async function composeVideo(payload = {}) {
  if (!payload.videoUrl) return { status: 'error', error: 'أنشئ الفيديو الأساسي أولًا.' };
  try {
    const response = await fetch('/api/compose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.videoUrl) {
      return { status: 'error', error: data?.message || 'تعذر تركيب الفيديو.' };
    }
    return { status: 'success', videoUrl: data.videoUrl };
  } catch (error) {
    return { status: 'error', error: error?.message || 'تعذر الاتصال بخدمة تركيب الفيديو.' };
  }
}