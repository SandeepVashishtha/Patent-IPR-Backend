const db = require('../config/db');
const ApiError = require('../utils/apiError');

const SORT_FIELD_TO_COLUMN = {
  submittedAt: 'submitted_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  title: 'title',
  status: 'status',
};

const DRAFT = 'DRAFT';
const PENDING = 'PENDING';

const mapRowToFiling = (row) => ({
  id: row.id,
  referenceNumber: row.reference_number,
  patentId: row.patent_id,
  title: row.title,
  fieldOfInvention: row.field_of_invention,
  fieldOfInventionOther: row.field_of_invention_other || '',
  abstractText: row.abstract_text,
  applicantName: row.applicant_name,
  applicantEmail: row.applicant_email,
  applicantMobile: row.applicant_mobile,
  supportingDocumentUrl: row.supporting_document_url || '',
  status: row.status,
  estimation: row.estimation,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
  createdAt: row.created_at,
});

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

const selectClause = `
  SELECT
    id,
    user_id,
    reference_number,
    patent_id,
    title,
    field_of_invention,
    field_of_invention_other,
    abstract_text,
    applicant_name,
    applicant_email,
    applicant_mobile,
    supporting_document_url,
    status,
    estimation,
    submitted_at,
    updated_at,
    created_at
  FROM patent_filings
`;

const getNextIdentifiers = async (client) => {
  await client.query('LOCK TABLE patent_filings IN EXCLUSIVE MODE');

  const currentYear = new Date().getUTCFullYear();

  const sequenceResult = await client.query(
    'SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence FROM patent_filings'
  );
  const yearlySequenceResult = await client.query(
    'SELECT COALESCE(MAX(yearly_sequence), 0) + 1 AS next_sequence FROM patent_filings WHERE filing_year = $1',
    [currentYear]
  );

  const sequenceNumber = Number(sequenceResult.rows[0].next_sequence);
  const yearlySequence = Number(yearlySequenceResult.rows[0].next_sequence);

  return {
    currentYear,
    sequenceNumber,
    yearlySequence,
    patentId: `PT-${String(sequenceNumber).padStart(6, '0')}`,
    referenceNumber: `REQ-PT-${currentYear}-${String(yearlySequence).padStart(3, '0')}`,
  };
};

const getFilingById = async (id) => {
  const result = await db.query(`${selectClause} WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

const ensureSubmitFields = (filing) => {
  const required = [
    { field: 'title', value: filing.title },
    { field: 'abstractText', value: filing.abstract_text },
    { field: 'applicantName', value: filing.applicant_name },
    { field: 'applicantEmail', value: filing.applicant_email },
    { field: 'applicantMobile', value: filing.applicant_mobile },
    { field: 'fieldOfInvention', value: filing.field_of_invention },
  ];

  const missingFields = required.filter((item) => !item.value).map((item) => item.field);

  if (
    filing.field_of_invention === 'Other' &&
    (!filing.field_of_invention_other || filing.field_of_invention_other.trim().length === 0)
  ) {
    missingFields.push('fieldOfInventionOther');
  }

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

const createPatentFiling = async ({ user, payload }) => {
  const saveAsDraft = Boolean(payload.saveAsDraft);
  const status = saveAsDraft ? DRAFT : PENDING;
  const submittedAt = saveAsDraft ? null : new Date().toISOString();

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const identifiers = await getNextIdentifiers(client);

    const result = await client.query(
      `
        INSERT INTO patent_filings (
          user_id,
          reference_number,
          patent_id,
          filing_year,
          yearly_sequence,
          sequence_number,
          title,
          field_of_invention,
          field_of_invention_other,
          abstract_text,
          applicant_name,
          applicant_email,
          applicant_mobile,
          supporting_document_url,
          status,
          estimation,
          submitted_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, $17
        )
        RETURNING *
      `,
      [
        user.id,
        identifiers.referenceNumber,
        identifiers.patentId,
        identifiers.currentYear,
        identifiers.yearlySequence,
        identifiers.sequenceNumber,
        payload.title || '',
        payload.fieldOfInvention || '',
        payload.fieldOfInventionOther || null,
        payload.abstractText || '',
        payload.applicantName || '',
        payload.applicantEmail || '',
        payload.applicantMobile || '',
        payload.supportingDocumentUrl || null,
        status,
        payload.estimation || null,
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

const submitPatentFiling = async ({ user, id }) => {
  const filing = await getFilingById(id);
  if (!filing) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }

  assertCanAccessFiling(user, filing.user_id);

  if (filing.status !== DRAFT) {
    throw new ApiError(409, 'Only DRAFT filings can be submitted', null, 'STATUS_CONFLICT');
  }

  ensureSubmitFields(filing);

  const result = await db.query(
    `
      UPDATE patent_filings
      SET status = $2, submitted_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, PENDING]
  );

  return mapRowToFiling(result.rows[0]);
};

