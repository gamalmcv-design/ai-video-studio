import React, { useState } from 'react';
import { generateImage } from '../services/imageGenerator';

const imageModels = [
  { value: 'Seedream v5.0 Lite', badge: '✨ جودة عالية وسعر اقتصادي' },
];
const imageSizes = ['1:1', '9:16', '16:9', '4:5', '3:4'];
const imageQualities = ['480p', '720p', '1080p', '4K'];

function DashboardImagePage() {
  const [generationMode, setGenerationMode] = useState('image');
  const [selectedModel, setSelectedModel] = useState('Seedream v5.0 Lite');
  const [selectedSize, setSelectedSize] = useState('1:1');
  const [selectedQuality, setSelectedQuality] = useState('1080p');
  const [referenceImage, setReferenceImage] = useState(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultImage, setResultImage] = useState(null);

  const canGenerate =
    generationMode === 'image'
      ? Boolean(referenceImage || description.trim())
      : Boolean(description.trim());

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setReferenceImage(previewUrl);
    setStatus('idle');
    setErrorMessage('');
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
    setErrorMessage('');
  };

  const handleGenerate = async () => {
    if (!canGenerate) {
      setStatus('error');
      setErrorMessage('يرجى كتابة وصف الصورة أو رفع صورة مرجعية.');
      return;
    }

    setStatus('generating');
    setErrorMessage('');
    setResultImage(null);

    const response = await generateImage({
      mode: generationMode,
      model: selectedModel,
      description,
      aspectRatio: selectedSize,
      quality: selectedQuality,
      referenceImage,
    });

    if (response.status === 'success') {
      setResultImage(response.result?.imageUrl || null);
      setStatus('completed');
      return;
    }

    setStatus('error');
    setErrorMessage(response.error || 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.');
  };

  const handleDownloadImage = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'asharqawi-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveImage = () => {
    handleDownloadImage();
  };

  const handleGoHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const isBusy = status === 'uploading' || status === 'generating';

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

      <main className="container image-page-shell">
        <section className="image-generator-card card">
          <div className="section-heading compact">
            <div>
              <span className="mini-badge">Image</span>
              <h2>توليد الصور</h2>
            </div>
            {status !== 'idle' && (
              <span className="status-badge">
                {status === 'uploading' && 'جارٍ رفع الصورة...'}
                {status === 'generating' && 'جاري إنشاء الصورة...'}
                {status === 'completed' && 'تم إنشاء الصورة'}
                {status === 'error' && 'خطأ'}
              </span>
            )}
          </div>

          <p className="section-subtitle">حوّل فكرتك إلى صورة سينمائية عالية الجودة</p>

          <div className="field-block compact-field">
            <span className="field-label">طريقة إنشاء الصورة</span>
            <div className="mode-switch">
              <button
                type="button"
                className={generationMode === 'image' ? 'mode-option active' : 'mode-option'}
                onClick={() => setGenerationMode('image')}
              >
                <span>🖼</span>
                صورة + وصف
              </button>
              <button
                type="button"
                className={generationMode === 'text' ? 'mode-option active' : 'mode-option'}
                onClick={() => setGenerationMode('text')}
              >
                <span>✦</span>
                وصف فقط
              </button>
            </div>
          </div>

          {generationMode === 'image' && (
            <div className="field-block compact-field">
              <span className="field-label">صورة مرجعية</span>
              {referenceImage ? (
                <div className="image-preview-box">
                  <img src={referenceImage} alt="معاينة الصورة المرجعية" />
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
            <label htmlFor="image-description" className="field-label">
              وصف الصورة
            </label>
            <textarea
              id="image-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="اكتب وصف الصورة التي تريد إنشاءها..."
            />
          </div>

          <div className="field-block compact-field">
            <span className="field-label">النموذج</span>
            <select
              className="compact-select"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value)}
            >
              {imageModels.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.value} — {item.badge}
                </option>
              ))}
            </select>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">مقاس الصورة</span>
            <div className="choice-grid mini-grid">
              {imageSizes.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedSize === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedSize(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">الجودة</span>
            <div className="choice-grid mini-grid">
              {imageQualities.map((item) => (
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

          <button
            type="button"
            className="generate-button image-button"
            onClick={handleGenerate}
            disabled={!canGenerate || isBusy}
          >
            {status === 'generating' ? 'جاري إنشاء الصورة...' : '✦ توليد الصورة'}
          </button>

          <div className="result-box" aria-live="polite">
            <div className="result-box-title">الصورة الناتجة</div>

            {status === 'generating' && (
              <div className="result-loading">
                <span className="loading-orb" />
                <span>جاري إنشاء الصورة...</span>
              </div>
            )}

            {!resultImage && status !== 'generating' && !errorMessage && (
              <div className="result-empty">ستظهر الصورة هنا بعد الإنشاء</div>
            )}

            {errorMessage && !resultImage && <div className="result-error">{errorMessage}</div>}

            {resultImage && (
              <>
                <div className="result-image-wrap">
                  <img src={resultImage} alt="نتيجة توليد الصورة" />
                </div>
                <div className="result-actions">
                  <button type="button" className="mini-action-btn gold-btn" onClick={handleDownloadImage}>
                    ⬇ تحميل الصورة
                  </button>
                  <button type="button" className="mini-action-btn" onClick={handleGenerate}>
                    ↻ إعادة الإنشاء
                  </button>
                  <button type="button" className="mini-action-btn" onClick={handleSaveImage}>
                    حفظ الصورة
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

export default DashboardImagePage;
