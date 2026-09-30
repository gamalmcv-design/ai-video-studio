import React, { useEffect, useState } from 'react';
import { generateImage } from '../services/imageGenerator';
import { getStudioAsset, saveStudioAsset, saveStudioTask } from '../services/studioLibrary';

const imageModels = [
  { value: 'Seedream 5.0 Pro', badge: '✨ جودة عالية وسعر اقتصادي' },
];
const imageSizes = ['16:9', '9:16', '1:1', '3:4', '4:5'];
const imageQualities = ['1K', '1.5K', '2K'];
const MAX_IMAGE_REFERENCE_BYTES = 3 * 1024 * 1024;

const imageQualityMap = {
  '1K': {
    '16:9': '1280x720',
    '9:16': '720x1280',
    '1:1': '1024x1024',
    '3:4': '1024x1366',
    '4:5': '1024x1280',
  },
  '1.5K': {
    '16:9': '1536x864',
    '9:16': '864x1536',
    '1:1': '1536x1536',
    '3:4': '1368x1824',
    '4:5': '1440x1800',
  },
  '2K': {
    '16:9': '2048x1152',
    '9:16': '1152x2048',
    '1:1': '2048x2048',
    '3:4': '1536x2048',
    '4:5': '1638x2048',
  },
};

function DashboardImagePage() {
  const [generationMode, setGenerationMode] = useState('image');
  const [selectedModel, setSelectedModel] = useState('Seedream 5.0 Pro');
  const [selectedSize, setSelectedSize] = useState('1:1');
  const [selectedQuality, setSelectedQuality] = useState('1.5K');
  const [referenceImage, setReferenceImage] = useState(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultImage, setResultImage] = useState(null);

  useEffect(() => {
    const assetId = sessionStorage.getItem('asharqawi-selected-image-asset');
    if (!assetId) return;
    sessionStorage.removeItem('asharqawi-selected-image-asset');
    getStudioAsset(assetId).then((asset) => {
      if (!asset?.blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setReferenceImage(reader.result);
          setGenerationMode('image');
        }
      };
      reader.readAsDataURL(asset.blob);
    }).catch(() => setErrorMessage('تعذر فتح المادة من المكتبة.'));
  }, []);

  const canGenerate =
    generationMode === 'image'
      ? Boolean(referenceImage || description.trim())
      : Boolean(description.trim());

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > MAX_IMAGE_REFERENCE_BYTES) {
      setStatus('error');
      setErrorMessage('ارفع صورة صالحة لا يتجاوز حجمها 3 ميجابايت لضمان إرسالها إلى خدمة التوليد.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = typeof reader.result === 'string' ? reader.result : null;
      if (!imageDataUrl) {
        setStatus('error');
        setErrorMessage('تعذر قراءة الصورة المرجعية.');
        return;
      }

      setReferenceImage(imageDataUrl);
      setStatus('idle');
      setErrorMessage('');
    };
    reader.onerror = () => {
      setStatus('error');
      setErrorMessage('تعذر قراءة الصورة المرجعية.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setReferenceImage(null);
    setErrorMessage('');
  };

  const resolvedImageSize = imageQualityMap[selectedQuality]?.[selectedSize] || null;

  const handleGenerate = async () => {
    if (!canGenerate) {
      setStatus('error');
      setErrorMessage('يرجى كتابة وصف الصورة أو رفع صورة مرجعية.');
      return;
    }

    if (!resolvedImageSize) {
      setStatus('error');
      setErrorMessage('هذا الإعداد غير مدعوم حاليًا بواسطة Seedream 5.0 Pro.');
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
      size: resolvedImageSize,
      referenceImage,
    });

    if (response.status === 'success') {
      const imageUrl = response.result?.imageUrl || null;
      setResultImage(imageUrl);
      setStatus('completed');
      const asset = imageUrl
        ? await saveStudioAsset(imageUrl, {
            name: `asharqawi-image-${Date.now()}.png`,
            type: 'image',
            allowGeneratedImage: true,
          }).catch(() => null)
        : null;
      saveStudioTask({
        type: 'image',
        title: description.slice(0, 80) || 'صورة مولدة',
        status: 'completed',
        payload: { description, model: selectedModel, aspectRatio: selectedSize, quality: selectedQuality },
        result: { assetId: asset?.id || null },
      });
      return;
    }

    setStatus('error');
    setErrorMessage(response.error || 'تعذر إنشاء الصورة حاليًا، حاول مرة أخرى.');
    saveStudioTask({
      type: 'image',
      title: description.slice(0, 80) || 'صورة مولدة',
      status: 'failed',
      payload: { description, model: selectedModel, aspectRatio: selectedSize, quality: selectedQuality },
      error: response.error || null,
    });
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
            <div className="selection-scroll image-selection-scroll">
              <div className="image-choice-grid">
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
          </div>

          <div className="field-block compact-field">
            <span className="field-label">الجودة</span>
            <div className="selection-scroll image-selection-scroll">
              <div className="image-choice-grid quality-choice-grid">
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
            <div className="result-box-head">
              <div className="result-box-title">الصورة الناتجة</div>
              <div className="result-meta">
                <span>{selectedSize}</span>
                <span>•</span>
                <span>{selectedQuality}</span>
                <span>•</span>
                <span>Seedream 5.0 Pro</span>
              </div>
            </div>

            {status === 'generating' && (
              <div className="result-stage result-stage-loading" style={{ aspectRatio: selectedSize.replace(':', ' / ') }}>
                <span className="loading-orb" />
                <span>جاري إنشاء الصورة...</span>
              </div>
            )}

            {!resultImage && status !== 'generating' && !errorMessage && (
              <div className="result-stage result-stage-empty" style={{ aspectRatio: selectedSize.replace(':', ' / ') }}>
                <div>
                  <div className="result-stage-label">مساحة استلام الصورة</div>
                  <div className="result-stage-subtitle">ستظهر النتيجة هنا بالحجم والنسبة المحددين</div>
                </div>
              </div>
            )}

            {errorMessage && !resultImage && (
              <div className="result-stage result-stage-error" style={{ aspectRatio: selectedSize.replace(':', ' / ') }}>
                {errorMessage}
              </div>
            )}

            {resultImage && (
              <>
                <div className="result-stage result-stage-image" style={{ aspectRatio: selectedSize.replace(':', ' / ') }}>
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
