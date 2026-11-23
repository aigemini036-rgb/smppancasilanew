import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  FileCode,
  Layers,
  Info,
  Server,
  Download,
  Radio,
  Timer,
  Terminal,
} from 'lucide-react';
import {
  fetchMysqlStatus,
  testMysqlServerConnection,
  MysqlStatusInfo,
  MysqlSyncResult,
} from '../../services/mysqlService';
import {
  getPeople,
  getNewsList,
  getAnnouncements,
  getAchievements,
  getGalleries,
  getFacilities,
} from '../../utils/storage';
import {
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  getAutoSyncInterval,
  setAutoSyncInterval,
  isAutoSyncRunning,
  getLastSyncTime,
  pullAllDataFromServer,
  pushAllLocalDataToServer,
} from '../../services/cloudSync';

const REQUIRED_TABLES = [
  'school_settings',
  'people',
  'news',
  'announcements',
  'agendas',
  'achievements',
  'galleries',
  'gallery_images',
  'facilities',
  'admin_users',
  'media_files',
];

export default function MysqlIntegration() {
  const [mysqlStatus, setMysqlStatus] = useState<MysqlStatusInfo | null>(null);
  const [testing, setTesting] = useState(false);

  const [syncingUp, setSyncingUp] = useState(false);
  const [syncingDown, setSyncingDown] = useState(false);
  const [syncResult, setSyncResult] = useState<MysqlSyncResult | null>(null);

  const [activeTab, setActiveTab] = useState<'status' | 'schema' | 'queries' | 'sync' | 'guide'>('schema');
  const [schemaSql, setSchemaSql] = useState<string>('');
  const [queriesSql, setQueriesSql] = useState<string>('');
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedQueries, setCopiedQueries] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedClientIp, setCopiedClientIp] = useState(false);

  const [autoSync, setAutoSync] = useState<boolean>(isAutoSyncEnabled());
  const [autoSyncRunning, setAutoSyncRunning] = useState<boolean>(isAutoSyncRunning());
  const [syncInterval, setSyncInterval] = useState<number>(getAutoSyncInterval());
  const [lastSyncDisplay, setLastSyncDisplay] = useState<string | null>(getLastSyncTime());
  const [autoSyncMsg, setAutoSyncMsg] = useState<string | null>(null);

  const localStats = {
    teachers: getPeople().length,
    news: getNewsList().length,
    announcements: getAnnouncements().length,
    achievements: getAchievements().length,
    galleries: getGalleries().length,
    facilities: getFacilities().length,
  };

  useEffect(() => {
    fetchMysqlStatus().then(setMysqlStatus).catch(() => {});

    fetch('/mysql-schema.sql')
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (text) setSchemaSql(text);
      })
      .catch(() => {});

    fetch('/mysql-queries.sql')
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        if (text) setQueriesSql(text);
      })
      .catch(() => {});

    const handleSyncComplete = (e: any) => {
      setLastSyncDisplay(e?.detail?.displayTime || new Date().toLocaleTimeString('id-ID'));
    };
    const handleAutoSyncStatus = (e: any) => {
      if (e?.detail) {
        setAutoSync(e.detail.enabled);
        setAutoSyncRunning(e.detail.running);
        setSyncInterval(e.detail.interval);
        if (e.detail.lastSync) setLastSyncDisplay(e.detail.lastSync);
      }
    };

    window.addEventListener('smp-data-sync-complete', handleSyncComplete);
    window.addEventListener('smp-auto-sync-status-changed', handleAutoSyncStatus);

    return () => {
      window.removeEventListener('smp-data-sync-complete', handleSyncComplete);
      window.removeEventListener('smp-auto-sync-status-changed', handleAutoSyncStatus);
    };
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await testMysqlServerConnection();
      setMysqlStatus(res);
    } finally {
      setTesting(false);
    }
  };

  const handleCopySchema = () => {
    if (!schemaSql) return;
    navigator.clipboard.writeText(schemaSql);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleCopyQueries = () => {
    if (!queriesSql) return;
    navigator.clipboard.writeText(queriesSql);
    setCopiedQueries(true);
    setTimeout(() => setCopiedQueries(false), 2500);
  };

  const envTemplate = `# Konfigurasi MySQL Server (Hostinger / VPS / Localhost)
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="3306"
MYSQL_USER="u637089879_user_pancasila"
MYSQL_PASSWORD="MASUKKAN_PASSWORD_MYSQL_ANDA"
MYSQL_DATABASE="u637089879_db_pancasila"
APP_URL="http://localhost:3000"`;

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2500);
  };

  const handleDownloadEnv = () => {
    const blob = new Blob([envTemplate + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env.example';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncToMysql = async () => {
    setSyncingUp(true);
    setSyncResult(null);
    try {
      const res = await pushAllLocalDataToServer();
      setSyncResult(res);
      setLastSyncDisplay(new Date().toLocaleTimeString('id-ID'));
      await handleTestConnection();
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Gagal mengirim data ke server MySQL.',
      });
    } finally {
      setSyncingUp(false);
    }
  };

  const handleSyncFromMysql = async () => {
    setSyncingDown(true);
    setSyncResult(null);
    try {
      const res = await pullAllDataFromServer();
      setSyncResult({
        success: res.success,
        message: res.message,
      });
      setLastSyncDisplay(new Date().toLocaleTimeString('id-ID'));
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || 'Gagal menarik data dari server MySQL.',
      });
    } finally {
      setSyncingDown(false);
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    setAutoSync(enabled);
    setAutoSyncRunning(enabled);
    setAutoSyncMsg(
      enabled
        ? 'Sinkronisasi otomatis diaktifkan.'
        : 'Sinkronisasi otomatis dijeda.'
    );
    setTimeout(() => setAutoSyncMsg(null), 3500);
  };

  const handleChangeInterval = (sec: number) => {
    setAutoSyncInterval(sec);
    setSyncInterval(sec);
    setAutoSyncMsg(`Interval sinkronisasi diatur ke ${sec} detik.`);
    setTimeout(() => setAutoSyncMsg(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
              <Database className="w-3 h-3" />
              MySQL / MariaDB Ready
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {mysqlStatus?.database || 'u637089879_db_pancasila'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Database className="w-7 h-7 text-blue-500" />
            <span>Database MySQL & Query SQL</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Skema tabel MySQL, kumpulan query CRUD untuk phpMyAdmin, serta manajemen koneksi dan sinkronisasi data sekolah.
          </p>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center gap-2">
          {mysqlStatus?.connected ? (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>MySQL Terhubung</span>
              {mysqlStatus.latencyMs !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">
                  {mysqlStatus.latencyMs}ms
                </span>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Mode Store Server Lokal</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('schema')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'schema'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>1. Skema Tabel (mysql-schema.sql)</span>
        </button>

        <button
          onClick={() => setActiveTab('queries')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'queries'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>2. Query CRUD SQL</span>
        </button>

        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'status'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>3. Status & Koneksi .env</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'sync'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>4. Sinkronisasi Data</span>
        </button>

        <button
          onClick={() => setActiveTab('guide')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'guide'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Info className="w-4 h-4" />
          <span>5. Panduan phpMyAdmin</span>
        </button>
      </div>

      {/* TAB 1: SCHEMA SQL */}
      {activeTab === 'schema' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-blue-500" />
                <span>Skrip Pembuatan Tabel MySQL (mysql-schema.sql)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Salin skrip ini lalu tempel ke tab <strong>SQL</strong> di phpMyAdmin database{' '}
                <code className="font-mono text-blue-600 dark:text-blue-400 font-bold">u637089879_db_pancasila</code> dan klik <strong>Go</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopySchema}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                {copiedSchema ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedSchema ? 'Tersalin!' : 'Salin Skrip SQL'}</span>
              </button>

              <a
                href="/mysql-schema.sql"
                download="mysql-schema.sql"
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Unduh .sql</span>
              </a>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200">
            <strong>11 Tabel Otomatis Dibuat:</strong>{' '}
            <span className="font-mono">
              school_settings, people, news, announcements, agendas, achievements, galleries, gallery_images, facilities, admin_users, media_files
            </span>{' '}
            beserta index, relasi foreign key, dan data awal sekolah.
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 text-slate-200 font-mono text-xs overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-800">
            <pre className="leading-relaxed whitespace-pre">
              {schemaSql || 'Memuat mysql-schema.sql...'}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: QUERIES SQL */}
      {activeTab === 'queries' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-500" />
                <span>Kumpulan Query CRUD MySQL (mysql-queries.sql)</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Contoh query SELECT, INSERT/UPSERT, UPDATE, JOIN, dan statistik dashboard siap pakai di phpMyAdmin.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyQueries}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                {copiedQueries ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedQueries ? 'Tersalin!' : 'Salin Semua Query'}</span>
              </button>

              <a
                href="/mysql-queries.sql"
                download="mysql-queries.sql"
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all flex items-center gap-1.5"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>Unduh .sql</span>
              </a>
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 text-slate-200 font-mono text-xs overflow-x-auto max-h-[520px] overflow-y-auto border border-slate-800">
            <pre className="leading-relaxed whitespace-pre">
              {queriesSql || 'Memuat mysql-queries.sql...'}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: STATUS & KONEKSI .ENV */}
      {activeTab === 'status' && (
        <div className="space-y-6">
          {mysqlStatus && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start gap-3.5 text-xs ${
                mysqlStatus.connected
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              }`}
            >
              {mysqlStatus.connected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">
                    {mysqlStatus.connected ? 'Koneksi MySQL Aktif' : 'MySQL Belum Terhubung'}
                  </p>
                  {mysqlStatus.errorCode && !mysqlStatus.connected && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 font-mono text-[10px] font-bold">
                      {mysqlStatus.errorCode}
                    </span>
                  )}
                </div>
                <p className="leading-relaxed">{mysqlStatus.message}</p>
                {!mysqlStatus.connected && mysqlStatus.errorCode === 'ER_ACCESS_DENIED_ERROR' && (
                  <div className="mt-2 p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-amber-300/60 dark:border-amber-700/50 space-y-2 text-[11px]">
                    <p className="font-bold">Cara Mengatasi Akses Ditolak (Hostinger Remote MySQL):</p>
                    <ol className="list-decimal pl-4 space-y-1 leading-relaxed">
                      <li>
                        Buka <strong>Hostinger hPanel → Databases → Remote MySQL</strong> untuk database{' '}
                        <code className="font-mono font-bold">{mysqlStatus.database}</code>.
                      </li>
                      <li>
                        Tambahkan <code className="font-mono font-bold">%</code> (Any Host) atau alamat IP server aplikasi ini
                        {mysqlStatus.clientIp ? (
                          <span className="inline-flex items-center gap-1.5 ml-1">
                            <code className="font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20">
                              {mysqlStatus.clientIp}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(mysqlStatus.clientIp || '');
                                setCopiedClientIp(true);
                                setTimeout(() => setCopiedClientIp(false), 2000);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] font-semibold"
                            >
                              {copiedClientIp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedClientIp ? 'Tersalin' : 'Salin IP'}</span>
                            </button>
                          </span>
                        ) : null}
                        , lalu klik <strong>Create</strong>.
                      </li>
                      <li>
                        Pastikan <code className="font-mono font-bold">MYSQL_USER</code> ({mysqlStatus.userMasked || 'user MySQL'}) dan{' '}
                        <code className="font-mono font-bold">MYSQL_PASSWORD</code> di Secrets sesuai dengan password user database di Hostinger (bukan password login hPanel).
                      </li>
                    </ol>
                  </div>
                )}
                {!mysqlStatus.connected && mysqlStatus.errorCode === 'NOT_CONFIGURED' && (
                  <p className="text-[11px] opacity-90 pt-1">
                    <strong>Catatan Hosting vs Preview:</strong> Variabel <code className="font-mono">.env</code> belum diisi, sehingga data sementara tetap tersimpan aman di <code className="font-mono">data/store.json</code>. Saat dijalankan dengan variabel <code className="font-mono">MYSQL_*</code> terisi, server Node.js otomatis terhubung ke MySQL.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center gap-1.5 shrink-0 hover:bg-slate-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Menguji...' : 'Tes Koneksi'}</span>
              </button>
            </div>
          )}

          {/* Env Variables Status Checklist */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              <span>Status Variabel Server MySQL</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {[
                { key: 'MYSQL_HOST', set: Boolean(mysqlStatus?.envStatus?.hostSet) },
                { key: 'MYSQL_PORT', set: Boolean(mysqlStatus?.envStatus?.portSet) },
                { key: 'MYSQL_USER', set: Boolean(mysqlStatus?.envStatus?.userSet) },
                { key: 'MYSQL_PASSWORD', set: Boolean(mysqlStatus?.envStatus?.passwordSet) },
                { key: 'MYSQL_DATABASE', set: Boolean(mysqlStatus?.envStatus?.databaseSet) },
              ].map((item) => (
                <div
                  key={item.key}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                >
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 truncate">
                    {item.key}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      item.set
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {item.set ? 'Terpasang' : 'Kosong'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Table Checklist */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-500" />
              <span>Status 11 Tabel Database MySQL</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {REQUIRED_TABLES.map((tbl) => {
                const exists = mysqlStatus?.tablesFound?.includes(tbl);
                return (
                  <div
                    key={tbl}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{tbl}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        exists
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {exists ? 'Tersedia' : 'Menunggu SQL'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Server .env Template */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Variabel Environment Server (.env)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Atur variabel berikut di environment server hosting Anda (password tidak pernah disimpan di file publik/browser).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyEnv}
                  className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1.5"
                >
                  {copiedEnv ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedEnv ? 'Tersalin' : 'Salin .env'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadEnv}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh .env.example</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 text-slate-300 font-mono text-xs overflow-x-auto border border-slate-800">
              <pre className="leading-relaxed">{envTemplate}</pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SINKRONISASI DATA */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          {/* Auto-Sync Control */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Sinkronisasi Otomatis Server & MySQL
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Setiap perubahan konten di panel admin otomatis dikirim ke API server dan disimpan ke MySQL.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleToggleAutoSync(!autoSync)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  autoSync
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                {autoSync ? 'Auto-Sync: AKTIF' : 'Auto-Sync: NONAKTIF'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold">
                <Timer className="w-4 h-4 text-blue-500" />
                Interval Cek Pembaruan:
              </span>
              {[10, 15, 30, 60].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => handleChangeInterval(sec)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                    syncInterval === sec
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {sec} detik
                </button>
              ))}
              {lastSyncDisplay && (
                <span className="text-slate-400 font-mono ml-auto">
                  Terakhir sinkron: {lastSyncDisplay} {autoSyncRunning ? '(Berjalan)' : ''}
                </span>
              )}
            </div>

            {autoSyncMsg && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-200 font-semibold">
                {autoSyncMsg}
              </div>
            )}
          </div>

          {/* Local stats + Manual Sync */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Personel', count: localStats.teachers },
                { label: 'Berita', count: localStats.news },
                { label: 'Pengumuman', count: localStats.announcements },
                { label: 'Prestasi', count: localStats.achievements },
                { label: 'Album Galeri', count: localStats.galleries },
                { label: 'Fasilitas', count: localStats.facilities },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-center"
                >
                  <p className="text-xl font-black text-slate-900 dark:text-white">{stat.count}</p>
                  <p className="text-[11px] text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {syncResult && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
                  syncResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                }`}
              >
                {syncResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <p className="font-semibold">{syncResult.message}</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-blue-500" />
                  <span>Kirim Data Lokal ke Server & MySQL</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Unggah seluruh data CMS saat ini dari browser ke backend server dan database MySQL.
                </p>
                <button
                  type="button"
                  onClick={handleSyncToMysql}
                  disabled={syncingUp}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{syncingUp ? 'Mengunggah...' : 'Unggah Semua Data ke MySQL'}</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-emerald-500" />
                  <span>Tarik Data Terbaru dari MySQL</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ambil data terbaru yang tersimpan di server/database MySQL ke browser ini.
                </p>
                <button
                  type="button"
                  onClick={handleSyncFromMysql}
                  disabled={syncingDown}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <DownloadCloud className="w-4 h-4" />
                  <span>{syncingDown ? 'Menarik Data...' : 'Tarik Data dari MySQL'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PANDUAN PHPMYADMIN */}
      {activeTab === 'guide' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-500" />
            <span>Panduan Setup Database MySQL di phpMyAdmin (Hostinger)</span>
          </h2>

          <ol className="list-decimal pl-5 space-y-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <li>
              Buka <strong>phpMyAdmin</strong> pada panel Hostinger Anda, lalu pilih database{' '}
              <code className="font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-bold">
                u637089879_db_pancasila
              </code>{' '}
              di panel sebelah kiri.
            </li>
            <li>
              Klik tab <strong>SQL</strong> di bagian atas, lalu buka tab{' '}
              <strong>1. Skema Tabel (mysql-schema.sql)</strong> di halaman ini dan klik{' '}
              <strong>Salin Skrip SQL</strong>.
            </li>
            <li>
              Tempel (<em>Paste</em>) skrip SQL ke kotak editor phpMyAdmin, pastikan opsi{' '}
              <em>Enable foreign key checks</em> tetap dicentang, lalu klik tombol <strong>Go</strong>.
            </li>
            <li>
              Setelah ke-11 tabel berhasil dibuat, masukkan kredensial MySQL Anda ke file{' '}
              <code className="font-mono font-bold">.env</code> di server Node.js ({' '}
              <code className="font-mono">MYSQL_HOST</code>, <code className="font-mono">MYSQL_USER</code>,{' '}
              <code className="font-mono">MYSQL_PASSWORD</code>, <code className="font-mono">MYSQL_DATABASE</code>).
            </li>
            <li>
              Jalankan ulang server lalu tekan tombol <strong>Tes Koneksi</strong> di tab{' '}
              <strong>3. Status & Koneksi .env</strong> untuk memastikan semua tabel terbaca aktif.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
