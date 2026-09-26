import React, { useRef, useState } from 'react';
import { generateVideo } from '../services/videoGenerator';

const videoModels = ['Seedance 2.0', 'Seedance 2.5'];
const videoDurations = [
  { value: '10s', label: '10s' },
  { value: '15s', label: '15s' },
  { value: '20s', label: '20s' },
  { value: '25s', label: '25s' },
  { value: '30s', label: '30s' },
];
const videoQualities = ['480p', '760p', '1080p', '4K'];
const videoAspectRatios = ['9:16', '16:9', '1:1'];

function DashboardVideoPage() {
  const fileInputRef = useRef(null);
  const [mode, setMode] = useState('image');
  const [selectedModel, setSelectedModel] = useState('Seedance 2.5');
  const [selectedDuration, setSelectedDuration] = useState('15s');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [selectedRatio, setSelectedRatio] = useState('9:16');
  const [referenceImage, setReferenceImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  const canGenerate =
    mode === 'image'
      ? Boolean(referenceImage || prompt.trim())
      : Boolean(prompt.trim());

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setReferenceImage(URL.createObjectURL(file));
    setErrorMessage('');
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

    const response = await generateVideo({
      mode,
      model: selectedModel,
      duration: selectedDuration,
      quality: selectedQuality,
      aspectRatio: selectedRatio,
      prompt,
      referenceImage,
    });

    if (response.status === 'success') {
      setVideoUrl(response.result?.videoUrl || '');
      setStatus('completed');
      return;
    }

    setStatus('error');
    setErrorMessage(response.error || 'تعذر إنشاء الفيديو حاليًا، حاول مرة أخرى.');
  };

  const handleDownload = () => {
    if (!videoUrl) return;

    const link = document.createElement('a');
    link.href = videoUrl;
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
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              ) : (
                <label className="upload-box">
                  <span className="upload-plus">＋</span>
                  <span>أضف صورة مرجعية</span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} />
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
            </div>

            {status === 'idle' && <div className="studio-empty-state">سيظهر الفيديو هنا بعد الإنشاء</div>}

            {status === 'generating' && (
              <div className="loading-row result-loading" aria-live="polite">
                <span className="loading-orb" />
                <span>جاري إنشاء الفيديو...</span>
              </div>
            )}

            {status === 'error' && (
              <div className="result-error-box">
                <div className="error-banner inline-error">تعذر إنشاء الفيديو</div>
                <div className="error-subtext">حاول مرة أخرى</div>
                <button type="button" className="mini-action-btn gold-btn retry-btn" onClick={handleTryAgain}>
                  إعادة المحاولة
                </button>
              </div>
            )}

            {status === 'completed' && videoUrl && (
              <>
                <div className="video-preview-box">
                  <video src={videoUrl} controls playsInline />
                </div>
                <div className="video-actions">
                  <button type="button" className="mini-action-btn gold-btn" onClick={handleDownload}>
                    ⬇️ تحميل الفيديو
                  </button>
                  <button type="button" className="mini-action-btn" onClick={handleGenerate}>
                    ↻ إعادة الإنشاء
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardVideoPage;