const parseSort = (sort) => {
  const [field = 'submittedAt', directionRaw = 'desc'] = String(sort || 'submittedAt,desc').split(',');
  const column = SORT_FIELD_TO_COLUMN[field] || 'submitted_at';
  const direction = directionRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
};

const listPatentFilings = async ({ user, query }) => {
  const whereParts = [];
  const values = [];
  let index = 1;

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

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const sortClause = parseSort(query.sort);
  const offset = query.page * query.size;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total_elements FROM patent_filings ${whereClause}`,
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

const getPatentFilingByReference = async ({ user, referenceNumber }) => {
  const result = await db.query(`${selectClause} WHERE reference_number = $1`, [referenceNumber]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }

  const filing = result.rows[0];
  assertCanAccessFiling(user, filing.user_id);

  return mapRowToFiling(filing);
};

const updateDraftPatentFiling = async ({ user, id, payload }) => {
  const current = await getFilingById(id);
  if (!current) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
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

  const allowedFields = [
    ['title', 'title'],
    ['fieldOfInvention', 'field_of_invention'],
    ['fieldOfInventionOther', 'field_of_invention_other'],
    ['abstractText', 'abstract_text'],
    ['applicantName', 'applicant_name'],
    ['applicantEmail', 'applicant_email'],
    ['applicantMobile', 'applicant_mobile'],
    ['supportingDocumentUrl', 'supporting_document_url'],
    ['estimation', 'estimation'],
  ];

  const setClauses = [];
  const values = [];
  let index = 1;

  for (const [requestField, column] of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(payload, requestField)) {
      setClauses.push(`${column} = $${index}`);
      values.push(payload[requestField] || null);
      index += 1;
    }
  }

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No updatable fields provided', null, 'BAD_REQUEST');
  }

  const mergedFieldOfInvention =
    payload.fieldOfInvention !== undefined ? payload.fieldOfInvention : current.field_of_invention;
  const mergedFieldOfInventionOther =
    payload.fieldOfInventionOther !== undefined
      ? payload.fieldOfInventionOther
      : current.field_of_invention_other;

  if (
    mergedFieldOfInvention === 'Other' &&
    (!mergedFieldOfInventionOther || String(mergedFieldOfInventionOther).trim().length === 0)
  ) {
    throw new ApiError(
      422,
      'Validation failed',
      [
        {
          field: 'fieldOfInventionOther',
          message: 'fieldOfInventionOther is required when fieldOfInvention is Other',
        },
      ],
      'VALIDATION_ERROR'
    );
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  const result = await db.query(
    `
      UPDATE patent_filings
      SET ${setClauses.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `,
    values
  );

  return mapRowToFiling(result.rows[0]);
};

const attachSupportingDocument = async ({ user, id, supportingDocumentUrl }) => {
  const current = await getFilingById(id);
  if (!current) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }

  assertCanAccessFiling(user, current.user_id);

  const result = await db.query(
    `
      UPDATE patent_filings
      SET supporting_document_url = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING supporting_document_url
    `,
    [id, supportingDocumentUrl]
  );

  return {
    documentId: `doc_${id.replace(/-/g, '').slice(0, 12)}`,
    supportingDocumentUrl: result.rows[0].supporting_document_url,
  };
};

module.exports = {
  createPatentFiling,
  submitPatentFiling,
  listPatentFilings,
  getPatentFilingByReference,
  updateDraftPatentFiling,
  attachSupportingDocument,
};
