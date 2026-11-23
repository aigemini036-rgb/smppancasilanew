export interface MysqlStatusInfo {
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
  envStatus?: {
    hostSet: boolean;
    portSet: boolean;
    userSet: boolean;
    passwordSet: boolean;
    databaseSet: boolean;
  };
  message: string;
}

export interface MysqlSyncResult {
  success: boolean;
  mysqlSynced?: boolean;
  message: string;
  counts?: {
    settings: number;
    people: number;
    news: number;
    announcements: number;
    agendas: number;
    achievements: number;
    galleries: number;
    galleryImages: number;
    facilities: number;
    users: number;
  };
}

export async function fetchMysqlStatus(): Promise<MysqlStatusInfo> {
  try {
    const res = await fetch('/api/mysql/status');
    if (res.ok) {
      return (await res.json()) as MysqlStatusInfo;
    }
  } catch {
    // offline fallback
  }
  return {
    configured: false,
    connected: false,
    host: '127.0.0.1',
    port: 3306,
    database: 'u637089879_db_pancasila',
    userMasked: '',
    tablesFound: [],
    errorCode: 'UNREACHABLE',
    message: 'Server backend tidak merespon saat memeriksa status MySQL.',
  };
}

export async function testMysqlServerConnection(): Promise<MysqlStatusInfo> {
  try {
    const res = await fetch('/api/mysql/test', { method: 'POST' });
    if (res.ok) {
      return (await res.json()) as MysqlStatusInfo;
    }
  } catch {
    // offline fallback
  }
  return {
    configured: false,
    connected: false,
    host: '127.0.0.1',
    port: 3306,
    database: 'u637089879_db_pancasila',
    userMasked: '',
    tablesFound: [],
    errorCode: 'UNREACHABLE',
    message: 'Gagal menghubungi endpoint pengujian MySQL.',
  };
}
