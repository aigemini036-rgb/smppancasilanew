import {
  getSchoolSettings,
  getPeople,
  getNewsList,
  getAnnouncements,
  getAgenda,
  getAchievements,
  getGalleries,
  getGalleryImages,
  getFacilities,
  getMediaFiles,
  saveSchoolSettings,
  savePeople,
  saveNewsList,
  saveAnnouncements,
  saveAgenda,
  saveAchievements,
  saveGalleries,
  saveGalleryImages,
  saveFacilities,
} from '../utils/storage';
import { getAdminUsers, saveAdminUsers } from '../utils/auth';
import { fetchMysqlStatus, MysqlStatusInfo, MysqlSyncResult } from './mysqlService';

export interface CloudSyncStatus {
  serverConnected: boolean;
  mysqlConnected: boolean;
  lastSyncedAt: string | null;
  syncSource: 'mysql' | 'server' | 'local';
}

let autoSyncTimer: any = null;
let autoPushDebounceTimer: any = null;
let isSyncing = false;
let lastSyncedAtTimestamp: string | null = null;
let lastMysqlStatus: MysqlStatusInfo | null = null;
let broadcastChannel: BroadcastChannel | null = null;

const AUTO_SYNC_ENABLED_KEY = 'smp_auto_sync_enabled';
const AUTO_SYNC_INTERVAL_KEY = 'smp_auto_sync_interval_sec';
const DEFAULT_INTERVAL_SEC = 15;

if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  try {
    broadcastChannel = new BroadcastChannel('smp_school_sync_broadcast');
    broadcastChannel.onmessage = (event) => {
      if (event?.data?.type === 'DATA_MUTATED') {
        initCloudSync(true).catch(() => {});
      }
    };
  } catch {
    // BroadcastChannel unsupported or restricted
  }
}

export function isAutoSyncEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem(AUTO_SYNC_ENABLED_KEY);
  return val === null ? true : val === 'true';
}

export function setAutoSyncEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_SYNC_ENABLED_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
  notifyAutoSyncStatus();
}

export function getAutoSyncInterval(): number {
  if (typeof window === 'undefined') return DEFAULT_INTERVAL_SEC;
  const val = localStorage.getItem(AUTO_SYNC_INTERVAL_KEY);
  const parsed = val ? parseInt(val, 10) : DEFAULT_INTERVAL_SEC;
  return isNaN(parsed) || parsed < 5 ? DEFAULT_INTERVAL_SEC : parsed;
}

export function setAutoSyncInterval(seconds: number): void {
  if (typeof window === 'undefined') return;
  const safeSec = Math.max(5, Math.min(300, seconds));
  localStorage.setItem(AUTO_SYNC_INTERVAL_KEY, safeSec.toString());
  if (isAutoSyncEnabled()) {
    startAutoSync(safeSec);
  }
  notifyAutoSyncStatus();
}

export function isAutoSyncRunning(): boolean {
  return autoSyncTimer !== null;
}

export function getLastSyncTime(): string | null {
  return lastSyncedAtTimestamp;
}

export function getCachedMysqlStatus(): MysqlStatusInfo | null {
  return lastMysqlStatus;
}

function notifyAutoSyncStatus() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('smp-auto-sync-status-changed', {
      detail: {
        enabled: isAutoSyncEnabled(),
        running: isAutoSyncRunning(),
        interval: getAutoSyncInterval(),
        lastSync: lastSyncedAtTimestamp,
        mysqlConnected: Boolean(lastMysqlStatus?.connected),
      },
    })
  );
}

export function startAutoSync(intervalSeconds?: number): void {
  if (typeof window === 'undefined') return;

  stopAutoSync();

  const sec = intervalSeconds || getAutoSyncInterval();
  const intervalMs = sec * 1000;

  autoSyncTimer = setInterval(() => {
    if (!document.hidden) {
      initCloudSync(false).catch(() => {});
    }
  }, intervalMs);

  notifyAutoSyncStatus();
}

export function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  notifyAutoSyncStatus();
}

