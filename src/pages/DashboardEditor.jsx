import React, { useEffect, useMemo, useRef, useState } from 'react';

const FILE_LIMITS = {
  video: 250 * 1024 * 1024,
  image: 25 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
};
const TOTAL_FILE_LIMIT = 500 * 1024 * 1024;
const MAX_TRACK_START_SECONDS = 3600;
const acceptedMediaTypes = ['video/*', 'image/*', 'audio/*'];
const supportedAudioTypes = {
  mp3: ['audio/mpeg', 'audio/mp3'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/vnd.wave'],
  m4a: ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
  aac: ['audio/aac', 'audio/aacp', 'audio/x-aac'],
};

function classifyMedia(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    return supportedAudioTypes[extension]?.includes(file.type) ? 'audio' : null;
  }
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

function getAudioGain(track, sourceTime) {
  const elapsed = Math.max(0, sourceTime - track.trimStart);
  const length = track.trimEnd - track.trimStart;
  let gain = 1;
  if (track.fadeIn > 0 && elapsed < track.fadeIn) gain = Math.min(gain, elapsed / track.fadeIn);
  const remaining = length - elapsed;
  if (track.fadeOut > 0 && remaining < track.fadeOut) gain = Math.min(gain, remaining / track.fadeOut);
  return track.muted ? 0 : track.volume * Math.max(0, Math.min(1, gain));
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
  const musicInputRef = useRef(null);
  const voiceInputRef = useRef(null);
  const previewVideoRef = useRef(null);
  const previewAudioRef = useRef(null);
  const audioTrackRefs = useRef(new Map());
  const mediaRef = useRef([]);
  const [media, setMedia] = useState([]);
  const [clips, setClips] = useState([]);
  const [audioTracks, setAudioTracks] = useState([]);
  const [playingAudioTrackIds, setPlayingAudioTrackIds] = useState(() => new Set());
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
  const projectDuration = Math.max(
    timelineClips.at(-1)?.projectEnd || 0,
    ...audioTracks.map((track) => track.endTime || 0),
  );
  const selectedClip = timelineClips.find((clip) => clip.id === selectedClipId) || null;
  const lastClip = timelineClips.at(-1) || null;
  const playheadClip = timelineClips.find((clip) => currentTime >= clip.projectStart && currentTime < clip.projectEnd)
    || (lastClip && currentTime <= lastClip.projectEnd ? lastClip : null);
  const previewClip = playheadClip || selectedClip;
  const selectedMedia = mediaById.get(selectedMediaId) || previewClip?.source || null;
  const selectedAudioTrack = audioTracks.find((track) => track.sourceId === selectedMedia?.id) || null;
  const audioAtPlayhead = audioTracks.find((track) => currentTime >= track.startTime && currentTime < track.endTime) || null;
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
  const openMusicPicker = () => musicInputRef.current?.click();
  const openVoicePicker = () => voiceInputRef.current?.click();

  const createClip = (source, duration) => ({
    id: createId(),
    sourceId: source.id,
    type: source.type,
    startTime: 0,
    endTime: duration,
    transition: 'none',
  });

  const createAudioTrack = (source, duration, type) => ({
    id: createId(),
    sourceId: source.id,
    name: source.file.name,
    type,
    source: source.url,
    startTime: 0,
    endTime: duration,
    duration,
    trimStart: 0,
    trimEnd: duration,
    volume: 1,
    muted: false,
    fadeIn: 0,
    fadeOut: 0,
  });

  const handleFiles = async (event, audioType = 'music') => {
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

      const additions = await Promise.all(acceptedFiles.map(async (source) => {
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
        if (source.type === 'video') return { clip: createClip(source, duration) };
        return { audioTrack: createAudioTrack(source, duration, audioType) };
      }));

      const newClips = additions
        .map((item) => item?.clip || (item?.type ? item : null))
        .filter((clip) => clip && mediaRef.current.some((item) => item.id === clip.sourceId));
      const newAudioTracks = additions
        .map((item) => item?.audioTrack || null)
        .filter((track) => track && mediaRef.current.some((item) => item.id === track.sourceId));
      if (newClips.length) {
        setClips((current) => [...current, ...newClips]);
        setSelectedClipId((current) => current || newClips[0].id);
        setSelectedMediaId((current) => current && media.some((item) => item.id === current && item.type !== 'audio')
          ? current
          : newClips[0].sourceId);
      }
          if (newAudioTracks.length) setAudioTracks((current) => [...current, ...newAudioTracks]);
    }
    setErrorMessage(rejectedFiles.join(' '));
  };

  const removeMedia = (id) => {
    const removedMedia = mediaById.get(id);
    const next = media.filter((item) => item.id !== id);
    const nextClips = clips.filter((clip) => clip.sourceId !== id);
    const removedAudioTracks = audioTracks.filter((track) => track.sourceId === id);
    removedAudioTracks.forEach((track) => audioTrackRefs.current.get(track.id)?.pause());
    const removedClipIndex = clips.findIndex((clip) => clip.sourceId === id);
    if (removedMedia) URL.revokeObjectURL(removedMedia.url);
    mediaRef.current = next;
    if (selectedMediaId === id) setSelectedMediaId(next[0]?.id || null);
    if (nextClips.every((clip) => clip.id !== selectedClipId)) {
      setSelectedClipId(nextClips[Math.min(removedClipIndex, nextClips.length - 1)]?.id || null);
    }
    setMedia(next);
    setClips(nextClips);
    setAudioTracks((current) => current.filter((track) => track.sourceId !== id));
    setPlayingAudioTrackIds((current) => new Set([...current].filter((trackId) => !removedAudioTracks.some((track) => track.id === trackId))));
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

  const selectAudioTrack = (track) => {
    setSelectedClipId(null);
    setSelectedMediaId(track.sourceId);
    setCurrentTime(track.startTime);
  };

  const setAudioTrackVolume = (trackId, volume) => {
    const nextVolume = Number(volume);
    if (!Number.isFinite(nextVolume) || nextVolume < 0 || nextVolume > 1) return;
    setAudioTracks((current) => current.map((track) => track.id === trackId ? { ...track, volume: nextVolume } : track));
  };

  const updateAudioTrack = (trackId, field, rawValue) => {
    if (rawValue === '') return;
    const value = Number(rawValue);
    const track = audioTracks.find((item) => item.id === trackId);
    if (!track || !Number.isFinite(value)) return;

    let nextTrack = track;
    const trimLength = track.trimEnd - track.trimStart;
    if (field === 'startTime') {
      if (value < 0 || value + trimLength > MAX_TRACK_START_SECONDS) {
        setErrorMessage('بداية المسار يجب أن تكون بين 0 و3600 ثانية.');
        return;
      }
      nextTrack = { ...track, startTime: value, endTime: value + trimLength };
    } else if (field === 'endTime') {
      const nextLength = value - track.startTime;
      const nextTrimEnd = track.trimStart + nextLength;
      if (value <= track.startTime || value > MAX_TRACK_START_SECONDS || nextTrimEnd > track.duration) {
        setErrorMessage('نهاية المسار يجب أن تكون بعد بدايته وضمن مدة الملف الأصلي.');
        return;
      }
      nextTrack = { ...track, endTime: value, trimEnd: nextTrimEnd };
    } else if (field === 'trimStart') {
      if (value < 0 || value >= track.trimEnd) {
        setErrorMessage('بداية القص يجب أن تكون قبل نهاية القص.');
        return;
      }
      const length = track.trimEnd - value;
      nextTrack = { ...track, trimStart: value, endTime: track.startTime + length };
    } else if (field === 'trimEnd') {
      if (value <= track.trimStart || value > track.duration) {
        setErrorMessage('نهاية القص يجب أن تكون بعد بدايته وضمن مدة الملف.');
        return;
      }
      nextTrack = { ...track, trimEnd: value, endTime: track.startTime + value - track.trimStart };
    } else if (field === 'fadeIn' || field === 'fadeOut') {
      if (value < 0 || value > trimLength) {
        setErrorMessage('مدة التلاشي يجب أن تكون ضمن مدة المسار.');
        return;
      }
      nextTrack = { ...track, [field]: value };
    }

    setErrorMessage('');
    setAudioTracks((current) => current.map((item) => item.id === trackId ? nextTrack : item));
  };

  const toggleAudioTrack = (track) => {
    const audio = audioTrackRefs.current.get(track.id);
    if (!audio) return;
    if (audio.paused) {
      if (audio.currentTime < track.trimStart || audio.currentTime >= track.trimEnd) audio.currentTime = track.trimStart;
      audio.volume = track.muted ? 0 : track.volume;
      audio.play().catch(() => setErrorMessage(`تعذر تشغيل الملف الصوتي: ${track.name}`));
    } else {
      audio.pause();
    }
  };

  const handleAudioTrackTimeUpdate = (event, track) => {
    const audio = event.currentTarget;
    const sourceTime = audio.currentTime;
    if (sourceTime < track.trimStart) {
      audio.currentTime = track.trimStart;
      return;
    }
    if (sourceTime >= track.trimEnd - 0.025) {
      audio.pause();
      audio.currentTime = track.trimStart;
      setCurrentTime(track.endTime);
      return;
    }
    const elapsed = sourceTime - track.trimStart;
    audio.volume = getAudioGain(track, sourceTime);
    setCurrentTime(Math.min(track.endTime, track.startTime + elapsed));
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

  useEffect(() => {
    audioTracks.forEach((track) => {
      const audio = audioTrackRefs.current.get(track.id);
      if (!audio) return;
      audio.muted = track.muted;
      if (audio.currentTime < track.trimStart || audio.currentTime >= track.trimEnd) {
        audio.pause();
        audio.currentTime = track.trimStart;
      }
      audio.volume = getAudioGain(track, audio.currentTime);
    });
  }, [audioTracks]);

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

          <section className="editor-section editor-audio-section" aria-labelledby="editor-audio-title">
            <div className="editor-section-heading">
              <div><h2 id="editor-audio-title">الصوت</h2><p>تُشغّل الملفات من الجهاز ولا تُرفع إلى أي خدمة.</p></div>
            </div>
            <div className="editor-audio-add-actions">
              <button type="button" className="mini-action-btn gold-btn" onClick={openVoicePicker}>🎙️ إضافة تعليق صوتي</button>
              <button type="button" className="mini-action-btn" onClick={openMusicPicker}>🎵 إضافة موسيقى</button>
              <input ref={voiceInputRef} className="editor-file-input" type="file" accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac" multiple onChange={(event) => handleFiles(event, 'voiceover')} aria-label="رفع تعليق صوتي" />
              <input ref={musicInputRef} className="editor-file-input" type="file" accept=".mp3,.wav,.m4a,.aac,audio/mpeg,audio/wav,audio/mp4,audio/aac" multiple onChange={(event) => handleFiles(event, 'music')} aria-label="رفع موسيقى خلفية" />
            </div>
            <div className="editor-audio-limits">MP3 · WAV · M4A · AAC، حتى 50 MB لكل ملف</div>
            {!audioTracks.length ? <div className="editor-bin-empty">أضف تعليقًا صوتيًا أو موسيقى لبدء المسارات</div> : (
              <div className="editor-audio-track-list">
                {audioTracks.map((track) => (
                  <article className={`editor-audio-track-card ${selectedMediaId === track.sourceId ? 'selected' : ''}`} key={track.id}>
                    <audio
                      ref={(element) => {
                        if (element) audioTrackRefs.current.set(track.id, element);
                        else audioTrackRefs.current.delete(track.id);
                      }}
                      src={track.source}
                      preload="metadata"
                      muted={track.muted}
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = track.trimStart;
                        event.currentTarget.volume = track.muted ? 0 : track.volume;
                      }}
                      onPlay={() => setPlayingAudioTrackIds((current) => new Set(current).add(track.id))}
                      onPause={() => setPlayingAudioTrackIds((current) => new Set([...current].filter((id) => id !== track.id)))}
                      onEnded={() => setPlayingAudioTrackIds((current) => new Set([...current].filter((id) => id !== track.id)))}
                      onTimeUpdate={(event) => handleAudioTrackTimeUpdate(event, track)}
                    />
                    <div className="editor-audio-track-heading">
                      <button type="button" className="editor-audio-track-select" onClick={() => selectAudioTrack(track)}>
                        <span className="editor-audio-track-icon">{track.type === 'voiceover' ? '🎙️' : '🎵'}</span>
                        <span><strong>{track.type === 'voiceover' ? 'تعليق صوتي' : 'موسيقى'}</strong><small>{track.name} · {formatTime(track.duration)}</small></span>
                      </button>
                      <div className="editor-audio-track-actions">
                        <button type="button" className="editor-icon-button" onClick={() => toggleAudioTrack(track)} aria-label={playingAudioTrackIds.has(track.id) ? 'إيقاف الصوت' : 'تشغيل الصوت'}>{playingAudioTrackIds.has(track.id) ? 'Ⅱ' : '▶'}</button>
                        <button type="button" className={`editor-icon-button ${track.muted ? 'muted' : ''}`} onClick={() => setAudioTracks((current) => current.map((item) => item.id === track.id ? { ...item, muted: !item.muted } : item))} aria-label={track.muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}>{track.muted ? '×' : '♪'}</button>
                        <button type="button" className="editor-icon-button remove" onClick={() => removeMedia(track.sourceId)} aria-label="حذف المسار الصوتي">×</button>
                      </div>
                    </div>
                    <label className="editor-audio-volume">مستوى الصوت <input type="range" min="0" max="1" step="0.01" value={track.volume} onChange={(event) => setAudioTrackVolume(track.id, event.target.value)} /> <span>{Math.round(track.volume * 100)}%</span></label>
                    <div className="editor-audio-time-grid">
                      <label>بداية المسار<input type="number" min="0" max={MAX_TRACK_START_SECONDS - 0.1} step="0.1" value={track.startTime.toFixed(1)} onChange={(event) => updateAudioTrack(track.id, 'startTime', event.target.value)} /></label>
                      <label>نهاية المسار<input type="number" min={track.startTime + 0.1} max={MAX_TRACK_START_SECONDS} step="0.1" value={track.endTime.toFixed(1)} onChange={(event) => updateAudioTrack(track.id, 'endTime', event.target.value)} /></label>
                      <label>Trim In<input type="number" min="0" max={track.trimEnd - 0.1} step="0.1" value={track.trimStart.toFixed(1)} onChange={(event) => updateAudioTrack(track.id, 'trimStart', event.target.value)} /></label>
                      <label>Trim Out<input type="number" min={track.trimStart + 0.1} max={track.duration} step="0.1" value={track.trimEnd.toFixed(1)} onChange={(event) => updateAudioTrack(track.id, 'trimEnd', event.target.value)} /></label>
                    </div>
                    <div className="editor-audio-fades">
                      <label>Fade In<input type="number" min="0" max={track.trimEnd - track.trimStart} step="0.1" value={track.fadeIn} onChange={(event) => updateAudioTrack(track.id, 'fadeIn', event.target.value)} /></label>
                      <label>Fade Out<input type="number" min="0" max={track.trimEnd - track.trimStart} step="0.1" value={track.fadeOut} onChange={(event) => updateAudioTrack(track.id, 'fadeOut', event.target.value)} /></label>
                      <span>تلاشي المعاينة فقط</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
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
                {audioTracks.length > 0 && <div className="editor-track audio"><span className="editor-track-label">مسارات الصوت</span><div className="editor-audio-timeline-lane">{audioTracks.map((track) => <div className="editor-audio-lane-row" key={track.id}><span className="editor-audio-lane-label">{track.type === 'voiceover' ? '🎙️ تعليق صوتي' : '🎵 موسيقى'}</span><div className="editor-audio-lane-rail"><button type="button" className={`editor-audio-timeline-clip ${track.type} ${selectedMediaId === track.sourceId ? 'selected' : ''}`} style={{ marginInlineStart: `${projectDuration ? (track.startTime / projectDuration) * 100 : 0}%`, width: `${projectDuration ? Math.max(8, ((track.endTime - track.startTime) / projectDuration) * 100) : 100}%` }} onClick={() => selectAudioTrack(track)}><span>{track.name}</span></button></div></div>)}</div></div>}
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
