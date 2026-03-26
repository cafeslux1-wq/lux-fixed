import { Pool, PoolClient, QueryResult } from 'pg';

// Support both DATABASE_URL (Railway default) and individual DB_* vars
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME     || 'lux_supreme',
      user:     process.env.DB_USER     || 'lux_admin',
      password: process.env.DB_PASSWORD || '',
      ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max:      20,
      idleTimeoutMillis:    30_000,
      connectionTimeoutMillis: 10_000,
    });

pool.on('error', (err) => {
  console.error('[DB] Pool error:', err.message);
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('[DB] ✅ Connected to PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('[DB] ❌ Connection failed:', err.message);
    console.error('[DB] DATABASE_URL present:', !!process.env.DATABASE_URL);
    console.error('[DB] DB_HOST:', process.env.DB_HOST || 'not set');
  });

export async function query<T extends object = Record<string, unknown>>(
  text:   string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const dur    = Date.now() - start;
  if (dur > 500) console.warn(`[DB] Slow query (${dur}ms): ${text.slice(0, 80)}`);
  return result;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function queryPaginated<T extends object = Record<string, unknown>>(
  baseSql: string,
  params:  unknown[],
  page     = 1,
  perPage  = 30,
): Promise<{ rows: T[]; total: number; page: number; per_page: number }> {
  const offset   = (page - 1) * perPage;
  const countSql = `SELECT COUNT(*) AS total FROM (${baseSql}) AS _count`;
  const [countRes, rowsRes] = await Promise.all([
    pool.query(countSql, params),
    pool.query<T>(`${baseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, perPage, offset]),
  ]);
  return {
    rows:     rowsRes.rows,
    total:    parseInt(countRes.rows[0].total),
    page,
    per_page: perPage,
  };
}

export default pool;
