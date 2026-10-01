import React, { useEffect, useRef, useState } from 'react';
import { generateVideo } from '../services/videoGenerator';
import { generateVoice } from '../services/voiceGenerator';
import { generateMusic } from '../services/musicGenerator';
import { generateSubtitles, downloadSubtitleFile } from '../services/subtitleGenerator';
import { composeVideo } from '../services/videoComposer';
import { getStudioAsset, saveStudioAsset, saveStudioTask } from '../services/studioLibrary';

const videoModels = ['Seedance 2.0', 'Seedance 2.5'];
const videoDurations = [
  { value: '10s', label: '10s' },
  { value: '15s', label: '15s' },
  { value: '20s', label: '20s' },
  { value: '25s', label: '25s' },
  { value: '30s', label: '30s' },
];
const videoQualities = ['480p', '720p'];
const videoAspectRatios = ['9:16', '16:9', '1:1'];
const MAX_VIDEO_REFERENCE_BYTES = 3 * 1024 * 1024;
const musicStyles = [
  { value: 'none', label: 'بدون موسيقى' },
  { value: 'cinematic', label: 'سينمائية' },
  { value: 'energetic', label: 'حماسية' },
  { value: 'dramatic', label: 'درامية' },
  { value: 'calm', label: 'هادئة' },
  { value: 'advertising', label: 'إعلانية' },
];

