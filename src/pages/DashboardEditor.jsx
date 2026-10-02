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

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remainingSeconds.toFixed(1).padStart(4, '0')}`;
}

function probeDuration(url, type) {
  return new Promise((resolve) => {
    const element = document.createElement(type === 'video' ? 'video' : 'audio');
    const timeoutId = window.setTimeout(() => finish(null), 15000);
    const finish = (duration) => {
      window.clearTimeout(timeoutId);
      element.removeAttribute('src');
      element.load();
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => finish(element.duration);
    element.onerror = () => finish(null);
    element.src = url;
    element.load();
  });
}

function DashboardEditorPage() {
  const fileInputRef = useRef(null);
  const previewVideoRef = useRef(null);
  const previewAudioRef = useRef(null);
  const mediaRef = useRef([]);
  const [media, setMedia] = useState([]);
  const [clips, setClips] = useState([]);
  const [selectedClipId, setSelectedClipId] = useState(null);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const timelineClips = useMemo(() => {
    let projectOffset = 0;
    return clips.map((clip) => {
      const source = mediaById.get(clip.sourceId);
      if (!source) return null;
      const duration = Math.max(0, clip.endTime - clip.startTime);
      const row = { ...clip, source, duration, projectStart: projectOffset, projectEnd: projectOffset + duration };
      projectOffset += duration;
      return row;
    }).filter(Boolean);
  }, [clips, mediaById]);
  const audioTracks = useMemo(() => media.filter((item) => item.type === 'audio'), [media]);
  const projectDuration = Math.max(
    timelineClips.at(-1)?.projectEnd || 0,
    ...audioTracks.map((track) => track.duration || 0),
  );
  const selectedClip = timelineClips.find((clip) => clip.id === selectedClipId) || null;
  const lastClip = timelineClips.at(-1) || null;
  const playheadClip = timelineClips.find((clip) => currentTime >= clip.projectStart && currentTime < clip.projectEnd)
    || (lastClip && currentTime <= lastClip.projectEnd ? lastClip : null);
  const previewClip = playheadClip || selectedClip;
  const selectedMedia = mediaById.get(selectedMediaId) || previewClip?.source || null;
  const audioAtPlayhead = audioTracks.find((track) => track.duration && currentTime < track.duration) || null;
  const previewMedia = selectedMedia?.type === 'audio'
    ? selectedMedia
    : previewClip?.source || audioAtPlayhead || (timelineClips.length === 0 ? selectedMedia : null);
  const projectStatus = media.length ? `مسودة · ${media.length} وسائط` : 'مشروع جديد';

  useEffect(() => {
    mediaRef.current = media;
  }, [media]);

  useEffect(() => () => {
    mediaRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();

  const createClip = (source, duration) => ({
    id: createId(),
    sourceId: source.id,
    type: source.type,
    startTime: 0,
    endTime: duration,
    transition: 'none',
  });

  const handleFiles = async (event) => {
    const input = event.currentTarget;
    const selectedFiles = Array.from(input.files || []);
    input.value = '';
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
        id: createId(),
        file,
        type,
        duration: type === 'image' ? null : null,
        url: URL.createObjectURL(file),
      });
    });

    if (acceptedFiles.length) {
      mediaRef.current = [...mediaRef.current, ...acceptedFiles];
      setMedia((current) => [...current, ...acceptedFiles]);
      setSelectedMediaId((current) => current || acceptedFiles[0].id);

      const createdClips = await Promise.all(acceptedFiles.map(async (source) => {
        if (source.type === 'image') return createClip(source, 5);
        const duration = await probeDuration(source.url, source.type);
        if (duration === null) {
          rejectedFiles.push(`${source.file.name}: تعذر قراءة مدة الملف.`);
          return null;
        }
        if (mediaRef.current.some((item) => item.id === source.id)) {
          setMedia((current) => current.map((item) => item.id === source.id ? { ...item, duration } : item));
          mediaRef.current = mediaRef.current.map((item) => item.id === source.id ? { ...item, duration } : item);
        }
        return source.type === 'video' ? createClip(source, duration) : null;
      }));

      const newClips = createdClips.filter((clip) => clip && mediaRef.current.some((item) => item.id === clip.sourceId));
      if (newClips.length) {
        setClips((current) => [...current, ...newClips]);
        setSelectedClipId((current) => current || newClips[0].id);
        setSelectedMediaId((current) => current && media.some((item) => item.id === current && item.type !== 'audio')
          ? current
          : newClips[0].sourceId);
      }
    }
    setErrorMessage(rejectedFiles.join(' '));
  };

  const removeMedia = (id) => {
    const removedMedia = mediaById.get(id);
    const next = media.filter((item) => item.id !== id);
    const nextClips = clips.filter((clip) => clip.sourceId !== id);
    const removedClipIndex = clips.findIndex((clip) => clip.sourceId === id);
    if (removedMedia) URL.revokeObjectURL(removedMedia.url);
    mediaRef.current = next;
    if (selectedMediaId === id) setSelectedMediaId(next[0]?.id || null);
    if (nextClips.every((clip) => clip.id !== selectedClipId)) {
      setSelectedClipId(nextClips[Math.min(removedClipIndex, nextClips.length - 1)]?.id || null);
    }
    setMedia(next);
    setClips(nextClips);
    setCurrentTime((time) => Math.min(time, nextClips.reduce((sum, clip) => sum + clip.endTime - clip.startTime, 0)));
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

  const moveClip = (id, direction) => {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === id);
      const destination = index + direction;
      if (index < 0 || destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  };

  const selectClip = (clipId) => {
    const clip = timelineClips.find((item) => item.id === clipId);
    if (!clip) return;
    setIsPlaying(false);
    setSelectedClipId(clip.id);
    setSelectedMediaId(clip.sourceId);
    setCurrentTime(clip.projectStart);
  };

  const selectMedia = (item) => {
    setSelectedMediaId(item.id);
    if (item.type === 'audio') {
      setSelectedClipId(null);
      return;
    }
    const clip = timelineClips.find((candidate) => candidate.sourceId === item.id);
    if (clip) selectClip(clip.id);
  };

  const seekProject = (value) => {
    const nextTime = Math.max(0, Math.min(Number(value), projectDuration));
    setCurrentTime(nextTime);
    const clip = timelineClips.find((item) => nextTime >= item.projectStart && nextTime < item.projectEnd)
      || (nextTime === projectDuration ? timelineClips.at(-1) : null);
    if (clip) {
      setSelectedClipId(clip.id);
      setSelectedMediaId(clip.sourceId);
    }
  };

  const updateClipTime = (clipId, field, rawValue) => {
    if (rawValue === '') return;
    const value = Number(rawValue);
    const clip = clips.find((item) => item.id === clipId);
    const source = clip && mediaById.get(clip.sourceId);
    if (!clip || !source || !Number.isFinite(value)) return;

    const maximum = clip.type === 'image' ? 300 : source.duration;
    const nextStart = field === 'startTime' ? value : clip.startTime;
    const nextEnd = field === 'endTime' || field === 'duration' ? (field === 'duration' ? clip.startTime + value : value) : clip.endTime;
    if (nextStart < 0 || nextEnd > maximum || nextStart >= nextEnd) {
      setErrorMessage(clip.type === 'image'
        ? 'مدة الصورة يجب أن تكون أكبر من صفر ولا تتجاوز 300 ثانية.'
        : 'تحقق من نقاط القص: البداية لا تقل عن صفر، والنهاية ضمن مدة المصدر، والبداية قبل النهاية.');
      return;
    }

    setErrorMessage('');
    setClips((current) => current.map((item) => item.id === clipId
      ? { ...item, startTime: nextStart, endTime: nextEnd }
      : item));
    const row = timelineClips.find((item) => item.id === clipId);
    if (row && currentTime > row.projectStart + nextEnd - nextStart) setCurrentTime(row.projectStart);
  };

  const splitSelectedClip = () => {
    if (!selectedClip || selectedClip.type !== 'video') return;
    const row = timelineClips.find((item) => item.id === selectedClip.id);
    if (!row) return;
    const sourceTime = selectedClip.startTime + Math.max(0, currentTime - row.projectStart);
    if (sourceTime <= selectedClip.startTime + 0.1 || sourceTime >= selectedClip.endTime - 0.1) {
      setErrorMessage('حرّك مؤشر التشغيل إلى داخل المقطع قبل تقسيمه.');
      return;
    }

    const firstClip = { ...selectedClip, endTime: sourceTime };
    const secondClip = { ...selectedClip, id: createId(), startTime: sourceTime, transition: 'none' };
    const index = clips.findIndex((clip) => clip.id === selectedClip.id);
    const next = [...clips];
    next.splice(index, 1, firstClip, secondClip);
    setClips(next);
    setSelectedClipId(secondClip.id);
    setErrorMessage('');
  };

  const setClipTransition = (value) => {
    if (!selectedClip) return;
    setClips((current) => current.map((clip) => clip.id === selectedClip.id ? { ...clip, transition: value } : clip));
  };

  const advanceToNextClip = (clipId) => {
    const index = timelineClips.findIndex((clip) => clip.id === clipId);
    const next = timelineClips[index + 1];
    if (!next) {
      setCurrentTime(projectDuration);
      setIsPlaying(false);
      return;
    }
    setSelectedClipId(next.id);
    setSelectedMediaId(next.sourceId);
    setCurrentTime(next.projectStart);
  };

  const handleVideoTimeUpdate = (event, clip) => {
    const sourceTime = event.currentTarget.currentTime;
    if (sourceTime < clip.startTime) {
      event.currentTarget.currentTime = clip.startTime;
      return;
    }
    if (sourceTime >= clip.endTime - 0.025) {
      advanceToNextClip(clip.id);
      return;
    }
    const clipTime = Math.max(0, sourceTime - clip.startTime);
    setCurrentTime(clip.projectStart + clipTime);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      previewVideoRef.current?.pause();
      previewAudioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (previewMedia?.type === 'audio' && previewAudioRef.current) {
      previewAudioRef.current.play().catch(() => setErrorMessage('تعذر تشغيل هذا الصوت في المتصفح.'));
      return;
    }
    if (previewClip?.type === 'video' && previewVideoRef.current) {
      previewVideoRef.current.play().catch(() => setErrorMessage('تعذر تشغيل هذا الفيديو في المتصفح.'));
      return;
    }
    if (projectDuration > 0) setIsPlaying(true);
  };

  useEffect(() => {
    if (!isPlaying || previewClip?.type !== 'image') return undefined;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        const nextTime = Math.min(time + 0.1, projectDuration);
        if (nextTime >= projectDuration) setIsPlaying(false);
        return nextTime;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [isPlaying, previewClip?.id, projectDuration]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || previewClip?.type !== 'video' || previewMedia?.type !== 'video') return;
    const sourceTime = previewClip.startTime + Math.max(0, currentTime - previewClip.projectStart);
    if (Math.abs(video.currentTime - sourceTime) > 0.35) video.currentTime = Math.min(sourceTime, previewClip.endTime);
    if (isPlaying && video.paused) video.play().catch(() => setIsPlaying(false));
    if (!isPlaying && !video.paused) video.pause();
  }, [currentTime, isPlaying, previewClip?.id, previewClip?.startTime, previewClip?.endTime, previewMedia?.id]);

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
              {previewMedia && <span className="editor-media-type">{previewMedia.type === 'video' ? 'فيديو' : previewMedia.type === 'image' ? 'صورة' : 'صوت'}</span>}
            </div>
            <div className="editor-preview-stage">
                {!previewMedia && <div className="editor-preview-empty"><span className="editor-preview-mark">▶</span><strong>أضف وسائط لبدء المعاينة</strong><small>ستظهر معاينة الملف المحدد هنا</small></div>}
                {previewMedia?.type === 'video' && previewClip && <video key={previewClip.id} ref={previewVideoRef} src={previewMedia.url} controls playsInline preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onTimeUpdate={(event) => handleVideoTimeUpdate(event, previewClip)} onEnded={() => advanceToNextClip(previewClip.id)} />}
                {previewMedia?.type === 'image' && <img key={`${previewClip?.id || previewMedia.id}-${previewMedia.id}`} src={previewMedia.url} alt={previewMedia.file.name} />}
                {previewMedia?.type === 'audio' && <div className="editor-audio-preview"><span className="editor-audio-mark">♫</span><strong>{previewMedia.file.name}</strong><audio key={previewMedia.id} ref={previewAudioRef} src={previewMedia.url} controls preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onTimeUpdate={(event) => setCurrentTime(Math.min(event.currentTarget.currentTime, projectDuration))} /></div>}
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
                    <button type="button" className="editor-media-select" onClick={() => selectMedia(item)} aria-label={`معاينة ${item.file.name}`}>
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
                <div className="editor-playback-controls"><button type="button" className="editor-play-button" onClick={togglePlayback} disabled={!projectDuration}>{isPlaying ? 'إيقاف' : 'تشغيل'}</button><span>{formatTime(currentTime)} / {formatTime(projectDuration)}</span></div>
                <input className="editor-playhead" type="range" min="0" max={Math.max(projectDuration, 0.1)} step="0.1" value={Math.min(currentTime, projectDuration)} onChange={(event) => seekProject(event.target.value)} disabled={!projectDuration} aria-label="مؤشر التشغيل" />
                {timelineClips.length > 0 && <div className="editor-track"><span className="editor-track-label">مقاطع</span><div className="editor-clip-row">{timelineClips.map((item, index) => <div className={`editor-clip ${item.type} ${item.id === selectedClipId ? 'selected' : ''}`} key={item.id}><button type="button" className="editor-clip-select" onClick={() => selectClip(item.id)}><span>{item.type === 'video' ? '▶' : '▧'} {index + 1} · {formatTime(item.duration)}</span><strong>{item.source.file.name}</strong>{item.transition !== 'none' && <small>{item.transition === 'fade' ? 'Fade' : 'Crossfade'}</small>}</button><span className="editor-clip-order"><button type="button" onClick={() => moveClip(item.id, -1)} disabled={index === 0} aria-label="ترتيب المقطع للأعلى">↑</button><button type="button" onClick={() => moveClip(item.id, 1)} disabled={index === timelineClips.length - 1} aria-label="ترتيب المقطع للأسفل">↓</button></span></div>)}</div></div>}
                {audioTracks.length > 0 && <div className="editor-track audio"><span className="editor-track-label">مسارات الصوت · لا تُخلط بعد</span><div className="editor-clip-row">{audioTracks.map((item) => <button type="button" className="editor-clip audio" key={item.id} onClick={() => selectMedia(item)}><span>♫ {item.duration ? formatTime(item.duration) : 'صوت'}</span><strong>{item.file.name}</strong></button>)}</div></div>}
                {!timelineClips.length && <div className="editor-track-empty">لا توجد مقاطع فيديو أو صور بعد</div>}
              </div>
            )}
          </section>

          <div className="editor-bottom-toolbar">
            {selectedClip ? <>
              <div className="editor-selected-clip-heading"><strong>{selectedClip.type === 'video' ? 'فيديو' : 'صورة'} · {formatTime(selectedClip.endTime - selectedClip.startTime)}</strong><small>{selectedClip.source.file.name}</small></div>
              {selectedClip.type === 'video' ? <div className="editor-trim-fields"><label>البداية<input type="number" min="0" max={Math.max(0, selectedClip.endTime - 0.1)} step="0.1" value={selectedClip.startTime} onChange={(event) => updateClipTime(selectedClip.id, 'startTime', event.target.value)} /></label><label>النهاية<input type="number" min={selectedClip.startTime + 0.1} max={selectedClip.source.duration || selectedClip.endTime} step="0.1" value={selectedClip.endTime} onChange={(event) => updateClipTime(selectedClip.id, 'endTime', event.target.value)} /></label></div> : <label className="editor-image-duration">مدة الصورة بالثواني<input type="number" min="0.1" max="300" step="0.1" value={(selectedClip.endTime - selectedClip.startTime).toFixed(1)} onChange={(event) => updateClipTime(selectedClip.id, 'duration', event.target.value)} /></label>}
              <div className="editor-toolbar-actions"><button type="button" className="editor-split-button" onClick={splitSelectedClip} disabled={selectedClip.type !== 'video'}>تقسيم عند المؤشر</button><label className="editor-transition-control">الانتقال<select value={selectedClip.transition} onChange={(event) => setClipTransition(event.target.value)}><option value="none">بدون انتقال</option><option value="fade">Fade</option><option value="crossfade">Crossfade</option></select></label></div>
              <small className="editor-transition-note">الانتقال محفوظ للمقطع، لكن المعاينة والتصدير الحاليين لا يطبّقانه بعد.</small>
            </> : <div className="editor-no-selection">اختر مقطعًا من Timeline لعرض أدواته</div>}
          </div>

          <button type="button" className="generate-button editor-export-button" disabled aria-disabled="true">تصدير الفيديو · قريبًا</button>
        </section>
      </main>
    </div>
  );
}

export default DashboardEditorPage;
