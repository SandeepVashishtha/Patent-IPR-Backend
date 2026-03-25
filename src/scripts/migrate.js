require('dotenv').config();

const db = require('../config/db');

const migrate = async () => {
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await db.query(`
      DO $$
      BEGIN
        CREATE TYPE user_role AS ENUM ('client', 'agent', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'client',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
};

migrate();
