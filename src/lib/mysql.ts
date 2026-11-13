import mysql, { Pool } from 'mysql2/promise';

let pool: Pool | null = null;

export function isMySQLConfigured(): boolean {
  const host = process.env.MYSQL_HOST || process.env.DB_HOST;
  const user = process.env.MYSQL_USER || process.env.DB_USER;
  const database = process.env.MYSQL_DATABASE || process.env.DB_NAME;
  return Boolean(host && user && database);
}

export function getMySQLPool(): Pool | null {
  if (!isMySQLConfigured()) {
    return null;
  }

  if (!pool) {
    const host = process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306', 10);
    const user = process.env.MYSQL_USER || process.env.DB_USER || '';
    const password = process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '';
    const database = process.env.MYSQL_DATABASE || process.env.DB_NAME || '';

    try {
      pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 5,
        idleTimeout: 60000,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        charset: 'utf8mb4',
      });
    } catch (err) {
      console.error('[MySQL Pool Initialization Error]:', err);
      pool = null;
    }
  }

  return pool;
}

export async function executeMySQLQuery<T = any>(
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const currentPool = getMySQLPool();
  if (!currentPool) {
    return null;
  }

  try {
    const [results] = await currentPool.execute(sql, params);
    return results as T;
  } catch (err: any) {
    console.error(`[MySQL Query Execution Error]: ${err.message}`, { sql, params });
    throw err;
  }
}
