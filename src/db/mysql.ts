import dns from 'dns';
import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

try {
  // Prefer IPv4 so Hostinger Remote MySQL receives the server IPv4 address instead of IPv6
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Ignore if unsupported by runtime
}

export type AllowedMysqlTable =
  | 'school_settings'
  | 'people'
  | 'news'
  | 'announcements'
  | 'agendas'
  | 'achievements'
  | 'galleries'
  | 'gallery_images'
  | 'facilities'
  | 'admin_users'
  | 'media_files';

export const STORE_TO_MYSQL_TABLE: Record<string, AllowedMysqlTable> = {
  settings: 'school_settings',
  school_settings: 'school_settings',
  people: 'people',
  news: 'news',
  announcements: 'announcements',
  agendas: 'agendas',
  achievements: 'achievements',
  galleries: 'galleries',
  gallery_images: 'gallery_images',
  facilities: 'facilities',
  users: 'admin_users',
  admin_users: 'admin_users',
  media: 'media_files',
  media_files: 'media_files',
};

export const TABLE_COLUMNS: Record<AllowedMysqlTable, readonly string[]> = {
  school_settings: [
    'id',
    'school_name',
    'logo',
    'address',
    'phone',
    'email',
    'description',
    'vision',
    'mission',
    'history',
    'operating_hours',
    'npsn',
    'accreditation',
    'accreditation_label',
    'total_students',
    'stat_students_label',
    'total_teachers',
    'stat_teachers_label',
    'total_achievements',
    'stat_achievements_label',
    'social_links',
    'contact_other',
    'headmaster_section_background',
    'headmaster_background_position',
    'headmaster_background_opacity',
    'website_title',
    'website_tagline',
    'meta_description',
    'meta_keywords',
    'banner_announcement_enabled',
    'banner_announcement_text',
    'banner_announcement_link',
    'whatsapp_number',
    'whatsapp_chat_widget_enabled',
    'google_maps_embed',
    'footer_copyright',
    'maintenance_mode',
    'updated_at',
  ],
  people: [
    'id',
    'name',
    'slug',
    'photo',
    'position',
    'category',
    'nip_nuptk',
    'education',
    'subject',
    'education_history',
    'work_history',
    'short_bio',
    'contact',
    'website',
    'achievements_note',
    'status',
    'published',
    'created_at',
    'updated_at',
  ],
  news: [
    'id',
    'title',
    'slug',
    'thumbnail',
    'content',
    'author_id',
    'author_name',
    'category',
    'status',
    'published_at',
    'created_at',
    'updated_at',
  ],
  announcements: [
    'id',
    'slug',
    'title',
    'content',
    'status',
    'start_date',
    'end_date',
    'attachment_url',
    'created_at',
    'updated_at',
  ],
  agendas: ['id', 'title', 'date', 'location', 'status', 'created_at', 'updated_at'],
  achievements: [
    'id',
    'slug',
    'title',
    'description',
    'category',
    'level',
    'recipient_name',
    'recipient_id',
    'year',
    'documentation',
    'status',
    'created_at',
    'updated_at',
  ],
  galleries: ['id', 'title', 'description', 'cover_image', 'status', 'created_at', 'updated_at'],
  gallery_images: ['id', 'gallery_id', 'image', 'caption', 'date', 'status', 'created_at'],
  facilities: [
    'id',
    'name',
    'description',
    'photo',
    'image',
    'location',
    'condition',
    'specifications',
    'status',
    'published',
    'created_at',
    'updated_at',
  ],
  admin_users: [
    'id',
    'full_name',
    'email',
    'password',
    'role',
    'avatar',
    'phone',
    'linked_person_id',
    'status',
    'last_login',
    'created_at',
    'updated_at',
  ],
  media_files: [
    'id',
    'file_name',
    'file_path',
    'file_type',
    'file_size',
    'alt_text',
    'uploaded_by',
    'created_at',
  ],
};

