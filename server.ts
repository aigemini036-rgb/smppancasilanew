import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getMysqlEnvConfig,
  isMysqlInCooldown,
  testMysqlConnection,
  readAllStoreFromMysql,
  writeAllStoreToMysql,
  upsertMysqlRow,
  replaceMysqlTableRows,
  deleteMysqlRowById,
  STORE_TO_MYSQL_TABLE,
} from './src/db/mysql.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Data directory & fallback store path
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PUBLIC_DIR = path.resolve(__dirname, 'public');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as T;
    }
  } catch (err) {
    console.error(`[Server] Error reading ${filePath}:`, err);
  }
  return fallback;
}

function writeJsonFile<T>(filePath: string, data: T): boolean {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`[Server] Error writing ${filePath}:`, err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// API Endpoints: Health & MySQL Status
// -----------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  const mysqlCfg = getMysqlEnvConfig();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storeExists: fs.existsSync(STORE_PATH),
    mysqlConfigured: mysqlCfg.isConfigured,
    databaseEngine: mysqlCfg.isConfigured ? 'mysql' : 'local-store',
  });
});

app.get('/api/mysql/status', async (req, res) => {
  try {
    const status = await testMysqlConnection();
    res.json(status);
  } catch (err: any) {
    console.error('[Server] MySQL status error:', err?.message || err);
    res.status(500).json({
      configured: getMysqlEnvConfig().isConfigured,
      connected: false,
      tablesFound: [],
      message: 'Gagal memeriksa status koneksi MySQL.',
    });
  }
});

app.post('/api/mysql/test', async (req, res) => {
  try {
    const status = await testMysqlConnection(true);
    res.json(status);
  } catch (err: any) {
    console.error('[Server] MySQL test error:', err?.message || err);
    res.status(500).json({
      configured: getMysqlEnvConfig().isConfigured,
      connected: false,
      tablesFound: [],
      message: 'Terjadi kesalahan saat menguji koneksi MySQL.',
    });
  }
});

// -----------------------------------------------------------------------------
// API Endpoints: Centralized Data Store (MySQL + Local Fallback Sync)
// -----------------------------------------------------------------------------
app.get('/api/data', async (req, res) => {
  const localStore = readJsonFile<Record<string, any>>(STORE_PATH, {});

  if (getMysqlEnvConfig().isConfigured) {
    const mysqlStore = await readAllStoreFromMysql();
    if (mysqlStore) {
      const merged = { ...localStore, ...mysqlStore };
      writeJsonFile(STORE_PATH, merged);
      return res.json(merged);
    }
  }

  res.json(localStore);
});

app.post('/api/data', async (req, res) => {
  const incoming = req.body || {};
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'Payload data tidak valid.' });
  }

  const current = readJsonFile<Record<string, any>>(STORE_PATH, {});
  const updated = {
    ...current,
    ...incoming,
    updated_at: new Date().toISOString(),
  };

  writeJsonFile(STORE_PATH, updated);

  let mysqlSynced = false;
  if (getMysqlEnvConfig().isConfigured) {
    mysqlSynced = await writeAllStoreToMysql(updated);
  }

  res.json({
    success: true,
    mysqlSynced,
    message: mysqlSynced
      ? 'Seluruh data berhasil disinkronkan ke database MySQL & server pusat.'
      : 'Seluruh data berhasil disimpan ke server pusat.',
    updated_at: updated.updated_at,
  });
});

app.post('/api/data/reset', (req, res) => {
  if (fs.existsSync(STORE_PATH)) {
    fs.unlinkSync(STORE_PATH);
  }
  res.json({ success: true, message: 'Data store lokal berhasil direset.' });
});

app.post('/api/data/:table', async (req, res) => {
  const { table } = req.params;
  const payload = req.body;

  if (!table || !Object.prototype.hasOwnProperty.call(STORE_TO_MYSQL_TABLE, table)) {
    return res.status(400).json({ error: 'Nama tabel tidak dikenali.' });
  }

  const mysqlTable = STORE_TO_MYSQL_TABLE[table];
  const store = readJsonFile<Record<string, any>>(STORE_PATH, {});

  if (mysqlTable === 'school_settings') {
    store.settings = {
      ...(store.settings || {}),
      ...(payload && typeof payload === 'object' ? payload : {}),
      id: payload?.id || 'set-001',
      updated_at: new Date().toISOString(),
    };
    store.school_settings = store.settings;
  } else if (Array.isArray(payload)) {
    store[table] = payload;
  } else if (payload && typeof payload === 'object' && payload.id) {
    const list = Array.isArray(store[table]) ? [...store[table]] : [];
    const idx = list.findIndex((item: any) => item.id === payload.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...payload, updated_at: new Date().toISOString() };
    } else {
      list.unshift({ ...payload, created_at: payload.created_at || new Date().toISOString() });
    }
    store[table] = list;
  } else {
    store[table] = payload;
  }

  store.updated_at = new Date().toISOString();
  writeJsonFile(STORE_PATH, store);

  let mysqlSynced = false;
  if (getMysqlEnvConfig().isConfigured && !isMysqlInCooldown()) {
    try {
      if (mysqlTable === 'school_settings') {
        await upsertMysqlRow('school_settings', store.settings);
      } else if (Array.isArray(payload)) {
        await replaceMysqlTableRows(mysqlTable, payload);
      } else if (payload && typeof payload === 'object' && payload.id) {
        await upsertMysqlRow(mysqlTable, payload);
      }
      mysqlSynced = true;
    } catch (err: any) {
      console.log(`[MySQL] Fallback ke store lokal saat simpan (${mysqlTable}):`, err?.code || 'ERR');
    }
  }

  res.json({
    success: true,
    table,
    mysqlTable,
    mysqlSynced,
    message: mysqlSynced
      ? `Tabel ${mysqlTable} berhasil diperbarui di database MySQL.`
      : `Tabel ${table} berhasil diperbarui di server pusat.`,
    updated_at: store.updated_at,
  });
});

app.delete('/api/data/:table/:id', async (req, res) => {
  const { table, id } = req.params;

  if (!table || !Object.prototype.hasOwnProperty.call(STORE_TO_MYSQL_TABLE, table)) {
    return res.status(400).json({ error: 'Nama tabel tidak dikenali.' });
  }
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID data diperlukan.' });
  }

  const mysqlTable = STORE_TO_MYSQL_TABLE[table];
  const store = readJsonFile<Record<string, any>>(STORE_PATH, {});

  if (Array.isArray(store[table])) {
    store[table] = store[table].filter((item: any) => item.id !== id);
    store.updated_at = new Date().toISOString();
    writeJsonFile(STORE_PATH, store);
  }

  let mysqlSynced = false;
  if (getMysqlEnvConfig().isConfigured && !isMysqlInCooldown()) {
    try {
      await deleteMysqlRowById(mysqlTable, id);
      mysqlSynced = true;
    } catch (err: any) {
      console.log(`[MySQL] Fallback ke store lokal saat hapus (${mysqlTable}):`, err?.code || 'ERR');
    }
  }

  res.json({
    success: true,
    table,
    id,
    mysqlSynced,
    message: `Data dengan ID ${id} berhasil dihapus dari tabel ${mysqlTable}.`,
  });
});

// -----------------------------------------------------------------------------
// Vite Dev Middleware / Static Production Server
// -----------------------------------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SMP Pancasila Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error] Failed to start:', err);
  process.exit(1);
});
