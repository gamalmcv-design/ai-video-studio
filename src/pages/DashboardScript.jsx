import React, { useRef, useState } from 'react';
import { generateScript } from '../services/scriptGenerator';

const contentTypes = [
  '🎬 سيناريو فيديو',
  '📱 محتوى سوشيال ميديا',
  '📢 إعلان',
  '🎥 مشهد سينمائي',
  '📖 قصة قصيرة',
  '🎙️ تعليق صوتي',
];

const scriptDurations = ['15 ثانية', '30 ثانية', '60 ثانية', '90 ثانية', '2 دقيقة', '5 دقائق'];
const scriptStyles = ['سينمائي', 'فاخر', 'حماسي', 'درامي', 'كوميدي', 'إعلاني', 'وثائقي'];
const scriptLanguages = ['العربية', 'English', 'عربي + English'];
const detailLevels = ['مختصر', 'متوازن', 'احترافي'];

function DashboardScriptPage() {
  const ideaInputRef = useRef(null);
  const [selectedType, setSelectedType] = useState('🎬 سيناريو فيديو');
  const [idea, setIdea] = useState('');
  const [duration, setDuration] = useState('30 ثانية');
  const [style, setStyle] = useState('فاخر');
  const [language, setLanguage] = useState('العربية');
  const [detailLevel, setDetailLevel] = useState('متوازن');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState(null);
  const [copiedSceneIndex, setCopiedSceneIndex] = useState(null);

  const canGenerate = idea.trim().length > 0;

  const handleGenerate = async () => {
    const cleanIdea = idea.trim();
    if (!cleanIdea) {
      setStatus('error');
      setErrorMessage('يرجى كتابة فكرة السكريبت.');
      return;
    }

    setStatus('generating');
    setErrorMessage('');

    const response = await generateScript({
      type: selectedType,
      idea: cleanIdea,
      duration,
      style,
      language,
      detailLevel,
    });

    if (response.status === 'success') {
      setResult(response.result);
      setStatus('completed');
      return;
    }

    setStatus('error');
    setErrorMessage(response.error || 'تعذر إنشاء السكريبت حاليًا، حاول مرة أخرى.');
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = `العنوان: ${result.title}\n\nالمقدمة: ${result.hook}\n\nالمشاهد:\n${result.scenes
      .map((scene, index) => `${index + 1}. ${scene}`)
      .join('\n')}\n\nالتعليق الصوتي:\n${result.voiceover}\n\nالخاتمة:\n${result.ending}\n\n${result.cta}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // noop
    }
  };

  const handleSave = () => {
    if (!result) return;
    const text = `العنوان: ${result.title}\n\nالمقدمة: ${result.hook}\n\nالمشاهد:\n${result.scenes
      .map((scene, index) => `${index + 1}. ${scene}`)
      .join('\n')}\n\nالتعليق الصوتي:\n${result.voiceover}\n\nالخاتمة:\n${result.ending}\n\n${result.cta}`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'script-asharqawi.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    setResult(null);
    setStatus('idle');
    setErrorMessage('');
    ideaInputRef.current?.focus();
  };

  const handleCopyScene = async (scene, index) => {
    try {
      await navigator.clipboard.writeText(scene);
      setCopiedSceneIndex(index);
      window.setTimeout(() => {
        setCopiedSceneIndex((currentIndex) => (currentIndex === index ? null : currentIndex));
      }, 1200);
    } catch (error) {
      // noop
    }
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

      <main className="container image-page-shell script-page-shell">
        <section className="image-generator-card card script-generator-card">
          <div className="section-heading">
            <div>
              <span className="mini-badge">Script</span>
              <h2>صناعة الأفكار</h2>
            </div>
            {status !== 'idle' && (
              <span className="status-badge">
                {status === 'generating' && 'جاري كتابة السكريبت...'}
                {status === 'completed' && 'تم الإنشاء'}
                {status === 'error' && 'خطأ'}
              </span>
            )}
          </div>

          <p className="section-subtitle">حوّل فكرتك إلى سيناريو احترافي جاهز للتنفيذ</p>

          <div className="field-block compact-field">
            <span className="field-label">نوع المحتوى</span>
            <div className="choice-grid script-grid">
              {contentTypes.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={selectedType === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setSelectedType(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">فكرة السكريبت</span>
            <textarea
              ref={ideaInputRef}
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="اكتب فكرتك هنا..."
            />
            <small className="helper-text">مثال: إعلان سينمائي لمنتج فاخر في القاهرة</small>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">مدة المحتوى</span>
            <div className="choice-grid script-small-grid">
              {scriptDurations.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={duration === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setDuration(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">الأسلوب</span>
            <div className="choice-grid script-small-grid">
              {scriptStyles.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={style === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setStyle(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">لغة السكريبت</span>
            <div className="choice-grid script-small-grid">
              {scriptLanguages.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={language === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setLanguage(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="field-block compact-field">
            <span className="field-label">مستوى التفاصيل</span>
            <div className="choice-grid script-small-grid">
              {detailLevels.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={detailLevel === item ? 'choice-option active' : 'choice-option'}
                  onClick={() => setDetailLevel(item)}
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
            {status === 'generating' ? 'جاري كتابة السكريبت...' : '✦ إنشاء السكريبت'}
          </button>

          {status === 'generating' && (
            <div className="loading-row" aria-live="polite">
              <span className="loading-orb" />
              <span>جاري كتابة السكريبت...</span>
            </div>
          )}

          {errorMessage && <div className="error-box">{errorMessage}</div>}

          {result && (
            <div className="script-result-card">
              <div className="result-header">
                <span className="mini-badge">السكريبت الخاص بك</span>
              </div>

              <div className="script-block">
                <div className="script-label">العنوان</div>
                <div className="script-content">{result.title}</div>
              </div>

              <div className="script-block">
                <div className="script-label">المقدمة / Hook</div>
                <div className="script-content">{result.hook}</div>
              </div>

              <div className="script-block">
                <div className="script-label">المشاهد</div>
                <div className="script-content">
                  {result.scenes.map((scene, index) => (
                    <div key={`${scene}-${index}`} className="scene-line">
                      <div className="scene-copy-row">
                        <span>
                          {index + 1}. {scene}
                        </span>
                        <button
                          type="button"
                          className="scene-copy-btn"
                          onClick={() => handleCopyScene(scene, index)}
                        >
                          {copiedSceneIndex === index ? 'تم نسخ المشهد ✓' : '📋 نسخ المشهد'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="script-block">
                <div className="script-label">التعليق الصوتي</div>
                <div className="script-content">{result.voiceover}</div>
              </div>

              <div className="script-block">
                <div className="script-label">النهاية</div>
                <div className="script-content">{result.ending}</div>
              </div>

              <div className="script-block">
                <div className="script-label">Call to Action</div>
                <div className="script-content">{result.cta}</div>
              </div>

              <div className="result-actions">
                <button type="button" className="mini-action-btn gold-btn" onClick={handleCopy}>
                  نسخ
                </button>
                <button type="button" className="mini-action-btn" onClick={handleSave}>
                  حفظ
                </button>
                <button type="button" className="mini-action-btn" onClick={handleEdit}>
                  تعديل
                </button>
                <button type="button" className="mini-action-btn" onClick={handleGenerate}>
                  إعادة إنشاء
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default DashboardScriptPage;
