function formatTimestamp(milliseconds) {
  const wholeSeconds = Math.floor(milliseconds / 1000);
  const hours = String(Math.floor(wholeSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(wholeSeconds % 60).padStart(2, '0');
  const millis = String(milliseconds % 1000).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${millis}`;
}

export function generateSubtitles({ text, durationSeconds, language = 'ar', linesPerCue = 8 } = {}) {
  const source = String(text || '').trim();
  const duration = Number(durationSeconds);
  if (!source || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('أدخل نص التعليق ومدة الفيديو لإنشاء الترجمة.');
  }

  const words = source.split(/\s+/).filter(Boolean);
  const cues = [];
  for (let index = 0; index < words.length; index += linesPerCue) {
    cues.push(words.slice(index, index + linesPerCue).join(' '));
  }
  const cueDuration = Math.max(800, Math.floor((duration * 1000) / cues.length));
  const languageTag = ['ar', 'en', 'ar-en'].includes(language) ? language : 'ar';
  const body = cues.map((cue, index) => {
    const start = index * cueDuration;
    const end = Math.min((index + 1) * cueDuration, duration * 1000);
    return `${index + 1}\n${formatTimestamp(start)} --> ${formatTimestamp(Math.max(start + 500, end))}\n${cue}`;
  }).join('\n\n');

  return `WEBVTT\n\nNOTE language: ${languageTag}\n\n${body}\n`;
}

export function downloadSubtitleFile(vtt, filename = 'asharqawi-subtitles.vtt') {
  const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}