export function scheduleAutoPush(delayMs = 800): void {
  if (typeof window === 'undefined') return;

  if (autoPushDebounceTimer) {
    clearTimeout(autoPushDebounceTimer);
  }

  autoPushDebounceTimer = setTimeout(async () => {
    try {
      await pushAllLocalDataToServer();
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'DATA_MUTATED', timestamp: Date.now() });
      }
    } catch (e) {
      console.warn('[AutoSync] Background push error:', e);
    }
  }, delayMs);
}

if (typeof window !== 'undefined') {
  const handleWakeOrFocus = () => {
    if (isAutoSyncEnabled()) {
      initCloudSync(false).catch(() => {});
    }
  };

  window.addEventListener('focus', handleWakeOrFocus);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isAutoSyncEnabled()) {
      handleWakeOrFocus();
    }
  });

  window.addEventListener('online', handleWakeOrFocus);

  window.addEventListener('smp-trigger-auto-push', () => {
    scheduleAutoPush(800);
  });
}

export async function initCloudSync(silent = false): Promise<{ success: boolean; message: string }> {
  if (typeof window === 'undefined') return { success: false, message: 'SSR environment' };

  if (isSyncing) {
    return { success: true, message: 'Sinkronisasi sedang berlangsung...' };
  }

  isSyncing = true;

  try {
    // 1. Check MySQL connection status on server
    try {
      lastMysqlStatus = await fetchMysqlStatus();
    } catch {
      lastMysqlStatus = null;
    }

    // 2. Fetch central store from /api/data (reads from MySQL when configured, else server store.json)
    let serverUpdated = false;
    try {
      const res = await fetch('/api/data');
      if (res.ok) {
        const store = await res.json();
        if (store && typeof store === 'object' && Object.keys(store).length > 0) {
          if (store.settings && store.settings.school_name) {
            localStorage.setItem('smp_pancasila_settings', JSON.stringify(store.settings));
            serverUpdated = true;
          }
          if (Array.isArray(store.people) && store.people.length > 0) {
            localStorage.setItem('smp_pancasila_people', JSON.stringify(store.people));
            serverUpdated = true;
          }
          if (Array.isArray(store.news) && store.news.length > 0) {
            localStorage.setItem('smp_pancasila_news', JSON.stringify(store.news));
            serverUpdated = true;
          }
          if (Array.isArray(store.announcements) && store.announcements.length > 0) {
            localStorage.setItem('smp_pancasila_announcements', JSON.stringify(store.announcements));
            serverUpdated = true;
          }
          if (Array.isArray(store.agendas) && store.agendas.length > 0) {
            localStorage.setItem('smp_pancasila_agendas', JSON.stringify(store.agendas));
            serverUpdated = true;
          }
          if (Array.isArray(store.achievements) && store.achievements.length > 0) {
            localStorage.setItem('smp_pancasila_achievements', JSON.stringify(store.achievements));
            serverUpdated = true;
          }
          if (Array.isArray(store.galleries) && store.galleries.length > 0) {
            localStorage.setItem('smp_pancasila_galleries', JSON.stringify(store.galleries));
            serverUpdated = true;
          }
          if (Array.isArray(store.gallery_images) && store.gallery_images.length > 0) {
            localStorage.setItem('smp_pancasila_gallery_images', JSON.stringify(store.gallery_images));
            serverUpdated = true;
          }
          if (Array.isArray(store.facilities) && store.facilities.length > 0) {
            localStorage.setItem('smp_pancasila_facilities', JSON.stringify(store.facilities));
            serverUpdated = true;
          }
          if (Array.isArray(store.users) && store.users.length > 0) {
            localStorage.setItem('smp_pancasila_admin_users_list', JSON.stringify(store.users));
            serverUpdated = true;
          }
        } else {
          await pushAllLocalDataToServer();
        }
      }
    } catch {
      // Backend server unavailable / offline mode
    }

    lastSyncedAtTimestamp = new Date().toLocaleTimeString('id-ID');

    window.dispatchEvent(
      new CustomEvent('smp-data-sync-complete', {
        detail: {
          serverUpdated,
          mysqlConnected: Boolean(lastMysqlStatus?.connected),
          silent,
          timestamp: new Date().toISOString(),
          displayTime: lastSyncedAtTimestamp,
        },
      })
    );

    notifyAutoSyncStatus();

    return {
      success: true,
      message: lastMysqlStatus?.connected
        ? 'Data berhasil disinkronkan dengan database MySQL.'
        : 'Data berhasil disinkronkan dengan server pusat.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gagal melakukan sinkronisasi data.',
    };
  } finally {
    isSyncing = false;
  }
}

