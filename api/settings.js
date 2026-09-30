import { getAudioProviderStatuses, getConfiguredVoiceOptions } from '../server/audioService.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'الطريقة غير مسموحة.' });
  return res.status(200).json({
    ok: true,
    providers: {
      image: process.env.AI_GATEWAY_API_KEY ? 'Connected' : 'Not configured',
      video: process.env.VIDEO_PROVIDER_URL && process.env.VIDEO_PROVIDER_API_KEY ? 'Connected' : 'Not configured',
      script: process.env.SCRIPT_PROVIDER_URL && process.env.SCRIPT_PROVIDER_API_KEY && process.env.SCRIPT_MODEL_ID ? 'Connected' : 'Not configured',
      ...getAudioProviderStatuses(),
    },
    voiceOptions: getConfiguredVoiceOptions(),
    models: {
      image: ['Seedream 5.0 Pro'],
      video: ['Seedance 2.5', 'Seedance 2.0'],
      script: ['النموذج المهيأ على الخادم'],
    },
    defaults: {
      image: { aspectRatio: '1:1', quality: '1.5K' },
      video: { duration: '15s', aspectRatio: '9:16', quality: '720p' },
    },
  });
}