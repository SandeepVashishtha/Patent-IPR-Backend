const { Pool } = require('pg');

const parseBoolLike = (value) => {
  if (!value) return false;
  return ['1', 'true', 'yes', 'require', 'on'].includes(value.toLowerCase());
};

const shouldUseSsl =
  parseBoolLike(process.env.PGSSLMODE) || process.env.NODE_ENV === 'production';

const baseConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
    }
  : {
      host: process.env.PGHOST,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    };

const pool = new Pool({
  ...baseConfig,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
  enableChannelBinding: parseBoolLike(process.env.PGCHANNELBINDING),
});

const query = (text, params) => pool.query(text, params);

const checkDbConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  checkDbConnection,
};