const DATETIME_COLUMNS = new Set(['created_at', 'updated_at', 'last_login']);
const BOOLEAN_COLUMNS = new Set([
  'published',
  'banner_announcement_enabled',
  'whatsapp_chat_widget_enabled',
  'maintenance_mode',
]);
const JSON_COLUMNS = new Set(['social_links']);

export interface MysqlTestResult {
  configured: boolean;
  connected: boolean;
  host: string;
  port: number;
  database: string;
  userMasked: string;
  latencyMs?: number;
  tablesFound: string[];
  errorCode?: string;
  clientIp?: string;
  envStatus: {
    hostSet: boolean;
    portSet: boolean;
    userSet: boolean;
    passwordSet: boolean;
    databaseSet: boolean;
  };
  message: string;
}

const MYSQL_FAILURE_COOLDOWN_MS = 60_000;

declare global {
  var _mysqlPool: Pool | undefined;
  var _mysqlPoolKey: string | undefined;
  var _mysqlFailureCache: { result: MysqlTestResult; expiresAt: number } | undefined;
}

function maskMysqlUser(user: string): string {
  if (!user) return '';
  return user.length > 4 ? `${user.slice(0, 3)}***${user.slice(-2)}` : '***';
}

export function getMysqlEnvConfig() {
  const host = (process.env.MYSQL_HOST || '').trim();
  const port = parseInt((process.env.MYSQL_PORT || '3306').trim(), 10) || 3306;
  const user = (process.env.MYSQL_USER || '').trim();
  const password = (process.env.MYSQL_PASSWORD || '').replace(/[\r\n]+$/g, '');
  const database = (process.env.MYSQL_DATABASE || '').trim();
  const ssl = (process.env.MYSQL_SSL || '').trim().toLowerCase() === 'true';

  const isConfigured = Boolean(host && user && database);
  return {
    host,
    port,
    user,
    password,
    database,
    ssl,
    isConfigured,
    envStatus: {
      hostSet: Boolean(host),
      portSet: Boolean(process.env.MYSQL_PORT),
      userSet: Boolean(user),
      passwordSet: Boolean(password),
      databaseSet: Boolean(database),
    },
  };
}

export function isMysqlInCooldown(): boolean {
  return Boolean(global._mysqlFailureCache && global._mysqlFailureCache.expiresAt > Date.now());
}