export async function pushAllLocalDataToServer(): Promise<MysqlSyncResult> {
  const settings = getSchoolSettings();
  const people = getPeople();
  const news = getNewsList();
  const announcements = getAnnouncements();
  const agendas = getAgenda();
  const achievements = getAchievements();
  const galleries = getGalleries();
  const gallery_images = getGalleryImages();
  const facilities = getFacilities();
  const media = getMediaFiles();
  const users = getAdminUsers();

  const payload = {
    settings,
    people,
    news,
    announcements,
    agendas,
    achievements,
    galleries,
    gallery_images,
    facilities,
    media,
    users,
    exported_at: new Date().toISOString(),
  };

  const counts = {
    settings: 1,
    people: people.length,
    news: news.length,
    announcements: announcements.length,
    agendas: agendas.length,
    achievements: achievements.length,
    galleries: galleries.length,
    galleryImages: gallery_images.length,
    facilities: facilities.length,
    users: users.length,
  };

  let serverOk = false;
  let mysqlSynced = false;
  let serverMsg = '';

  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      serverOk = true;
      mysqlSynced = Boolean(json?.mysqlSynced);
      serverMsg = json?.message || 'Data berhasil disimpan ke server & database MySQL.';
    } else {
      serverMsg = `Server merespon status ${res.status}`;
    }
  } catch (err: any) {
    serverMsg = `Kendala koneksi ke server: ${err.message}`;
  }

  lastSyncedAtTimestamp = new Date().toLocaleTimeString('id-ID');

  window.dispatchEvent(
    new CustomEvent('smp-data-sync-complete', {
      detail: {
        pushed: true,
        mysqlConnected: mysqlSynced || Boolean(lastMysqlStatus?.connected),
        timestamp: new Date().toISOString(),
        displayTime: lastSyncedAtTimestamp,
      },
    })
  );

  notifyAutoSyncStatus();

  return {
    success: serverOk,
    mysqlSynced,
    counts,
    message: serverOk ? serverMsg : `Gagal mengirim data: ${serverMsg}`,
  };
}

export async function pullAllDataFromServer(): Promise<{
  success: boolean;
  message: string;
}> {
  return await initCloudSync(false);
}

export function exportBackupJson(): void {
  const backupData = {
    school: 'SMP Pancasila Ponokawan Sidoarjo',
    version: '1.0',
    exported_at: new Date().toISOString(),
    settings: getSchoolSettings(),
    people: getPeople(),
    news: getNewsList(),
    announcements: getAnnouncements(),
    agendas: getAgenda(),
    achievements: getAchievements(),
    galleries: getGalleries(),
    gallery_images: getGalleryImages(),
    facilities: getFacilities(),
    users: getAdminUsers(),
  };

  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(backupData, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  const dateStr = new Date().toISOString().split('T')[0];
  downloadAnchor.setAttribute('download', `backup-smp-pancasila-${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function importBackupJson(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const data = JSON.parse(jsonString);

    if (data.settings) saveSchoolSettings(data.settings);
    if (Array.isArray(data.people)) savePeople(data.people);
    if (Array.isArray(data.news)) saveNewsList(data.news);
    if (Array.isArray(data.announcements)) saveAnnouncements(data.announcements);
    if (Array.isArray(data.agendas)) saveAgenda(data.agendas);
    if (Array.isArray(data.achievements)) saveAchievements(data.achievements);
    if (Array.isArray(data.galleries)) saveGalleries(data.galleries);
    if (Array.isArray(data.gallery_images)) saveGalleryImages(data.gallery_images);
    if (Array.isArray(data.facilities)) saveFacilities(data.facilities);
    if (Array.isArray(data.users)) saveAdminUsers(data.users);

    await pushAllLocalDataToServer();

    window.dispatchEvent(
      new CustomEvent('smp-data-sync-complete', {
        detail: { imported: true, timestamp: new Date().toISOString() },
      })
    );

    return {
      success: true,
      message: 'File cadangan berhasil diimpor dan disinkronkan ke server & MySQL!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `File backup tidak valid: ${err.message}`,
    };
  }
}
