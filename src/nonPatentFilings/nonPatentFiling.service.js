const db = require('../config/db');
const ApiError = require('../utils/apiError');
const {
  NON_PATENT_TYPES,
  NON_PATENT_TYPE_CONFIG,
} = require('./nonPatentFiling.constants');

const DRAFT = 'DRAFT';
const PENDING = 'PENDING';

const SORT_FIELD_TO_COLUMN = {
  submittedAt: 'submitted_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  status: 'status',
  referenceNumber: 'reference_number',
};

const selectClause = `
  SELECT
    id,
    user_id,
    filing_type,
    reference_number,
    filing_identifier,
    filing_year,
    yearly_sequence,
    sequence_number,
    payload,
    document_url,
    status,
    submitted_at,
    updated_at,
    created_at
  FROM non_patent_filings
`;

const hasValue = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
};

const safePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload;
};

const userCanAccessFiling = (user, filingUserId) => {
  if (user.role === 'client') {
    return user.id === filingUserId;
  }

  return true;
};

const assertCanAccessFiling = (user, filingUserId) => {
  if (!userCanAccessFiling(user, filingUserId)) {
    throw new ApiError(403, 'Forbidden', null, 'FORBIDDEN');
  }
};

const assertFilingTypeSupported = (filingType) => {
  if (!NON_PATENT_TYPE_CONFIG[filingType]) {
    throw new ApiError(400, 'Unsupported filing type', null, 'BAD_REQUEST');
  }
};

const mapRowToFiling = (row) => {
  const config = NON_PATENT_TYPE_CONFIG[row.filing_type];
  const payload = safePayload(row.payload);
  const documentValue = row.document_url || payload[config.documentField] || '';

  return {
    id: row.id,
    referenceNumber: row.reference_number,
    [config.idField]: row.filing_identifier,
    ...payload,
    [config.documentField]: documentValue,
    status: row.status,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
};

const getFilingById = async (id, filingType) => {
  const result = await db.query(`${selectClause} WHERE id = $1 AND filing_type = $2`, [id, filingType]);
  return result.rows[0] || null;
};

const getNextIdentifiers = async (client, filingType) => {
  const config = NON_PATENT_TYPE_CONFIG[filingType];

  await client.query('LOCK TABLE non_patent_filings IN EXCLUSIVE MODE');

  const currentYear = new Date().getUTCFullYear();

  const sequenceResult = await client.query(
    `
      SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence
      FROM non_patent_filings
      WHERE filing_type = $1
    `,
    [filingType]
  );
  const yearlySequenceResult = await client.query(
    `
      SELECT COALESCE(MAX(yearly_sequence), 0) + 1 AS next_sequence
      FROM non_patent_filings
      WHERE filing_type = $1 AND filing_year = $2
    `,
    [filingType, currentYear]
  );

  const sequenceNumber = Number(sequenceResult.rows[0].next_sequence);
  const yearlySequence = Number(yearlySequenceResult.rows[0].next_sequence);

  return {
    currentYear,
    sequenceNumber,
    yearlySequence,
    filingIdentifier: `${config.code}-${String(sequenceNumber).padStart(6, '0')}`,
    referenceNumber: `REQ-${config.code}-${currentYear}-${String(yearlySequence).padStart(3, '0')}`,
  };
};

const buildCreatePayload = (filingType, payload) => {
  const config = NON_PATENT_TYPE_CONFIG[filingType];
  const result = {};

  config.fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      result[field] = payload[field];
      return;
    }
    result[field] = null;
  });

  return result;
};

const assertRequiredFields = (filingType, payload) => {
  const config = NON_PATENT_TYPE_CONFIG[filingType];
  const missingFields = config.requiredFields.filter((field) => !hasValue(payload[field]));

  if (missingFields.length > 0) {
    throw new ApiError(
      422,
      'Validation failed',
      missingFields.map((field) => ({
        field,
        message: `${field} is required before submit`,
      })),
      'VALIDATION_ERROR'
    );
  }
};

