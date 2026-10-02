import React, { useEffect, useMemo, useRef, useState } from 'react';

const FILE_LIMITS = {
  video: 250 * 1024 * 1024,
  image: 25 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};
const TOTAL_FILE_LIMIT = 500 * 1024 * 1024;
const acceptedMediaTypes = ['video/*', 'image/*', 'audio/*'];

function classifyMedia(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DashboardEditorPage() {
  const fileInputRef = useRef(null);
  const mediaRef = useRef([]);
  const [media, setMedia] = useState([]);
  const [activeMediaId, setActiveMediaId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const activeMedia = media.find((item) => item.id === activeMediaId) || media[0] || null;
  const timelineClips = useMemo(() => media.filter((item) => item.type !== 'audio'), [media]);
  const audioTracks = useMemo(() => media.filter((item) => item.type === 'audio'), [media]);
  const projectStatus = media.length ? `مسودة · ${media.length} وسائط` : 'مشروع جديد';

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFiles = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const acceptedFiles = [];
    const rejectedFiles = [];
    const existingTotal = media.reduce((sum, item) => sum + item.file.size, 0);
    let nextTotal = existingTotal;

    selectedFiles.forEach((file) => {
      const type = classifyMedia(file);
      if (!type) {
        rejectedFiles.push(`${file.name}: نوع الملف غير مدعوم.`);
        return;
      }
      if (file.size <= 0 || file.size > FILE_LIMITS[type]) {
        rejectedFiles.push(`${file.name}: الحد الأقصى لهذا النوع ${formatFileSize(FILE_LIMITS[type])}.`);
        return;
      }
      if (nextTotal + file.size > TOTAL_FILE_LIMIT) {
        rejectedFiles.push(`${file.name}: تجاوز مجموع الملفات حد 500 MB.`);
        return;
      }

      nextTotal += file.size;
      acceptedFiles.push({
        id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        type,
        url: URL.createObjectURL(file),
      });
    });

    if (acceptedFiles.length) {
      setMedia((current) => [...current, ...acceptedFiles]);
      setActiveMediaId((current) => current || acceptedFiles[0].id);
    }
    setErrorMessage(rejectedFiles.join(' '));
    event.target.value = '';
  };

  const removeMedia = (id) => {
    const removedIndex = media.findIndex((item) => item.id === id);
    const next = media.filter((item) => item.id !== id);
    const removedMedia = media[removedIndex];
    if (removedMedia) URL.revokeObjectURL(removedMedia.url);
    if (activeMediaId === id) setActiveMediaId(next[Math.min(removedIndex, next.length - 1)]?.id || null);
    setMedia(next);
  };

  const moveMedia = (id, direction) => {
    setMedia((current) => {
      const index = current.findIndex((item) => item.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="dashboard-shell">
      <div className="background-glow glow-gold" />
      <div className="background-glow glow-cyan" />

      <header className="topbar container editor-topbar">
        <div className="brand-wrap" aria-label="منصة الشرقاوي">
          <div className="brand-mark"><span>م</span></div>
          <div className="brand-copy"><small>منصة</small><strong>الشرقاوي</strong></div>
        </div>
        <button type="button" className="ghost-button" onClick={handleGoBack}>رجوع</button>
      </header>

      <main className="container image-page-shell editor-page-shell">
        <section className="image-generator-card card editor-card">
          <div className="editor-heading">
            <div>
              <span className="mini-badge">Studio · Editor</span>
              <h1>المونتاج</h1>
            </div>
            <span className={`editor-project-status ${media.length ? 'has-media' : ''}`} role="status">{projectStatus}</span>
          </div>

          <section className="editor-section" aria-labelledby="editor-add-media">
            <div className="editor-section-heading">
              <div>
                <h2 id="editor-add-media">إضافة الوسائط</h2>
                <p>تُحفظ الملفات في هذه الصفحة فقط ولا تُرفع إلى خدمة خارجية.</p>
              </div>
              <button type="button" className="mini-action-btn gold-btn editor-add-button" onClick={openFilePicker}>＋ إضافة</button>
              <input
                ref={fileInputRef}
                className="editor-file-input"
                type="file"
                accept={acceptedMediaTypes.join(',')}
                multiple
                onChange={handleFiles}
                aria-label="رفع فيديو أو صور أو صوت"
              />
            </div>
            <div className="editor-upload-limits">
              <span>فيديو حتى 250 MB</span><span>صور حتى 25 MB</span><span>صوت حتى 50 MB</span>
            </div>
            {errorMessage && <div className="error-banner editor-error" role="alert">{errorMessage}</div>}
          </section>

          <section className="editor-section" aria-labelledby="editor-preview-title">
            <div className="editor-section-heading">
              <div><h2 id="editor-preview-title">المعاينة</h2></div>
              {activeMedia && <span className="editor-media-type">{activeMedia.type === 'video' ? 'فيديو' : activeMedia.type === 'image' ? 'صورة' : 'صوت'}</span>}
            </div>
            <div className="editor-preview-stage">
              {!activeMedia && <div className="editor-preview-empty"><span className="editor-preview-mark">▶</span><strong>أضف وسائط لبدء المعاينة</strong><small>ستظهر معاينة الملف المحدد هنا</small></div>}
              {activeMedia?.type === 'video' && <video key={activeMedia.id} src={activeMedia.url} controls playsInline preload="metadata" />}
              {activeMedia?.type === 'image' && <img key={activeMedia.id} src={activeMedia.url} alt={activeMedia.file.name} />}
              {activeMedia?.type === 'audio' && <div className="editor-audio-preview"><span className="editor-audio-mark">♫</span><strong>{activeMedia.file.name}</strong><audio key={activeMedia.id} src={activeMedia.url} controls preload="metadata" /></div>}
            </div>
          </section>

          <section className="editor-section" aria-labelledby="editor-media-bin-title">
            <div className="editor-section-heading">
              <div><h2 id="editor-media-bin-title">Media Bin</h2><p>{media.length ? `${media.length} ملف` : 'لا توجد وسائط مضافة'}</p></div>
            </div>
            {media.length === 0 ? (
              <div className="editor-bin-empty">ستظهر الملفات المضافة هنا</div>
            ) : (
              <div className="editor-media-list">
                {media.map((item, index) => (
                  <article className={`editor-media-item ${activeMediaId === item.id ? 'selected' : ''}`} key={item.id}>
                    <button type="button" className="editor-media-select" onClick={() => setActiveMediaId(item.id)} aria-label={`معاينة ${item.file.name}`}>
                      <span className={`editor-file-icon ${item.type}`}>{item.type === 'video' ? '▶' : item.type === 'image' ? '▧' : '♫'}</span>
                      <span className="editor-file-copy"><strong>{item.file.name}</strong><small>{formatFileSize(item.file.size)} · {item.type === 'video' ? 'فيديو' : item.type === 'image' ? 'صورة' : 'صوت'}</small></span>
                    </button>
                    <div className="editor-media-actions">
                      <button type="button" className="editor-icon-button" onClick={() => moveMedia(item.id, -1)} disabled={index === 0} aria-label="تحريك للأعلى" title="تحريك للأعلى">↑</button>
                      <button type="button" className="editor-icon-button" onClick={() => moveMedia(item.id, 1)} disabled={index === media.length - 1} aria-label="تحريك للأسفل" title="تحريك للأسفل">↓</button>
                      <button type="button" className="editor-icon-button remove" onClick={() => removeMedia(item.id)} aria-label="حذف الملف" title="حذف">×</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="editor-section editor-timeline-section" aria-labelledby="editor-timeline-title">
            <div className="editor-section-heading"><div><h2 id="editor-timeline-title">Timeline</h2><p>ترتيب المقاطع الحالي</p></div></div>
            {!media.length ? (
              <div className="editor-timeline-empty">أضف فيديو أو صورة لعرض المقاطع هنا</div>
            ) : (
              <div className="editor-timeline" aria-label="الخط الزمني">
                <div className="editor-timeline-ruler"><span>00:00</span><span>الترتيب من Media Bin</span></div>
                {timelineClips.length > 0 && <div className="editor-track"><span className="editor-track-label">مقاطع</span><div className="editor-clip-row">{timelineClips.map((item, index) => <button type="button" className={`editor-clip ${item.type}`} key={item.id} onClick={() => setActiveMediaId(item.id)}><span>{item.type === 'video' ? '▶' : '▧'} {index + 1}</span><strong>{item.file.name}</strong></button>)}</div></div>}
                {audioTracks.length > 0 && <div className="editor-track audio"><span className="editor-track-label">صوت</span><div className="editor-clip-row">{audioTracks.map((item) => <button type="button" className="editor-clip audio" key={item.id} onClick={() => setActiveMediaId(item.id)}><span>♫ صوت</span><strong>{item.file.name}</strong></button>)}</div></div>}
                {!timelineClips.length && <div className="editor-track-empty">لا توجد مقاطع فيديو أو صور بعد</div>}
              </div>
            )}
          </section>

          <section className="editor-tools-section" aria-label="أدوات التحرير القادمة">
            <div className="editor-section-heading"><div><h2>الأدوات</h2><p>ستتوفر في المراحل التالية</p></div></div>
            <div className="editor-tools-grid">
              {['قص', 'تقسيم', 'انتقال', 'صوت', 'نص', 'سرعة', 'تأثيرات'].map((tool) => <button type="button" className="editor-tool-button" key={tool} disabled aria-label={`${tool}، ستتوفر لاحقًا`}><span>{tool}</span><small>لاحقًا</small></button>)}
            </div>
          </section>

          <button type="button" className="generate-button editor-export-button" disabled aria-disabled="true">تصدير الفيديو · قريبًا</button>
        </section>
      </main>
    </div>
  );
}

export default DashboardEditorPage;
