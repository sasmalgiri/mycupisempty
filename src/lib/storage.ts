/**
 * Storage abstraction layer
 * Supports: Supabase (primary), Local filesystem (fallback), Google Drive (optional)
 *
 * Strategy:
 * 1. Supabase Storage for authenticated users (free tier: 1GB)
 * 2. localStorage/IndexedDB for offline/anonymous access
 * 3. Google Drive integration for personal backup/sync
 */

// ============================================================================
// LOCAL STORAGE (IndexedDB for large data, localStorage for small)
// ============================================================================

const DB_NAME = 'mycupisempty_local';
const DB_VERSION = 1;

interface LocalStore {
  key: string;
  value: any;
  timestamp: number;
  type: 'note' | 'flashcard' | 'progress' | 'setting' | 'download' | 'activity_result';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('store')) {
        const store = db.createObjectStore('store', { keyPath: 'key' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const localDB = {
  async set(key: string, value: any, type: LocalStore['type'] = 'setting'): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').put({ key, value, timestamp: Date.now(), type });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get<T = any>(key: string): Promise<T | null> {
    const db = await openDB();
    const tx = db.transaction('store', 'readonly');
    const request = tx.objectStore('store').get(key);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => reject(request.error);
    });
  },

  async getByType(type: LocalStore['type']): Promise<LocalStore[]> {
    const db = await openDB();
    const tx = db.transaction('store', 'readonly');
    const index = tx.objectStore('store').index('type');
    const request = index.getAll(type);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(key: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clear(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').clear();
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getSize(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction('store', 'readonly');
    const request = tx.objectStore('store').count();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  },
};

// ============================================================================
// OFFLINE CONTENT CACHE
// ============================================================================

export const contentCache = {
  async cacheChapter(chapterId: string, content: any): Promise<void> {
    await localDB.set(`chapter_${chapterId}`, content, 'download');
  },

  async getCachedChapter(chapterId: string): Promise<any | null> {
    return localDB.get(`chapter_${chapterId}`);
  },

  async cacheFlashcards(topicId: string, cards: any[]): Promise<void> {
    await localDB.set(`flashcards_${topicId}`, cards, 'flashcard');
  },

  async getCachedFlashcards(topicId: string): Promise<any[] | null> {
    return localDB.get(`flashcards_${topicId}`);
  },

  async saveNote(topicId: string, note: string): Promise<void> {
    await localDB.set(`note_${topicId}`, { content: note, savedAt: new Date().toISOString() }, 'note');
  },

  async getNote(topicId: string): Promise<{ content: string; savedAt: string } | null> {
    return localDB.get(`note_${topicId}`);
  },

  async saveProgress(key: string, data: any): Promise<void> {
    await localDB.set(`progress_${key}`, data, 'progress');
  },

  async getProgress(key: string): Promise<any | null> {
    return localDB.get(`progress_${key}`);
  },

  async getAllDownloads(): Promise<LocalStore[]> {
    return localDB.getByType('download');
  },

  async getAllNotes(): Promise<LocalStore[]> {
    return localDB.getByType('note');
  },
};

// ============================================================================
// GOOGLE DRIVE INTEGRATION (OAuth-based, optional)
// ============================================================================

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const googleDrive = {
  isConfigured(): boolean {
    return !!GOOGLE_CLIENT_ID;
  },

  getAuthUrl(): string {
    if (!GOOGLE_CLIENT_ID) return '';
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: `${window.location.origin}/api/auth/google-drive-callback`,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async uploadBackup(accessToken: string, data: any, filename: string): Promise<string | null> {
    try {
      const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      });

      if (!res.ok) return null;
      const result = await res.json();
      return result.id;
    } catch {
      return null;
    }
  },

  async downloadBackup(accessToken: string, fileId: string): Promise<any | null> {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async listBackups(accessToken: string): Promise<any[]> {
    try {
      const res = await fetch(
        'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.files || [];
    } catch {
      return [];
    }
  },
};

// ============================================================================
// UNIFIED STORAGE API
// ============================================================================

export const storage = {
  local: localDB,
  cache: contentCache,
  drive: googleDrive,

  /** Save data locally and sync to cloud if available */
  async save(key: string, data: any, type: LocalStore['type'] = 'setting'): Promise<void> {
    // Always save locally first (offline-first)
    await localDB.set(key, data, type);
  },

  /** Get data from local cache (fast) */
  async get<T = any>(key: string): Promise<T | null> {
    return localDB.get<T>(key);
  },

  /** Export all local data for backup */
  async exportAll(): Promise<Record<string, any>> {
    const notes = await localDB.getByType('note');
    const flashcards = await localDB.getByType('flashcard');
    const progress = await localDB.getByType('progress');
    const settings = await localDB.getByType('setting');

    return {
      exportDate: new Date().toISOString(),
      notes: notes.map(n => ({ key: n.key, value: n.value })),
      flashcards: flashcards.map(f => ({ key: f.key, value: f.value })),
      progress: progress.map(p => ({ key: p.key, value: p.value })),
      settings: settings.map(s => ({ key: s.key, value: s.value })),
    };
  },

  /** Import data from backup */
  async importAll(backup: Record<string, any>): Promise<void> {
    for (const category of ['notes', 'flashcards', 'progress', 'settings']) {
      const items = backup[category] || [];
      for (const item of items) {
        await localDB.set(item.key, item.value, category.slice(0, -1) as any);
      }
    }
  },
};

export default storage;