export function getMysqlPool(): Pool | null {
  const cfg = getMysqlEnvConfig();
  if (!cfg.isConfigured) {
    return null;
  }

  const poolKey = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.database}:${cfg.ssl}:${cfg.password.length}`;
  if (global._mysqlPool && global._mysqlPoolKey !== poolKey) {
    global._mysqlPool.end().catch(() => {});
    global._mysqlPool = undefined;
    global._mysqlFailureCache = undefined;
  }

  if (!global._mysqlPool) {
    global._mysqlPoolKey = poolKey;
    global._mysqlPool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      ssl: cfg.ssl ? { rejectUnauthorized: true } : undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 8000,
      charset: 'utf8mb4',
    });
  }

  return global._mysqlPool;
}

function toMysqlDatetime(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 19).replace('T', ' ');
  }
  const str = String(val).trim();
  if (!str) return null;
  // Already MySQL format YYYY-MM-DD HH:MM:SS
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    return str;
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 19).replace('T', ' ');
  }
  return null;
}

type MysqlParamValue = string | number | boolean | null | Date;

function normalizeForMysql(col: string, val: unknown): MysqlParamValue {
  if (val === undefined || val === null) return null;

  if (DATETIME_COLUMNS.has(col)) {
    return toMysqlDatetime(val);
  }
  if (BOOLEAN_COLUMNS.has(col)) {
    return val === true || val === 1 || val === '1' || val === 'true' ? 1 : 0;
  }
  if (JSON_COLUMNS.has(col)) {
    return typeof val === 'string' ? val : JSON.stringify(val);
  }
  if (col === 'year' || col === 'file_size') {
    const num = Number(val);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
  }
  if (col === 'headmaster_background_opacity') {
    const num = Number(val);
    return Number.isFinite(num) ? num : 0.15;
  }
  if (val instanceof Date || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val;
  }
  return JSON.stringify(val);
}

function normalizeRowFromMysql(table: AllowedMysqlTable, row: RowDataPacket): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(key)) {
      out[key] = Boolean(value);
    } else if (JSON_COLUMNS.has(key)) {
      if (typeof value === 'string') {
        try {
          out[key] = JSON.parse(value);
        } catch {
          out[key] = {};
        }
      } else {
        out[key] = value || {};
      }
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else {
      out[key] = value;
    }
  }
  if (table === 'school_settings' && out.headmaster_background_opacity !== undefined) {
    out.headmaster_background_opacity = Number(out.headmaster_background_opacity);
  }
  return out;
}

function formatMysqlDiagnosticError(err: any): {
  errorCode: string;
  clientIp?: string;
  message: string;
} {
  const code = String(err?.code || 'UNKNOWN');
  const rawMsg = String(err?.message || '');
  const accessMatch = rawMsg.match(/Access denied for user '([^']*)'@'([^']*)'/i);
  const clientIp = accessMatch?.[2];

  switch (code) {
    case 'ECONNREFUSED':
      return {
        errorCode: code,
        message:
          'Koneksi ditolak (ECONNREFUSED). Server MySQL tidak aktif di host/port yang dituju. Periksa MYSQL_HOST dan MYSQL_PORT.',
      };
    case 'ETIMEDOUT':
    case 'ENETUNREACH':
    case 'EHOSTUNREACH':
      return {
        errorCode: code,
        message: `Koneksi ke server MySQL timeout (${code}). Port 3306 mungkin diblokir firewall atau Remote MySQL Hostinger belum diaktifkan.`,
      };
    case 'ENOTFOUND':
      return {
        errorCode: code,
        message: 'Hostname MySQL tidak ditemukan (ENOTFOUND). Periksa kembali nilai MYSQL_HOST.',
      };
    case 'ER_ACCESS_DENIED_ERROR':
      return {
        errorCode: code,
        clientIp,
        message: clientIp
          ? `Akses ditolak oleh MySQL untuk koneksi dari IP ${clientIp}. Pastikan IP tersebut (atau "%" / Any Host) sudah diizinkan di Hostinger → Remote MySQL, serta periksa MYSQL_USER dan MYSQL_PASSWORD.`
          : 'Akses ditolak oleh MySQL (ER_ACCESS_DENIED_ERROR). Periksa MYSQL_USER, MYSQL_PASSWORD, dan izin Remote MySQL Hostinger.',
      };
    case 'ER_BAD_DB_ERROR':
      return {
        errorCode: code,
        message:
          'Nama database tidak ditemukan (ER_BAD_DB_ERROR). Pastikan MYSQL_DATABASE sesuai (misal: u637089879_db_pancasila).',
      };
    default:
      return {
        errorCode: code,
        message:
          'Koneksi ke server MySQL gagal. Periksa konfigurasi host, user, password, dan izin Remote MySQL Hostinger.',
      };
  }
}

function recordMysqlFailure(err: any): MysqlTestResult {
  const cfg = getMysqlEnvConfig();
  const diag = formatMysqlDiagnosticError(err);
  const result: MysqlTestResult = {
    configured: cfg.isConfigured,
    connected: false,
    host: cfg.host || '127.0.0.1',
    port: cfg.port,
    database: cfg.database || 'u637089879_db_pancasila',
    userMasked: maskMysqlUser(cfg.user),
    tablesFound: [],
    errorCode: diag.errorCode,
    clientIp: diag.clientIp,
    envStatus: cfg.envStatus,
    message: diag.message,
  };
  global._mysqlFailureCache = {
    result,
    expiresAt: Date.now() + MYSQL_FAILURE_COOLDOWN_MS,
  };
  return result;
}

export async function testMysqlConnection(forceRefresh = false): Promise<MysqlTestResult> {
  const cfg = getMysqlEnvConfig();
  const userMasked = maskMysqlUser(cfg.user);

  if (!cfg.isConfigured) {
    return {
      configured: false,
      connected: false,
      host: cfg.host || '127.0.0.1',
      port: cfg.port,
      database: cfg.database || 'u637089879_db_pancasila',
      userMasked,
      tablesFound: [],
      errorCode: 'NOT_CONFIGURED',
      envStatus: cfg.envStatus,
      message:
        'Variabel environment MySQL (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE) belum diatur di server. Untuk saat ini aplikasi tetap berjalan menggunakan penyimpanan lokal server (data/store.json).',
    };
  }

  if (forceRefresh) {
    global._mysqlFailureCache = undefined;
  } else if (global._mysqlFailureCache && global._mysqlFailureCache.expiresAt > Date.now()) {
    return global._mysqlFailureCache.result;
  }

  const pool = getMysqlPool();
  if (!pool) {
    return {
      configured: false,
      connected: false,
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      userMasked,
      tablesFound: [],
      errorCode: 'POOL_UNAVAILABLE',
      envStatus: cfg.envStatus,
      message: 'Pool MySQL belum tersedia.',
    };
  }

  const start = Date.now();
  try {
    await pool.execute('SELECT 1 AS ok');
    const [rows] = await pool.execute<RowDataPacket[]>('SHOW TABLES');
    const tablesFound = rows.map((r) => String(Object.values(r)[0]));
    const latencyMs = Date.now() - start;

    global._mysqlFailureCache = undefined;

    const requiredTables = Object.values(STORE_TO_MYSQL_TABLE);
    const uniqueRequired = Array.from(new Set(requiredTables));
    const missing = uniqueRequired.filter((t) => !tablesFound.includes(t));

    return {
      configured: true,
      connected: true,
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      userMasked,
      latencyMs,
      tablesFound,
      envStatus: cfg.envStatus,
      message:
        missing.length === 0
          ? `Terhubung ke MySQL "${cfg.database}" (${latencyMs}ms). Seluruh ${tablesFound.length} tabel siap digunakan.`
          : `Terhubung ke MySQL "${cfg.database}" (${latencyMs}ms), namun ${missing.length} tabel belum dibuat (${missing.join(', ')}). Jalankan mysql-schema.sql di phpMyAdmin.`,
    };
  } catch (err: any) {
    const failedResult = recordMysqlFailure(err);
    return failedResult;
  }
}

export async function upsertMysqlRow(
  table: AllowedMysqlTable,
  row: Record<string, any>
): Promise<void> {
  if (isMysqlInCooldown()) return;
  const pool = getMysqlPool();
  if (!pool) return;

  const allowedCols = TABLE_COLUMNS[table];
  const entries = allowedCols
    .filter((col) => Object.prototype.hasOwnProperty.call(row, col))
    .map((col) => [col, normalizeForMysql(col, row[col])] as const);

  if (entries.length === 0 || !row.id) return;

  const colSql = entries.map(([col]) => `\`${col}\``).join(', ');
  const placeholders = entries.map(() => '?').join(', ');
  const updateCols = entries
    .filter(([col]) => col !== 'id' && col !== 'created_at')
    .map(([col]) => `\`${col}\` = VALUES(\`${col}\`)`)
    .join(', ');

  const sql = updateCols
    ? `INSERT INTO \`${table}\` (${colSql}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateCols}`
    : `INSERT IGNORE INTO \`${table}\` (${colSql}) VALUES (${placeholders})`;

  const params = entries.map(([, val]) => val);
  await pool.execute(sql, params);
}