function DashboardVideoPage() {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('image');
  const [selectedModel, setSelectedModel] = useState('Seedance 2.5');
  const [selectedDuration, setSelectedDuration] = useState('15s');
  const [selectedQuality, setSelectedQuality] = useState('720p');
  const [selectedRatio, setSelectedRatio] = useState('9:16');
  const [referenceImage, setReferenceImage] = useState(null);
  const [prompt, setPrompt] = useState(() => {
    const scriptPrompt = sessionStorage.getItem('asharqawi-video-prompt') || '';
    if (scriptPrompt) sessionStorage.removeItem('asharqawi-video-prompt');
    return scriptPrompt;
  });
  const [status, setStatus] = useState('idle');
  const [generationStage, setGenerationStage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [generatedVideos, setGeneratedVideos] = useState([]);
  const [batchCount, setBatchCount] = useState('1');
  const [voiceText, setVoiceText] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('ar');
  const [voiceType, setVoiceType] = useState('female');
  const [voiceOptions, setVoiceOptions] = useState([]);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [voiceUrl, setVoiceUrl] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('idle');
  const [musicPreset, setMusicPreset] = useState('none');
  const [musicUrl, setMusicUrl] = useState('');
  const [musicStatus, setMusicStatus] = useState('idle');
  const [musicVolume, setMusicVolume] = useState(0.3);
  const [fadeInSeconds, setFadeInSeconds] = useState(1);
  const [fadeOutSeconds, setFadeOutSeconds] = useState(1);
  const [musicLoop, setMusicLoop] = useState(false);
  const [subtitleLanguage, setSubtitleLanguage] = useState('ar');
  const [subtitleText, setSubtitleText] = useState('');
  const [subtitleVtt, setSubtitleVtt] = useState('');
  const [subtitleFontSize, setSubtitleFontSize] = useState('medium');
  const [subtitlePosition, setSubtitlePosition] = useState('bottom');
  const [subtitleStyle, setSubtitleStyle] = useState('clean');
  const [subtitleBackground, setSubtitleBackground] = useState(true);
  const [subtitleAlignment, setSubtitleAlignment] = useState('center');
  const [compositionStatus, setCompositionStatus] = useState('idle');
  const [transition, setTransition] = useState('fade');
  const [providerStatuses, setProviderStatuses] = useState({});
  const [studioMessage, setStudioMessage] = useState('');

  useEffect(() => {
    const selectedVideoUrl = sessionStorage.getItem('asharqawi-selected-video-url');
    const selectedAudioUrl = sessionStorage.getItem('asharqawi-selected-audio-url');
    const selectedSubtitles = sessionStorage.getItem('asharqawi-selected-subtitles');
    if (selectedVideoUrl) {
      sessionStorage.removeItem('asharqawi-selected-video-url');
      setVideoUrl(selectedVideoUrl);
      setGeneratedVideos([selectedVideoUrl]);
      setStatus('completed');
    }
    if (selectedAudioUrl) {
      sessionStorage.removeItem('asharqawi-selected-audio-url');
      setMusicUrl(selectedAudioUrl);
      setMusicPreset('cinematic');
    }
    if (selectedSubtitles) {
      sessionStorage.removeItem('asharqawi-selected-subtitles');
      setSubtitleVtt(selectedSubtitles);
      setSubtitleLanguage('ar');
    }
    fetch('/api/settings')
      .then((response) => response.json())
      .then((data) => {
        setProviderStatuses(data.providers || {});
        setVoiceOptions(data.voiceOptions || []);
      })
      .catch(() => {
        setProviderStatuses({});
        setVoiceOptions([]);
      });
  }, []);

  const availableVoiceOptions = voiceOptions.filter((option) => option.language === voiceLanguage && option.type === voiceType);

  useEffect(() => {
    const scriptPrompt = sessionStorage.getItem('asharqawi-video-prompt') || '';
    if (scriptPrompt) {
      sessionStorage.removeItem('asharqawi-video-prompt');
      setPrompt(scriptPrompt);
    }
  }, []);

  const canGenerate =
    mode === 'image'
      ? Boolean(referenceImage || prompt.trim())
      : Boolean(prompt.trim());

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_VIDEO_REFERENCE_BYTES) {
      setErrorMessage('ارفع صورة PNG أو JPEG أو WebP لا يتجاوز حجمها 3 ميجابايت.');
      setStatus('error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${file.type};base64,`)) {
        setErrorMessage('تعذر تجهيز الصورة المرجعية للإرسال.');
        setStatus('error');
        return;
      }
      setReferenceImage(reader.result);
      setErrorMessage('');
      setStatus('idle');
      event.target.value = '';
    };
    reader.onerror = () => {
      setErrorMessage('تعذر قراءة الصورة المرجعية.');
      setStatus('error');
      event.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
    setErrorMessage('');
  };

  const handleReplaceImage = () => {
    fileInputRef.current?.click();
  };

  const handleGenerate = async () => {
    if (!selectedModel) {
      setErrorMessage('يرجى اختيار موديل الفيديو.');
      setStatus('error');
      return;
    }

    if (!canGenerate) {
      setErrorMessage('يرجى كتابة وصف الفيديو أو رفع صورة مرجعية.');
      setStatus('error');
      return;
    }

    setStatus('generating');
    setErrorMessage('');
    setVideoUrl('');
    setGeneratedVideos([]);
    setStudioMessage('يتم إرسال الطلب إلى محرك الفيديو...');

    const generationPayload = {
      mode,
      model: selectedModel,
      duration: selectedDuration,
      quality: selectedQuality,
      aspectRatio: selectedRatio,
      prompt,
      referenceImage: mode === 'image' ? referenceImage : null,
    };
    const outputs = [];
    const count = Number(batchCount);
    let batchError = '';

    for (let index = 0; index < count; index += 1) {
      setStudioMessage(count > 1 ? `إنشاء النتيجة ${index + 1} من ${count}` : 'يتم إرسال الطلب إلى محرك الفيديو...');
      const response = await generateVideo(generationPayload, (stage) => {
        const stageLabels = {
          preparing: 'تجهيز الطلب',
          generating: 'أُرسل الطلب، محرك الفيديو يعالجه',
          finalizing: 'استلام النتيجة والتحقق منها',
        };
        setStudioMessage(count > 1 ? `النتيجة ${index + 1} من ${count}: ${stageLabels[stage] || ''}` : stageLabels[stage] || '');
        setGenerationStage(stage);
      });

      if (response.status !== 'success') {
        const error = response.error || 'تعذر إنشاء الفيديو حاليًا، حاول مرة أخرى.';
        saveStudioTask({
          type: 'video',
          title: prompt.slice(0, 80) || 'فيديو مولد',
          status: 'failed',
          payload: generationPayload,
          error,
        });
        if (outputs.length === 0) {
          setStatus('error');
          setGenerationStage('failed');
          setErrorMessage(error);
          setStudioMessage('');
          return;
        }
        batchError = error;
        break;
      }

      const generatedVideoUrl = response.result?.videoUrl;
      if (!generatedVideoUrl) continue;
      outputs.push(generatedVideoUrl);
      setGeneratedVideos([...outputs]);
      if (index === 0) setVideoUrl(generatedVideoUrl);
      const asset = await saveStudioAsset(generatedVideoUrl, {
        name: `asharqawi-video-${Date.now()}-${index + 1}.mp4`,
        type: 'video',
      }).catch(() => null);
      saveStudioTask({
        type: 'video',
        title: prompt.slice(0, 80) || `فيديو ${index + 1}`,
        status: 'completed',
        payload: generationPayload,
        result: { assetId: asset?.id || null, url: generatedVideoUrl },
      });
    }

    if (outputs.length > 0) {
      setStatus('completed');
      setGenerationStage('completed');
      setStudioMessage(batchError
        ? `تم إنشاء ${outputs.length} من ${count} فيديو. تعذر إكمال الباقي: ${batchError}`
        : `اكتمل إنشاء ${outputs.length} من ${count} فيديو.`);
    }
  };

  const handleGenerateVoice = async () => {
    setVoiceStatus('generating');
    setStudioMessage('');
    const result = await generateVoice({
      text: voiceText || prompt,
      voice: voiceId,
      language: voiceLanguage,
      voiceType,
      speed: Number(voiceSpeed),
    });
    if (result.status !== 'success') {
      setVoiceStatus('error');
      setStudioMessage(result.error);
      return;
    }
    setVoiceUrl(result.audioUrl);
    setVoiceStatus('completed');
    await saveStudioAsset(result.audioUrl, { name: `voice-${Date.now()}.mp3`, type: 'audio' }).catch(() => null);
  };

  const handleGenerateMusic = async () => {
    if (musicPreset === 'none') {
      setMusicUrl('');
      setMusicStatus('idle');
      return;
    }
    setMusicStatus('generating');
    setStudioMessage('');
    const result = await generateMusic({
      preset: musicPreset,
      durationSeconds: Number(selectedDuration.replace(/\D/g, '')),
      loop: musicLoop,
    });
    if (result.status !== 'success') {
      setMusicStatus('error');
      setStudioMessage(result.error);
      return;
    }
    setMusicUrl(result.audioUrl);
    setMusicStatus('completed');
    await saveStudioAsset(result.audioUrl, { name: `music-${Date.now()}.mp3`, type: 'audio' }).catch(() => null);
  };

  const handleGenerateSubtitles = async () => {
    try {
      const vtt = generateSubtitles({
        text: subtitleText || voiceText || prompt,
        durationSeconds: Number(selectedDuration.replace(/\D/g, '')),
        language: subtitleLanguage,
      });
      setSubtitleVtt(vtt);
      setStudioMessage('تم تجهيز ملف الترجمة. التوقيت موزع بالتساوي على مدة الفيديو.');
      await saveStudioAsset(new Blob([vtt], { type: 'text/vtt;charset=utf-8' }), {
        name: `subtitles-${Date.now()}.vtt`,
        type: 'subtitle',
      }).catch(() => null);
    } catch (error) {
      setStudioMessage(error?.message || 'تعذر إنشاء الترجمة.');
    }
  };

  const handleComposeVideo = async () => {
    setCompositionStatus('generating');
    const result = await composeVideo({
      videoUrl,
      voiceUrl: voiceUrl || null,
      musicUrl: musicUrl || null,
      subtitles: subtitleVtt || null,
      volume: Number(musicVolume),
      fadeInSeconds: Number(fadeInSeconds),
      fadeOutSeconds: Number(fadeOutSeconds),
      transition,
      subtitleSettings: {
        language: subtitleLanguage,
        fontSize: subtitleFontSize,
        position: subtitlePosition,
        style: subtitleStyle,
        background: subtitleBackground,
        alignment: subtitleAlignment,
      },
    });
    if (result.status !== 'success') {
      setCompositionStatus('error');
      setStudioMessage(result.error);
      return;
    }
    setVideoUrl(result.videoUrl);
    setCompositionStatus('completed');
    setStudioMessage('اكتمل تركيب الفيديو.');
  };

  const handleSaveProject = () => {
    saveStudioTask({
      type: 'project',
      title: prompt.slice(0, 80) || 'مشروع فيديو',
      status: videoUrl ? 'completed' : 'draft',
      payload: { prompt, model: selectedModel, duration: selectedDuration, quality: selectedQuality, aspectRatio: selectedRatio },
      result: videoUrl ? { url: videoUrl } : null,
    });
    setStudioMessage('تم حفظ المشروع في السجل المحلي لهذا الجهاز.');
  };

  const handleNewVideo = () => {
    setPrompt('');
    setVideoUrl('');
    setGeneratedVideos([]);
    setStatus('idle');
    setGenerationStage('');
    setErrorMessage('');
    setStudioMessage('');
    setVoiceUrl('');
    setMusicUrl('');
    setSubtitleVtt('');
  };

  const handleDownload = (targetUrl = videoUrl) => {
    if (!targetUrl) return;

    const link = document.createElement('a');
    link.href = targetUrl;
    link.download = 'manassat-elsharqawy-video.mp4';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTryAgain = () => {
    setErrorMessage('');
    setStatus('idle');
  };

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="dashboard-shell">
      <div className="background-glow glow-gold" />
      <div className="background-glow glow-cyan" />

      <header className="topbar container">
        <div className="brand-wrap" aria-label="شعار منصة الشرقاوي">
          <div className="brand-mark">
            <span>م</span>
          </div>
          <div className="brand-copy">
            <small>منصة</small>
            <strong>الشرقاوي</strong>
          </div>
        </div>
        <button type="button" className="ghost-button" onClick={handleGoHome}>
          ← الرئيسية
        </button>
      </header>

      <main className="container image-page-shell video-page-shell">
        <section className="image-generator-card card video-card">
          <div className="video-studio-header">
            <button type="button" className="studio-back-btn" onClick={handleGoHome}>
              ← الرئيسية
            </button>
            <div className="studio-heading-wrap">
              <span className="mini-badge">Video</span>
              <h2>توليد الفيديو</h2>
            </div>
          </div>

          <p className="studio-subtitle">حوّل فكرتك إلى فيديو سينمائي بالذكاء الاصطناعي</p>

          <div className="field-block compact-field">
            <span className="field-label">النموذج</span>
            <div className="choice-grid model-grid">
              {videoModels.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedModel === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedModel(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">طريقة إنشاء الفيديو</span>
            <div className="mode-switch">
              <button
                type="button"
                className={mode === 'image' ? 'mode-option active' : 'mode-option'}
                onClick={() => setMode('image')}
              >
                <span>🖼</span>
                صورة + وصف
              </button>
              <button
                type="button"
                className={mode === 'text' ? 'mode-option active' : 'mode-option'}
                onClick={() => setMode('text')}
              >
                <span>✦</span>
                وصف فقط
              </button>
            </div>
          </div>

          {mode === 'image' && (
            <div className="field-block compact-field">
              <span className="field-label">صورة مرجعية</span>
              {referenceImage ? (
                <div className="image-preview-box">
                  <img src={referenceImage} alt="معاينة الصورة المرجعية" />
                  <div className="image-inline-actions">
                    <button type="button" className="remove-image" onClick={handleReplaceImage}>
                      تغيير الصورة
                    </button>
                    <button type="button" className="remove-image danger" onClick={handleRemoveImage}>
                      حذف
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <label className="upload-box">
                  <span className="upload-plus">＋</span>
                  <span>أضف صورة مرجعية</span>
                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          )}

          <div className="field-block compact-field">
            <label htmlFor="video-prompt" className="field-label">
              وصف الفيديو
            </label>
            <textarea
              id="video-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="اكتب وصف الفيديو بالتفصيل..."
            />
          </div>

          <div className="field-block compact-field">
            <span className="field-label">المدة</span>
            <div className="choice-grid mini-grid">
              {videoDurations.map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={selectedDuration === item.value ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedDuration(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">الجودة</span>
            <div className="choice-grid mini-grid">
              {videoQualities.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedQuality === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedQuality(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">المقاس</span>
            <div className="choice-grid mini-grid">
              {videoAspectRatios.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedRatio === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedRatio(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <label className="field-label" htmlFor="video-batch-count">عدد النتائج</label>
            <select id="video-batch-count" className="compact-select" value={batchCount} onChange={(event) => setBatchCount(event.target.value)}>
              <option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>

          <details className="studio-tools-panel">
            <summary>التعليق الصوتي</summary>
            <div className="studio-tool-content">
              <label className="field-label" htmlFor="voice-text">نص التعليق</label>
              <textarea id="voice-text" value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="اكتب أو الصق نص التعليق الصوتي..." />
              {voiceOptions.length > 0 && <div className="studio-inline-fields">
                <label>اللغة <select value={voiceLanguage} onChange={(event) => { setVoiceLanguage(event.target.value); setVoiceId(''); }}>{[...new Set(voiceOptions.map((option) => option.language))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                <label>نوع الصوت <select value={voiceType} onChange={(event) => { setVoiceType(event.target.value); setVoiceId(''); }}>{[...new Set(voiceOptions.map((option) => option.type))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              </div>}
              <label className="field-label" htmlFor="voice-id">الصوت</label>
              {voiceOptions.length > 0 ? (
                <select id="voice-id" className="compact-select" value={voiceId} onChange={(event) => {
                  const option = voiceOptions.find((item) => item.id === event.target.value);
                  setVoiceId(option?.id || '');
                  if (option) { setVoiceLanguage(option.language); setVoiceType(option.type); }
                }}>
                  <option value="">اختر صوتًا</option>
                  {availableVoiceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              ) : <input id="voice-id" className="compact-select" value={voiceId} onChange={(event) => setVoiceId(event.target.value)} placeholder="يتوفر بعد إعداد الأصوات في الخادم" />}
              <label className="field-label" htmlFor="voice-speed">سرعة الإلقاء: {voiceSpeed}×</label>
              <input id="voice-speed" type="range" min="0.5" max="2" step="0.1" value={voiceSpeed} onChange={(event) => setVoiceSpeed(event.target.value)} />
              <button type="button" className="mini-action-btn gold-btn" onClick={handleGenerateVoice} disabled={voiceStatus === 'generating' || !voiceText.trim() && !prompt.trim() || providerStatuses.voice !== 'Connected'}>
                {voiceStatus === 'generating' ? 'جارٍ إنشاء الصوت...' : 'إنشاء التعليق الصوتي'}
              </button>
              {voiceUrl && <audio className="studio-audio-preview" src={voiceUrl} controls />}
              {providerStatuses.voice !== 'Connected' && <small className="helper-note">مزود الصوت غير مهيأ. الإعدادات خادمية فقط.</small>}
            </div>
          </details>

          <details className="studio-tools-panel">
            <summary>الموسيقى الخلفية</summary>
            <div className="studio-tool-content">
              <label className="field-label" htmlFor="music-preset">النمط</label>
              <select id="music-preset" className="compact-select" value={musicPreset} onChange={(event) => setMusicPreset(event.target.value)}>
                {musicStyles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <label className="field-label" htmlFor="music-volume">مستوى الموسيقى: {Math.round(musicVolume * 100)}%</label>
              <input id="music-volume" type="range" min="0" max="1" step="0.05" value={musicVolume} onChange={(event) => setMusicVolume(event.target.value)} />
              <div className="studio-inline-fields">
                <label>دخول تدريجي <input type="number" min="0" max="10" value={fadeInSeconds} onChange={(event) => setFadeInSeconds(event.target.value)} /></label>
                <label>خروج تدريجي <input type="number" min="0" max="10" value={fadeOutSeconds} onChange={(event) => setFadeOutSeconds(event.target.value)} /></label>
              </div>
              <label className="studio-check"><input type="checkbox" checked={musicLoop} onChange={(event) => setMusicLoop(event.target.checked)} /> تكرار الموسيقى عند الحاجة</label>
              <button type="button" className="mini-action-btn gold-btn" onClick={handleGenerateMusic} disabled={musicStatus === 'generating' || musicPreset === 'none' || providerStatuses.music !== 'Connected'}>
                {musicStatus === 'generating' ? 'جارٍ الإنشاء...' : 'إنشاء الموسيقى'}
              </button>
              {musicUrl && <audio className="studio-audio-preview" src={musicUrl} controls />}
              {providerStatuses.music !== 'Connected' && <small className="helper-note">مزود الموسيقى غير مهيأ. لا توجد ملفات موسيقى مضمّنة.</small>}
            </div>
          </details>

          <details className="studio-tools-panel">
            <summary>الترجمة والتجميع</summary>
            <div className="studio-tool-content">
              <label className="field-label" htmlFor="subtitle-language">لغة الترجمة</label>
              <select id="subtitle-language" className="compact-select" value={subtitleLanguage} onChange={(event) => setSubtitleLanguage(event.target.value)}>
                <option value="none">بدون ترجمة</option><option value="ar">العربية</option><option value="en">English</option><option value="ar-en">عربي + English</option>
              </select>
              {subtitleLanguage !== 'none' && <>
                <label className="field-label" htmlFor="subtitle-text">نص الترجمة</label>
                <textarea id="subtitle-text" value={subtitleText} onChange={(event) => setSubtitleText(event.target.value)} placeholder="يستخدم نص التعليق أو الوصف افتراضيًا..." />
                <div className="studio-inline-fields">
                  <label>الحجم <select value={subtitleFontSize} onChange={(event) => setSubtitleFontSize(event.target.value)}><option value="small">صغير</option><option value="medium">متوسط</option><option value="large">كبير</option></select></label>
                  <label>الموضع <select value={subtitlePosition} onChange={(event) => setSubtitlePosition(event.target.value)}><option value="bottom">أسفل</option><option value="top">أعلى</option></select></label>
                  <label>النمط <select value={subtitleStyle} onChange={(event) => setSubtitleStyle(event.target.value)}><option value="clean">نظيف</option><option value="outlined">محدد</option><option value="boxed">داخل خلفية</option></select></label>
                  <label>المحاذاة <select value={subtitleAlignment} onChange={(event) => setSubtitleAlignment(event.target.value)}><option value="center">وسط</option><option value="right">يمين</option><option value="left">يسار</option></select></label>
                </div>
                <label className="studio-check"><input type="checkbox" checked={subtitleBackground} onChange={(event) => setSubtitleBackground(event.target.checked)} /> خلفية للترجمة</label>
                <button type="button" className="mini-action-btn" onClick={handleGenerateSubtitles}>إنشاء ملف WebVTT</button>
                {subtitleVtt && <button type="button" className="mini-action-btn" onClick={() => downloadSubtitleFile(subtitleVtt)}>تحميل الترجمة</button>}
              </>}
              {videoUrl && <button type="button" className="mini-action-btn gold-btn" onClick={handleComposeVideo} disabled={compositionStatus === 'generating' || providerStatuses.composer !== 'Connected'}>{compositionStatus === 'generating' ? 'جارٍ تركيب الفيديو...' : 'تركيب وتصدير الفيديو'}</button>}
              <label className="field-label" htmlFor="video-transition">الانتقال بين المشاهد</label>
              <select id="video-transition" className="compact-select" value={transition} onChange={(event) => setTransition(event.target.value)}><option value="none">بدون انتقال</option><option value="fade">تلاشي</option><option value="dissolve">مزج تدريجي</option></select>
              {providerStatuses.composer !== 'Connected' && <small className="helper-note">محرك التركيب غير مهيأ؛ لم يتم تركيب الصوت أو الترجمة داخل الفيديو.</small>}
            </div>
          </details>

          <button
            type="button"
            className="generate-button image-button"
            onClick={handleGenerate}
            disabled={!canGenerate || status === 'generating'}
          >
            {status === 'generating' ? 'جاري تجهيز الفيديو...' : '✦ توليد الفيديو'}
          </button>

          <div className="result-card compact-result-card">
            <div className="result-header-row">
              <h3>الفيديو الناتج</h3>
              <span className={`generation-state ${generationStage || status}`}>{generationStage || status}</span>
            </div>

            {status === 'idle' && <div className="studio-empty-state">سيظهر الفيديو هنا بعد الإنشاء</div>}

            {status === 'generating' && (
              <div className="generation-progress" aria-live="polite">
                <div className="loading-row result-loading">
                  <span className="loading-orb" />
                  <span>{studioMessage || 'جاري إنشاء الفيديو...'}</span>
                </div>
                <div className="generation-steps">
                  {['preparing', 'generating', 'finalizing'].map((step) => <span key={step} className={['preparing', 'generating', 'finalizing'].indexOf(generationStage) >= ['preparing', 'generating', 'finalizing'].indexOf(step) ? 'reached' : ''}>{step}</span>)}
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="result-error-box">
                <div className="error-banner inline-error">{errorMessage || 'تعذر إنشاء الفيديو'}</div>
                <div className="error-subtext">تحقق من الإعدادات ثم حاول مرة أخرى</div>
                <button type="button" className="mini-action-btn gold-btn retry-btn" onClick={handleTryAgain}>
                  إعادة المحاولة
                </button>
              </div>
            )}

            {status === 'completed' && videoUrl && (
              <>
                {(generatedVideos.length ? generatedVideos : [videoUrl]).map((url, index) => (
                  <div className="video-output-item" key={`${url}-${index}`}>
                    <div className="video-output-label">النتيجة {index + 1}</div>
                    <div className="video-preview-box">
                      <video src={url} controls playsInline />
                    </div>
                    <button type="button" className="mini-action-btn" onClick={() => handleDownload(url)}>تحميل هذه النتيجة</button>
                  </div>
                ))}
                <div className="video-actions">
                  <button type="button" className="mini-action-btn" onClick={handleGenerate}>
                    ↻ إعادة الإنشاء
                  </button>
                  <button type="button" className="mini-action-btn" onClick={handleSaveProject}>حفظ المشروع</button>
                  <button type="button" className="mini-action-btn" onClick={handleNewVideo}>توليد فيديو جديد</button>
                </div>
              </>
            )}
          </div>
          {studioMessage && status !== 'generating' && <div className="studio-notice" role="status">{studioMessage}</div>}
        </section>
      </main>
    </div>
  );
}

export default DashboardVideoPage;
