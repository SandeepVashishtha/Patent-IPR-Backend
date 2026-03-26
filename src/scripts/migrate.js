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
      DO $$
      BEGIN
        CREATE TYPE filing_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await db.query(`
      DO $$
      BEGIN
        CREATE TYPE non_patent_filing_type AS ENUM ('TRADEMARK', 'COPYRIGHT', 'DESIGN');
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

    await db.query(`
      CREATE TABLE IF NOT EXISTS patent_filings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reference_number VARCHAR(32) UNIQUE NOT NULL,
        patent_id VARCHAR(32) UNIQUE NOT NULL,
        filing_year INTEGER NOT NULL,
        yearly_sequence INTEGER NOT NULL,
        sequence_number BIGINT UNIQUE NOT NULL,
        title VARCHAR(300) NOT NULL,
        field_of_invention VARCHAR(120) NOT NULL,
        field_of_invention_other VARCHAR(255),
        abstract_text VARCHAR(5000) NOT NULL,
        applicant_name VARCHAR(120) NOT NULL,
        applicant_email VARCHAR(255) NOT NULL,
        applicant_mobile VARCHAR(20) NOT NULL,
        supporting_document_url TEXT,
        status filing_status NOT NULL DEFAULT 'DRAFT',
        estimation JSONB,
        submitted_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_patent_filings_year_seq UNIQUE (filing_year, yearly_sequence)
      );
    `);

    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_patent_filings_user_created_at ON patent_filings(user_id, created_at DESC)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_patent_filings_user_status ON patent_filings(user_id, status)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_patent_filings_reference_number ON patent_filings(reference_number)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_patent_filings_submitted_at ON patent_filings(submitted_at DESC)'
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS non_patent_filings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filing_type non_patent_filing_type NOT NULL,
        reference_number VARCHAR(32) UNIQUE NOT NULL,
        filing_identifier VARCHAR(32) UNIQUE NOT NULL,
        filing_year INTEGER NOT NULL,
        yearly_sequence INTEGER NOT NULL,
        sequence_number BIGINT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        document_url TEXT,
        status filing_status NOT NULL DEFAULT 'DRAFT',
        submitted_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_non_patent_year_seq UNIQUE (filing_type, filing_year, yearly_sequence),
        CONSTRAINT uq_non_patent_type_sequence UNIQUE (filing_type, sequence_number)
      );
    `);

    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_non_patent_filings_user_created_at ON non_patent_filings(user_id, created_at DESC)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_non_patent_filings_user_status ON non_patent_filings(user_id, status)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_non_patent_filings_reference_number ON non_patent_filings(reference_number)'
    );
    await db.query(
      'CREATE INDEX IF NOT EXISTS idx_non_patent_filings_type_submitted_at ON non_patent_filings(filing_type, submitted_at DESC)'
    );

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
};

migrate();
