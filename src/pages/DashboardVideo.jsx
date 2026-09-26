import React, { useState } from 'react';
import { generateVideo } from '../services/videoGenerator';

const videoModels = ['Seedance 2.5', 'سباداتيس 2.0'];
const videoDurations = ['10s', '15s', '20s', '25s', '30s'];
const videoQualities = ['480p', '760p', '1080p', '4K'];
const videoAspectRatios = ['9:16', '16:9', '1:1'];

function DashboardVideoPage() {
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
          ‹ العودة
        </button>
      </header>

      <main className="container image-page-shell video-page-shell">
        <section className="image-generator-card card video-card">
          <div className="section-heading">
            <div>
              <span className="mini-badge">Video</span>
              <h2>توليد الفيديو</h2>
            </div>
            {status !== 'idle' && (
              <span className="status-pill">
                {status === 'generating' ? 'جاري تجهيز الفيديو...' : status === 'completed' ? 'تم الإنشاء' : 'خطأ'}
              </span>
            )}
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
                  <img src={referenceImage} alt="معاينة الفهرس" />
                  <button type="button" className="remove-image" onClick={handleRemoveImage}>
                    حذف
                  </button>
                </div>
              ) : (
                <label className="upload-box">
                  <span className="upload-plus">＋</span>
                  <span>رفع صورة</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
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
              placeholder="اكتب وصف المشهد الذي تريد إنشاءه..."
            />
          </div>

          <div className="field-block compact-field">
            <span className="field-label">النموذج</span>
            <div className="choice-grid">
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
            <span className="field-label">المدة</span>
            <div className="choice-grid mini-grid">
              {videoDurations.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedDuration === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedDuration(item)}
                >
                  {item}
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
            <span className="field-label">مقاس الفيديو</span>
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

          <button type="button" className="generate-button image-button" onClick={handleGenerate} disabled={!canGenerate || status === 'generating'}>
            {status === 'generating' ? 'جاري تجهيز الفيديو...' : '✦ توليد الفيديو'}
          </button>

          {status === 'generating' && (
            <div className="loading-row" aria-live="polite">
              <span className="loading-orb" />
              <span>جاري تجهيز الفيديو...</span>
            </div>
          )}

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          {videoUrl && (
            <div className="result-card">
              <div className="video-preview-box">
                <video src={videoUrl} controls playsInline />
              </div>
              <div className="video-actions">
                <button type="button" className="mini-action-btn gold-btn">
                  حفظ الفيديو
                </button>
                <button type="button" className="mini-action-btn" onClick={handleGenerate}>
                  توليد مرة أخرى
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default DashboardVideoPage;
