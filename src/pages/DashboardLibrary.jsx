import React, { useEffect, useState } from 'react';
import {
  deleteStudioAsset,
  deleteStudioTask,
  listStudioAssets,
  listStudioTasks,
  saveStudioAsset,
} from '../services/studioLibrary';
import { generateImage } from '../services/imageGenerator';
import { generateScript } from '../services/scriptGenerator';
import { generateVideo } from '../services/videoGenerator';

function DashboardLibraryPage() {
  const [activeTab, setActiveTab] = useState('materials');
  const [assets, setAssets] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assetUrls, setAssetUrls] = useState({});
    const [providerStatuses, setProviderStatuses] = useState({});
    const [providerModels, setProviderModels] = useState({});
    const [generationDefaults, setGenerationDefaults] = useState({});
    const [busyTaskId, setBusyTaskId] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const refresh = async () => {
    try {
      const nextAssets = await listStudioAssets();
      const nextUrls = {};
      for (const asset of nextAssets) {
        if (asset.blob) nextUrls[asset.id] = URL.createObjectURL(asset.blob);
        else if (asset.url) nextUrls[asset.id] = asset.url;
      }
      setAssetUrls((previous) => {
        Object.values(previous).forEach((url) => {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        return nextUrls;
      });
      setAssets(nextAssets);
      setTasks(listStudioTasks());
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error?.message || 'تعذر تحميل المكتبة المحلية.');
    }
  };

  useEffect(() => {
    refresh();
    fetch('/api/settings')
      .then((response) => response.json())
      .then((data) => {
        setProviderStatuses(data.providers || {});
        setProviderModels(data.models || {});
        setGenerationDefaults(data.defaults || {});
      })
      .catch(() => setProviderStatuses({}));
  }, []);

  useEffect(() => () => Object.values(assetUrls).forEach((url) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  }), [assetUrls]);

  const goHome = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleDeleteAsset = async (id) => {
    await deleteStudioAsset(id);
    refresh();
  };

  const handleDeleteTask = (id) => {
    deleteStudioTask(id);
    setTasks(listStudioTasks());
  };

  const handleDownload = (asset) => {

      const handleRegenerate = async (task) => {
        if (task.type === 'project') {
          if (task.payload?.prompt) sessionStorage.setItem('asharqawi-video-prompt', task.payload.prompt);
          if (task.result?.url) sessionStorage.setItem('asharqawi-selected-video-url', task.result.url);
          window.history.pushState({}, '', '/dashboard/video');
          window.dispatchEvent(new PopStateEvent('popstate'));
          return;
        }
        setBusyTaskId(task.id);
        let response;
        if (task.type === 'image') {
          response = await generateImage({ ...task.payload, description: task.payload?.description || '' });
        } else if (task.type === 'video') {
          response = await generateVideo({ ...task.payload, prompt: task.payload?.prompt || '' });
        } else {
          response = await generateScript(task.payload || {});
        }
        if (response.status !== 'success') {
          setErrorMessage(response.error || 'تعذرت إعادة التوليد.');
          setBusyTaskId(null);
          return;
        }
        let result = response.result;
        if (task.type === 'image' && result?.imageUrl) {
          const asset = await saveStudioAsset(result.imageUrl, { name: `asharqawi-image-${Date.now()}.png`, type: 'image' }).catch(() => null);
          result = { assetId: asset?.id || null };
        }
        if (task.type === 'video' && result?.videoUrl) {
          const asset = await saveStudioAsset(result.videoUrl, { name: `asharqawi-video-${Date.now()}.mp4`, type: 'video' }).catch(() => null);
          result = { assetId: asset?.id || null, url: result.videoUrl };
        }
        const { id: previousId, createdAt: previousDate, ...originalTask } = task;
        saveStudioTask({ ...originalTask, status: 'completed', result, error: null });
        setBusyTaskId(null);
        refresh();
      };

      const handleTaskDownload = async (task) => {
        if (task.type === 'script' && task.result) {
          const script = task.result;
          const text = [
            `العنوان: ${script.title || ''}`,
            `المقدمة: ${script.hook || ''}`,
            `المشاهد:\n${(script.scenes || []).join('\n')}`,
            `التعليق الصوتي: ${script.voiceover || ''}`,
            `النهاية: ${script.ending || ''}`,
            `CTA: ${script.cta || ''}`,
          ].join('\n\n');
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
          const link = document.createElement('a');
          link.href = url;
          link.download = 'asharqawi-script.txt';
          link.click();
          URL.revokeObjectURL(url);
          return;
        }
        if (task.result?.url) {
          const link = document.createElement('a');
          link.href = task.result.url;
          link.download = task.type === 'video' ? 'asharqawi-video.mp4' : 'asharqawi-result';
          link.target = '_blank';
          link.click();
          return;
        }
        const asset = task.result?.assetId ? await getStudioAsset(task.result.assetId) : null;
        if (!asset?.blob) return;
        const url = URL.createObjectURL(asset.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = asset.name;
        link.click();
        URL.revokeObjectURL(url);
      };

      const handleUseInProject = async (asset) => {
        if (asset.type === 'image') {
          sessionStorage.setItem('asharqawi-selected-image-asset', asset.id);
          window.history.pushState({}, '', '/dashboard/image');
        } else if (asset.type === 'video' && asset.url) {
          sessionStorage.setItem('asharqawi-selected-video-url', asset.url);
          window.history.pushState({}, '', '/dashboard/video');
        } else if (asset.type === 'audio' && asset.blob) {
          if (asset.blob.size > 5 * 1024 * 1024) {
            setErrorMessage('هذا الملف الصوتي أكبر من حد النقل الآمن إلى مشروع الفيديو.');
            return;
          }
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('تعذر قراءة الملف الصوتي.'));
            reader.readAsDataURL(asset.blob);
          });
          sessionStorage.setItem('asharqawi-selected-audio-url', dataUrl);
          window.history.pushState({}, '', '/dashboard/video');
        } else if (asset.type === 'subtitle' && asset.blob) {
          let subtitleText = await asset.blob.text();
          if (asset.name.toLowerCase().endsWith('.srt')) {
            subtitleText = `WEBVTT\n\n${subtitleText.replace(/^\uFEFF/, '').replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
          }
          sessionStorage.setItem('asharqawi-selected-subtitles', subtitleText);
          window.history.pushState({}, '', '/dashboard/video');
        } else {
          setErrorMessage('هذه المادة لا تتوافق مع منافذ المشروع الحالية.');
          return;
        }
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
                <button type="button" role="tab" aria-selected={activeTab === 'settings'} className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>الإعدادات</button>
    const url = assetUrls[asset.id];
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = asset.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUseScriptInVideo = (task) => {
    const script = task.result;
    const prompt = [script.title, script.hook, ...(script.scenes || []), script.voiceover, script.ending, script.cta]
      .filter(Boolean)
      .join('\n\n');
    sessionStorage.setItem('asharqawi-video-prompt', prompt);
    window.history.pushState({}, '', '/dashboard/video');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="dashboard-shell">
      <div className="background-glow glow-gold" />
      <div className="background-glow glow-cyan" />
      <header className="topbar container">
        <div className="brand-wrap" aria-label="شعار منصة الشرقاوي">
          <div className="brand-mark"><span>م</span></div>
          <div className="brand-copy"><small>منصة</small><strong>الشرقاوي</strong></div>
        </div>
        <button type="button" className="ghost-button" onClick={goHome}>الرئيسية</button>
      </header>
      <main className="container image-page-shell">
        <section className="image-generator-card card library-card">
          <div className="section-heading">
            <div><span className="mini-badge">Studio</span><h2>المواد والمشاريع</h2></div>
          </div>
          <div className="library-tabs" role="tablist" aria-label="المكتبة">
            <button type="button" role="tab" aria-selected={activeTab === 'materials'} className={activeTab === 'materials' ? 'active' : ''} onClick={() => setActiveTab('materials')}>المواد</button>
            <button type="button" role="tab" aria-selected={activeTab === 'tasks'} className={activeTab === 'tasks' ? 'active' : ''} onClick={() => setActiveTab('tasks')}>السجل</button>
          </div>
          {errorMessage && <div className="error-banner">{errorMessage}</div>}
          {activeTab === 'materials' && (
            <>
              <label className="upload-box library-upload">
                <span className="upload-plus">＋</span><span>إضافة مواد من الجهاز</span>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.vtt,.srt"
                  multiple
                  onChange={async (event) => {
                    const files = Array.from(event.target.files || []);
                    try {
                      for (const file of files) await saveStudioAsset(file, { name: file.name });
                      await refresh();
                    } catch (error) {
                      setErrorMessage(error?.message || 'تعذر حفظ الملف.');
                    } finally {
                      event.target.value = '';
                    }
                  }}
                />
              </label>
              {assets.length === 0 ? <div className="library-empty">لا توجد مواد محفوظة على هذا الجهاز.</div> : (
                <div className="library-asset-list">
                  {assets.map((asset) => (
                    <article className="library-asset" key={asset.id}>
                      {asset.type === 'image' && assetUrls[asset.id] && <img src={assetUrls[asset.id]} alt="" />}
                      {asset.type === 'video' && assetUrls[asset.id] && <video src={assetUrls[asset.id]} controls playsInline />}
                      {asset.type === 'audio' && assetUrls[asset.id] && <audio src={assetUrls[asset.id]} controls />}
                      <div className="library-asset-info"><strong>{asset.name}</strong><small>{asset.type} · {asset.size ? `${Math.ceil(asset.size / 1024)} KB` : 'رابط خارجي'}</small></div>
                      <div className="library-asset-actions">
                        <button type="button" className="mini-action-btn" onClick={() => handleUseInProject(asset)}>استخدام</button>
                        <button type="button" className="mini-action-btn" onClick={() => handleDownload(asset)}>تحميل</button>
                        <button type="button" className="mini-action-btn" onClick={() => handleDeleteAsset(asset.id)}>حذف</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
          {activeTab === 'tasks' && (
            tasks.length === 0 ? <div className="library-empty">لا يوجد سجل توليد بعد.</div> : (
              <div className="library-task-list">
                {tasks.map((task) => (
                  <article className="library-task" key={task.id}>
                    <div>
                      <strong>{task.title || task.type}</strong>
                      <small>{task.type} · {new Date(task.createdAt).toLocaleString('ar')}</small>
                    </div>
                    <span className={`task-state ${task.status}`}>{task.status === 'completed' ? 'مكتمل' : task.status === 'failed' ? 'فشل' : task.status}</span>
                    <div className="library-asset-actions">
                      {task.status === 'completed' && task.result && <button type="button" className="mini-action-btn" onClick={() => handleTaskDownload(task)}>تحميل</button>}
                      {task.type === 'script' && task.result && <button type="button" className="mini-action-btn" onClick={() => handleUseScriptInVideo(task)}>استخدم في الفيديو</button>}
                      <button type="button" className="mini-action-btn" disabled={busyTaskId === task.id} onClick={() => handleRegenerate(task)}>{busyTaskId === task.id ? 'جارٍ...' : task.type === 'project' ? 'فتح' : 'إعادة'}</button>
                      <button type="button" className="mini-action-btn" onClick={() => handleDeleteTask(task.id)}>حذف</button>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
          {activeTab === 'settings' && (
            <div className="provider-status-list">
              {Object.entries({ image: 'توليد الصور', video: 'توليد الفيديو', script: 'كتابة السكريبت', voice: 'التعليق الصوتي', music: 'الموسيقى', composer: 'تركيب الفيديو' }).map(([key, label]) => (
                <div className="provider-status-row" key={key}>
                  <span>{label}</span>
                  <strong className={providerStatuses[key] === 'Connected' ? 'provider-connected' : 'provider-missing'}>{providerStatuses[key] || 'Unavailable'}</strong>
                </div>
              ))}
              <div className="provider-status-row">
                <span>النماذج</span>
                <strong>{Object.values(providerModels).flat().join(' · ') || 'غير متاحة'}</strong>
              </div>
              <div className="provider-status-row">
                <span>الإعدادات الافتراضية</span>
                <strong>{generationDefaults.video ? `${generationDefaults.video.duration} · ${generationDefaults.video.aspectRatio} · ${generationDefaults.video.quality}` : 'غير متاحة'}</strong>
              </div>
              <small className="helper-note">تعرض الحالة وجود الإعدادات فقط؛ لا يتم عرض المفاتيح أو اختبار صلاحيتها.</small>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default DashboardLibraryPage;