const DATABASE_NAME = 'asharqawi-studio';
const DATABASE_VERSION = 1;
const ASSET_STORE = 'assets';
const TASKS_KEY = 'asharqawi-studio-tasks';
const FILE_LIMITS = {
  image: 20 * 1024 * 1024,
  video: 80 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
  subtitle: 1024 * 1024,
};

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('التخزين المحلي غير متاح في هذا المتصفح.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE)) {
        request.result.createObjectStore(ASSET_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذر فتح مكتبة المواد.'));
  });
}

function classifyFile(file) {
  const mimeType = String(file.type || '').toLowerCase();
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'text/vtt' || mimeType === 'application/x-subrip' || (mimeType === 'text/plain' && ['vtt', 'srt'].includes(extension))) return 'subtitle';
  return null;
}

export async function saveStudioAsset(source, metadata = {}) {
  let blob = source instanceof Blob ? source : null;
  let remoteUrl = null;

  if (!blob && typeof source === 'string') {
    if (source.startsWith('data:')) {
      blob = await fetch(source).then((response) => response.blob());
    } else if (/^https?:\/\//i.test(source)) {
      remoteUrl = source;
    }
  }

  if (!blob && !remoteUrl) {
    throw new Error('صيغة المادة غير مدعومة.');
  }

  const type = metadata.type || (blob ? classifyFile(blob) : null) || 'video';
  const limit = FILE_LIMITS[type];
  if (blob && !limit) {
    throw new Error('نوع الملف غير مدعوم.');
  }
  if (blob && blob.size > limit) {
    throw new Error('حجم الملف أكبر من الحد المسموح لهذا النوع.');
  }
  if (blob && !classifyFile(blob) && !metadata.allowGeneratedImage) {
    throw new Error('الأنواع المسموحة: صور، فيديو، صوت، وملفات ترجمة VTT/SRT.');
  }

  const asset = {
    id: createId(),
    name: String(metadata.name || 'مادة بدون اسم').replace(/[\\/\0]/g, '').slice(0, 120),
    type,
    mimeType: blob?.type || metadata.mimeType || '',
    size: blob?.size || 0,
    createdAt: new Date().toISOString(),
    blob,
    url: remoteUrl,
  };

  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).put(asset);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('تعذر حفظ المادة.'));
  });
  database.close();
  return { ...asset, blob: undefined };
}

export async function listStudioAssets() {
  const database = await openDatabase();
  const assets = await new Promise((resolve, reject) => {
    const request = database.transaction(ASSET_STORE, 'readonly').objectStore(ASSET_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('تعذر قراءة المواد.'));
  });
  database.close();
  return assets.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function getStudioAsset(id) {
  const database = await openDatabase();
  const asset = await new Promise((resolve, reject) => {
    const request = database.transaction(ASSET_STORE, 'readonly').objectStore(ASSET_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('تعذر فتح المادة.'));
  });
  database.close();
  return asset;
}

export async function deleteStudioAsset(id) {
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE, 'readwrite');
    transaction.objectStore(ASSET_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('تعذر حذف المادة.'));
  });
  database.close();
}

export function saveStudioTask(task) {
  try {
    const existing = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    const record = {
      id: createId(),
      createdAt: new Date().toISOString(),
      ...task,
    };
    localStorage.setItem(TASKS_KEY, JSON.stringify([record, ...existing].slice(0, 100)));
    return record;
  } catch {
    return null;
  }
}

export function listStudioTasks() {
  try {
    const tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return Array.isArray(tasks) ? tasks : [];
  } catch {
    return [];
  }
}

export function deleteStudioTask(id) {
  try {
    const tasks = listStudioTasks().filter((task) => task.id !== id);
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // Keep the UI usable when browser storage is disabled.
  }
}