export async function replaceMysqlTableRows(
  table: AllowedMysqlTable,
  rows: Record<string, any>[]
): Promise<void> {
  if (isMysqlInCooldown()) return;
  const pool = getMysqlPool();
  if (!pool) return;

  for (const item of rows) {
    if (item && typeof item === 'object' && item.id) {
      await upsertMysqlRow(table, item);
    }
  }
}

export async function deleteMysqlRowById(
  table: AllowedMysqlTable,
  id: string
): Promise<void> {
  if (isMysqlInCooldown()) return;
  const pool = getMysqlPool();
  if (!pool) return;

  await pool.execute(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id]);
}

export async function readAllStoreFromMysql(): Promise<Record<string, any> | null> {
  if (isMysqlInCooldown()) return null;
  const pool = getMysqlPool();
  if (!pool) return null;

  try {
    const result: Record<string, any> = {};

    const [settingsRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM `school_settings` LIMIT 1'
    );
    if (settingsRows.length > 0) {
      const normalized = normalizeRowFromMysql('school_settings', settingsRows[0]);
      result.settings = normalized;
      result.school_settings = normalized;
    }

    const arrayTables: Array<{ storeKey: string; mysqlTable: AllowedMysqlTable; orderBy: string }> = [
      { storeKey: 'people', mysqlTable: 'people', orderBy: '`created_at` DESC' },
      { storeKey: 'news', mysqlTable: 'news', orderBy: '`created_at` DESC' },
      { storeKey: 'announcements', mysqlTable: 'announcements', orderBy: '`created_at` DESC' },
      { storeKey: 'agendas', mysqlTable: 'agendas', orderBy: '`created_at` DESC' },
      { storeKey: 'achievements', mysqlTable: 'achievements', orderBy: '`year` DESC, `created_at` DESC' },
      { storeKey: 'galleries', mysqlTable: 'galleries', orderBy: '`created_at` DESC' },
      { storeKey: 'gallery_images', mysqlTable: 'gallery_images', orderBy: '`created_at` DESC' },
      { storeKey: 'facilities', mysqlTable: 'facilities', orderBy: '`created_at` DESC' },
      { storeKey: 'users', mysqlTable: 'admin_users', orderBy: '`created_at` DESC' },
      { storeKey: 'media', mysqlTable: 'media_files', orderBy: '`created_at` DESC' },
    ];

    for (const { storeKey, mysqlTable, orderBy } of arrayTables) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM \`${mysqlTable}\` ORDER BY ${orderBy}`
      );
      if (rows.length > 0) {
        result[storeKey] = rows.map((r) => normalizeRowFromMysql(mysqlTable, r));
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err: any) {
    recordMysqlFailure(err);
    return null;
  }
}

