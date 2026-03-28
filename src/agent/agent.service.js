const db = require('../config/db');
const ApiError = require('../utils/apiError');

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const ALLOWED_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'];

const parseSort = (sort, fieldMap) => {
  const [field = 'created_at', dirRaw = 'desc'] = String(sort || '').split(',');
  const column = fieldMap[field] || 'created_at';
  const direction = dirRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
};

// ─────────────────────────────────────────────
// Agent Dashboard / Stats
// ─────────────────────────────────────────────

/**
 * Get summary stats for the logged-in agent:
 * - total assigned patent filings (by status)
 * - total assigned non-patent filings (by status)
 * - recent assigned filings
 */
const getAgentDashboard = async (agentId) => {
  const [
    totalPatentResult,
    totalNonPatentResult,
    patentByStatusResult,
    nonPatentByStatusResult,
    recentPatentResult,
    recentNonPatentResult,
  ] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count FROM patent_filings WHERE assigned_agent_id = $1`,
      [agentId]
    ),
    db.query(
      `SELECT COUNT(*)::int AS count FROM non_patent_filings WHERE assigned_agent_id = $1`,
      [agentId]
    ),
    db.query(
      `SELECT status, COUNT(*)::int AS count FROM patent_filings WHERE assigned_agent_id = $1 GROUP BY status`,
      [agentId]
    ),
    db.query(
      `SELECT status, COUNT(*)::int AS count FROM non_patent_filings WHERE assigned_agent_id = $1 GROUP BY status`,
      [agentId]
    ),
    db.query(
      `SELECT pf.id, pf.reference_number, pf.title, pf.status, pf.submitted_at, pf.assigned_at,
              u.name AS client_name, u.email AS client_email
       FROM patent_filings pf
       LEFT JOIN users u ON u.id = pf.user_id
       WHERE pf.assigned_agent_id = $1
       ORDER BY pf.assigned_at DESC NULLS LAST, pf.created_at DESC
       LIMIT 5`,
      [agentId]
    ),
    db.query(
      `SELECT npf.id, npf.reference_number, npf.filing_type, npf.status, npf.submitted_at, npf.assigned_at,
              u.name AS client_name, u.email AS client_email
       FROM non_patent_filings npf
       LEFT JOIN users u ON u.id = npf.user_id
       WHERE npf.assigned_agent_id = $1
       ORDER BY npf.assigned_at DESC NULLS LAST, npf.created_at DESC
       LIMIT 5`,
      [agentId]
    ),
  ]);

  const patentStatusMap = {};
  patentByStatusResult.rows.forEach((r) => { patentStatusMap[r.status] = r.count; });

  const nonPatentStatusMap = {};
  nonPatentByStatusResult.rows.forEach((r) => { nonPatentStatusMap[r.status] = r.count; });

  return {
    assignedPatentFilings: {
      total: totalPatentResult.rows[0].count,
      byStatus: patentStatusMap,
    },
    assignedNonPatentFilings: {
      total: totalNonPatentResult.rows[0].count,
      byStatus: nonPatentStatusMap,
    },
    recentActivity: {
      patentFilings: recentPatentResult.rows,
      nonPatentFilings: recentNonPatentResult.rows,
    },
  };
};

// ─────────────────────────────────────────────
// Agent Profile
// ─────────────────────────────────────────────

const getAgentProfile = async (agentId) => {
  const result = await db.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id = $1 AND role = 'agent'`,
    [agentId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Agent profile not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Agent Patent Filings (Assigned)
// ─────────────────────────────────────────────

const PATENT_SORT_MAP = {
  submittedAt: 'submitted_at',
  assignedAt: 'assigned_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  title: 'title',
  status: 'status',
};

const agentListPatentFilings = async ({ agentId, query }) => {
  const whereParts = [`pf.assigned_agent_id = $1`];
  const values = [agentId];
  let index = 2;

  if (query.status) {
    if (!ALLOWED_STATUSES.includes(query.status)) {
      throw new ApiError(400, 'Invalid status filter', null, 'BAD_REQUEST');
    }
    whereParts.push(`pf.status = $${index}`);
    values.push(query.status);
    index += 1;
  }

  if (query.search) {
    whereParts.push(
      `(pf.title ILIKE $${index} OR pf.reference_number ILIKE $${index} OR pf.applicant_name ILIKE $${index})`
    );
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const sortClause = parseSort(query.sort, PATENT_SORT_MAP);
  const page = Math.max(0, Number(query.page) || 0);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const offset = page * size;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM patent_filings pf ${whereClause}`,
    values
  );

  const listResult = await db.query(
    `SELECT
       pf.id, pf.reference_number, pf.patent_id, pf.title,
       pf.field_of_invention, pf.applicant_name, pf.applicant_email,
       pf.applicant_mobile, pf.status, pf.estimation,
       pf.submitted_at, pf.assigned_at, pf.updated_at, pf.created_at,
       u.name AS client_name, u.email AS client_email
     FROM patent_filings pf
     LEFT JOIN users u ON u.id = pf.user_id
     ${whereClause}
     ORDER BY ${sortClause}
     LIMIT $${index} OFFSET $${index + 1}`,
    [...values, size, offset]
  );

  const totalElements = countResult.rows[0].total;
  return {
    content: listResult.rows,
    pageable: {
      page,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size) || 0,
    },
  };
};

const agentGetPatentFiling = async (agentId, filingId) => {
  const result = await db.query(
    `SELECT
       pf.*,
       u.name AS client_name, u.email AS client_email
     FROM patent_filings pf
     LEFT JOIN users u ON u.id = pf.user_id
     WHERE pf.id = $1 AND pf.assigned_agent_id = $2`,
    [filingId, agentId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(
      404,
      'Patent filing not found or not assigned to you',
      null,
      'NOT_FOUND'
    );
  }
  return result.rows[0];
};

/**
 * Agent updates the status of an assigned patent filing
 * Agents can move: PENDING → IN_REVIEW → APPROVED / REJECTED
 */
const agentUpdatePatentFilingStatus = async (agentId, filingId, status, agentNote) => {
  const AGENT_ALLOWED_STATUSES = ['IN_REVIEW', 'APPROVED', 'REJECTED'];
  if (!AGENT_ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Agent can set: ${AGENT_ALLOWED_STATUSES.join(', ')}`,
      null,
      'BAD_REQUEST'
    );
  }

  const check = await db.query(
    `SELECT id, status FROM patent_filings WHERE id = $1 AND assigned_agent_id = $2`,
    [filingId, agentId]
  );
  if (check.rows.length === 0) {
    throw new ApiError(
      404,
      'Patent filing not found or not assigned to you',
      null,
      'NOT_FOUND'
    );
  }
  if (check.rows[0].status === 'DRAFT') {
    throw new ApiError(409, 'Cannot update a DRAFT filing', null, 'STATUS_CONFLICT');
  }

  const setClauses = [`status = $3`, `updated_at = NOW()`];
  const values = [filingId, agentId, status];

  if (agentNote !== undefined) {
    setClauses.push(`admin_note = $${values.length + 1}`);
    values.push(agentNote);
  }

  const result = await db.query(
    `UPDATE patent_filings SET ${setClauses.join(', ')} WHERE id = $1 AND assigned_agent_id = $2 RETURNING *`,
    values
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Agent Non-Patent Filings (Assigned)
// ─────────────────────────────────────────────

const NON_PATENT_SORT_MAP = {
  submittedAt: 'submitted_at',
  assignedAt: 'assigned_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  status: 'status',
  filingType: 'filing_type',
};

const agentListNonPatentFilings = async ({ agentId, query }) => {
  const whereParts = [`npf.assigned_agent_id = $1`];
  const values = [agentId];
  let index = 2;

  if (query.status) {
    if (!ALLOWED_STATUSES.includes(query.status)) {
      throw new ApiError(400, 'Invalid status filter', null, 'BAD_REQUEST');
    }
    whereParts.push(`npf.status = $${index}`);
    values.push(query.status);
    index += 1;
  }

  if (query.filingType) {
    whereParts.push(`npf.filing_type = $${index}`);
    values.push(query.filingType.toUpperCase());
    index += 1;
  }

  if (query.search) {
    whereParts.push(
      `(npf.reference_number ILIKE $${index} OR npf.filing_identifier ILIKE $${index})`
    );
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
  const sortClause = parseSort(query.sort, NON_PATENT_SORT_MAP);
  const page = Math.max(0, Number(query.page) || 0);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const offset = page * size;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM non_patent_filings npf ${whereClause}`,
    values
  );

  const listResult = await db.query(
    `SELECT
       npf.id, npf.reference_number, npf.filing_identifier, npf.filing_type,
       npf.status, npf.payload, npf.submitted_at, npf.assigned_at, npf.updated_at, npf.created_at,
       u.name AS client_name, u.email AS client_email
     FROM non_patent_filings npf
     LEFT JOIN users u ON u.id = npf.user_id
     ${whereClause}
     ORDER BY ${sortClause}
     LIMIT $${index} OFFSET $${index + 1}`,
    [...values, size, offset]
  );

  const totalElements = countResult.rows[0].total;
  return {
    content: listResult.rows,
    pageable: {
      page,
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size) || 0,
    },
  };
};

const agentGetNonPatentFiling = async (agentId, filingId) => {
  const result = await db.query(
    `SELECT
       npf.*,
       u.name AS client_name, u.email AS client_email
     FROM non_patent_filings npf
     LEFT JOIN users u ON u.id = npf.user_id
     WHERE npf.id = $1 AND npf.assigned_agent_id = $2`,
    [filingId, agentId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(
      404,
      'Non-patent filing not found or not assigned to you',
      null,
      'NOT_FOUND'
    );
  }
  return result.rows[0];
};

/**
 * Agent updates the status of an assigned non-patent filing
 */
const agentUpdateNonPatentFilingStatus = async (agentId, filingId, status, agentNote) => {
  const AGENT_ALLOWED_STATUSES = ['IN_REVIEW', 'APPROVED', 'REJECTED'];
  if (!AGENT_ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status. Agent can set: ${AGENT_ALLOWED_STATUSES.join(', ')}`,
      null,
      'BAD_REQUEST'
    );
  }

  const check = await db.query(
    `SELECT id, status FROM non_patent_filings WHERE id = $1 AND assigned_agent_id = $2`,
    [filingId, agentId]
  );
  if (check.rows.length === 0) {
    throw new ApiError(
      404,
      'Non-patent filing not found or not assigned to you',
      null,
      'NOT_FOUND'
    );
  }
  if (check.rows[0].status === 'DRAFT') {
    throw new ApiError(409, 'Cannot update a DRAFT filing', null, 'STATUS_CONFLICT');
  }

  const setClauses = [`status = $3`, `updated_at = NOW()`];
  const values = [filingId, agentId, status];

  if (agentNote !== undefined) {
    setClauses.push(`admin_note = $${values.length + 1}`);
    values.push(agentNote);
  }

  const result = await db.query(
    `UPDATE non_patent_filings SET ${setClauses.join(', ')} WHERE id = $1 AND assigned_agent_id = $2 RETURNING *`,
    values
  );
  return result.rows[0];
};

module.exports = {
  getAgentDashboard,
  getAgentProfile,
  agentListPatentFilings,
  agentGetPatentFiling,
  agentUpdatePatentFilingStatus,
  agentListNonPatentFilings,
  agentGetNonPatentFiling,
  agentUpdateNonPatentFilingStatus,
};