const createNonPatentFiling = async ({ user, payload, filingType }) => {
  assertFilingTypeSupported(filingType);

  const config = NON_PATENT_TYPE_CONFIG[filingType];
  const saveAsDraft = Boolean(payload.saveAsDraft);
  const status = saveAsDraft ? DRAFT : PENDING;
  const submittedAt = saveAsDraft ? null : new Date().toISOString();
  const filingPayload = buildCreatePayload(filingType, payload);
  const documentUrl = filingPayload[config.documentField] || null;

  if (!saveAsDraft) {
    assertRequiredFields(filingType, filingPayload);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const identifiers = await getNextIdentifiers(client, filingType);

    const result = await client.query(
      `
        INSERT INTO non_patent_filings (
          user_id,
          filing_type,
          reference_number,
          filing_identifier,
          filing_year,
          yearly_sequence,
          sequence_number,
          payload,
          document_url,
          status,
          submitted_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11
        )
        RETURNING *
      `,
      [
        user.id,
        filingType,
        identifiers.referenceNumber,
        identifiers.filingIdentifier,
        identifiers.currentYear,
        identifiers.yearlySequence,
        identifiers.sequenceNumber,
        JSON.stringify(filingPayload),
        documentUrl,
        status,
        submittedAt,
      ]
    );

    await client.query('COMMIT');
    return mapRowToFiling(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const parseSort = (sort) => {
  const [field = 'submittedAt', directionRaw = 'desc'] = String(sort || 'submittedAt,desc').split(',');
  const column = SORT_FIELD_TO_COLUMN[field] || 'submitted_at';
  const direction = directionRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
};

const listNonPatentFilings = async ({ user, query, filingType }) => {
  assertFilingTypeSupported(filingType);

  const whereParts = [];
  const values = [];
  let index = 1;

  whereParts.push(`filing_type = $${index}`);
  values.push(filingType);
  index += 1;

  if (user.role === 'client') {
    whereParts.push(`user_id = $${index}`);
    values.push(user.id);
    index += 1;
  }

  if (query.status) {
    whereParts.push(`status = $${index}`);
    values.push(query.status);
    index += 1;
  }

  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const sortClause = parseSort(query.sort);
  const offset = query.page * query.size;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total_elements FROM non_patent_filings ${whereClause}`,
    values
  );

  const listResult = await db.query(
    `
      ${selectClause}
      ${whereClause}
      ORDER BY ${sortClause}
      LIMIT $${index}
      OFFSET $${index + 1}
    `,
    [...values, query.size, offset]
  );

  const totalElements = countResult.rows[0].total_elements;
  const totalPages = Math.ceil(totalElements / query.size) || 0;

  return {
    content: listResult.rows.map(mapRowToFiling),
    pageable: {
      page: query.page,
      size: query.size,
      totalElements,
      totalPages,
    },
  };
};

const getNonPatentFilingByReference = async ({ user, referenceNumber, filingType }) => {
  assertFilingTypeSupported(filingType);

  const result = await db.query(
    `${selectClause} WHERE reference_number = $1 AND filing_type = $2`,
    [referenceNumber, filingType]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, `${NON_PATENT_TYPE_CONFIG[filingType].label} not found`, null, 'NOT_FOUND');
  }

  const filing = result.rows[0];
  assertCanAccessFiling(user, filing.user_id);

  return mapRowToFiling(filing);
};

const updateDraftNonPatentFiling = async ({ user, id, payload, filingType }) => {
  assertFilingTypeSupported(filingType);

  const current = await getFilingById(id, filingType);
  if (!current) {
    throw new ApiError(404, `${NON_PATENT_TYPE_CONFIG[filingType].label} not found`, null, 'NOT_FOUND');
  }

  assertCanAccessFiling(user, current.user_id);

  if (current.status !== DRAFT) {
    throw new ApiError(
      409,
      'Only DRAFT filings can be updated',
      [{ field: 'status', message: `Current status is ${current.status}` }],
      'STATUS_CONFLICT'
    );
  }

  const config = NON_PATENT_TYPE_CONFIG[filingType];
  const currentPayload = safePayload(current.payload);
  const nextPayload = { ...currentPayload };
  let changed = false;

  config.fields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      nextPayload[field] = payload[field] || null;
      changed = true;
    }
  });

  if (!changed) {
    throw new ApiError(400, 'No updatable fields provided', null, 'BAD_REQUEST');
  }

  const nextDocumentUrl = nextPayload[config.documentField] || null;

  const result = await db.query(
    `
      UPDATE non_patent_filings
      SET payload = $3::jsonb, document_url = $4, updated_at = NOW()
      WHERE id = $1 AND filing_type = $2
      RETURNING *
    `,
    [id, filingType, JSON.stringify(nextPayload), nextDocumentUrl]
  );

  return mapRowToFiling(result.rows[0]);
};

const attachDocument = async ({ user, id, filingType, documentUrl }) => {
  assertFilingTypeSupported(filingType);

  const current = await getFilingById(id, filingType);
  if (!current) {
    throw new ApiError(404, `${NON_PATENT_TYPE_CONFIG[filingType].label} not found`, null, 'NOT_FOUND');
  }

  assertCanAccessFiling(user, current.user_id);

  const config = NON_PATENT_TYPE_CONFIG[filingType];
  const nextPayload = {
    ...safePayload(current.payload),
    [config.documentField]: documentUrl,
  };

  const result = await db.query(
    `
      UPDATE non_patent_filings
      SET payload = $3::jsonb, document_url = $4, updated_at = NOW()
      WHERE id = $1 AND filing_type = $2
      RETURNING document_url
    `,
    [id, filingType, JSON.stringify(nextPayload), documentUrl]
  );

  return {
    documentId: `doc_${id.replace(/-/g, '').slice(0, 12)}`,
    [config.documentField]: result.rows[0].document_url,
  };
};

module.exports = {
  createNonPatentFiling,
  listNonPatentFilings,
  getNonPatentFilingByReference,
  updateDraftNonPatentFiling,
  attachDocument,
  NON_PATENT_TYPES,
};