export async function writeAllStoreToMysql(payload: Record<string, any>): Promise<boolean> {
  if (isMysqlInCooldown()) return false;
  const pool = getMysqlPool();
  if (!pool) return false;

  try {
    if (payload.settings && typeof payload.settings === 'object') {
      await upsertMysqlRow('school_settings', { id: 'set-001', ...payload.settings });
    }
    if (Array.isArray(payload.people)) {
      await replaceMysqlTableRows('people', payload.people);
    }
    if (Array.isArray(payload.news)) {
      await replaceMysqlTableRows('news', payload.news);
    }
    if (Array.isArray(payload.announcements)) {
      await replaceMysqlTableRows('announcements', payload.announcements);
    }
    if (Array.isArray(payload.agendas)) {
      await replaceMysqlTableRows('agendas', payload.agendas);
    }
    if (Array.isArray(payload.achievements)) {
      await replaceMysqlTableRows('achievements', payload.achievements);
    }
    // Insert parent galleries before child gallery_images (FK constraint)
    if (Array.isArray(payload.galleries)) {
      await replaceMysqlTableRows('galleries', payload.galleries);
    }
    if (Array.isArray(payload.gallery_images)) {
      await replaceMysqlTableRows('gallery_images', payload.gallery_images);
    }
    if (Array.isArray(payload.facilities)) {
      await replaceMysqlTableRows('facilities', payload.facilities);
    }
    if (Array.isArray(payload.users)) {
      await replaceMysqlTableRows('admin_users', payload.users);
    }
    if (Array.isArray(payload.media)) {
      await replaceMysqlTableRows('media_files', payload.media);
    }
    return true;
  } catch (err: any) {
    recordMysqlFailure(err);
    return false;
  }
}
