const db = require('../config/db');
const ApiError = require('../utils/apiError');
const bcrypt = require('bcrypt');

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const ALLOWED_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'IN_REVIEW'];
const ALLOWED_USER_ROLES = ['client', 'agent', 'admin'];

const parseSort = (sort, fieldMap) => {
  const [field = 'created_at', dirRaw = 'desc'] = String(sort || '').split(',');
  const column = fieldMap[field] || 'created_at';
  const direction = dirRaw.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
};

// ─────────────────────────────────────────────
// Dashboard / Statistics
// ─────────────────────────────────────────────

const getDashboardStats = async () => {
  const [
    totalUsersResult,
    totalPatentResult,
    totalNonPatentResult,
    patentByStatusResult,
    nonPatentByStatusResult,
    recentPatentResult,
    recentNonPatentResult,
    agentCountResult,
    clientCountResult,
  ] = await Promise.all([
    db.query(`SELECT COUNT(*)::int AS count FROM users`),
    db.query(`SELECT COUNT(*)::int AS count FROM patent_filings`),
    db.query(`SELECT COUNT(*)::int AS count FROM non_patent_filings`),
    db.query(`SELECT status, COUNT(*)::int AS count FROM patent_filings GROUP BY status`),
    db.query(`SELECT status, COUNT(*)::int AS count FROM non_patent_filings GROUP BY status`),
    db.query(
      `SELECT id, reference_number, title, status, submitted_at, created_at
       FROM patent_filings ORDER BY created_at DESC LIMIT 5`
    ),
    db.query(
      `SELECT id, reference_number, filing_type, status, submitted_at, created_at
       FROM non_patent_filings ORDER BY created_at DESC LIMIT 5`
    ),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'agent'`),
    db.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'client'`),
  ]);

  const patentStatusMap = {};
  patentByStatusResult.rows.forEach((r) => { patentStatusMap[r.status] = r.count; });

  const nonPatentStatusMap = {};
  nonPatentByStatusResult.rows.forEach((r) => { nonPatentStatusMap[r.status] = r.count; });

  return {
    users: {
      total: totalUsersResult.rows[0].count,
      clients: clientCountResult.rows[0].count,
      agents: agentCountResult.rows[0].count,
    },
    patentFilings: {
      total: totalPatentResult.rows[0].count,
      byStatus: patentStatusMap,
    },
    nonPatentFilings: {
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
// User Management
// ─────────────────────────────────────────────

const listUsers = async ({ query }) => {
  const SORT_MAP = {
    name: 'name',
    email: 'email',
    role: 'role',
    createdAt: 'created_at',
  };

  const whereParts = [];
  const values = [];
  let index = 1;

  if (query.role) {
    if (!ALLOWED_USER_ROLES.includes(query.role)) {
      throw new ApiError(400, 'Invalid role filter', null, 'BAD_REQUEST');
    }
    whereParts.push(`role = $${index}`);
    values.push(query.role);
    index += 1;
  }

  if (query.search) {
    whereParts.push(`(name ILIKE $${index} OR email ILIKE $${index})`);
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const sortClause = parseSort(query.sort, SORT_MAP);
  const page = Math.max(0, Number(query.page) || 0);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const offset = page * size;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM users ${whereClause}`,
    values
  );

  const listResult = await db.query(
    `SELECT id, name, email, role, created_at
     FROM users
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

const getUserById = async (id) => {
  const result = await db.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

const updateUserRole = async (id, role) => {
  if (!ALLOWED_USER_ROLES.includes(role)) {
    throw new ApiError(400, 'Invalid role', null, 'BAD_REQUEST');
  }
  const result = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING id, name, email, role, created_at`,
    [id, role]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

const deleteUser = async (id, requestingAdminId) => {
  if (id === requestingAdminId) {
    throw new ApiError(400, 'Admin cannot delete their own account', null, 'BAD_REQUEST');
  }
  const check = await db.query(`SELECT id FROM users WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }
  await db.query(`DELETE FROM users WHERE id = $1`, [id]);
  return { deleted: true };
};

const createAdminUser = async ({ name, email, password, role }) => {
  const allowed = ['admin', 'agent'];
  if (!allowed.includes(role)) {
    throw new ApiError(400, 'Only admin or agent roles can be created via this endpoint', null, 'BAD_REQUEST');
  }
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'Email already in use', null, 'CONFLICT');
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const result = await db.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, hashedPassword, role]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Patent Filing Management (Admin)
// ─────────────────────────────────────────────

const PATENT_SORT_MAP = {
  submittedAt: 'submitted_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  title: 'title',
  status: 'status',
};

const adminListPatentFilings = async ({ query }) => {
  const whereParts = [];
  const values = [];
  let index = 1;

  if (query.status) {
    if (!ALLOWED_STATUSES.includes(query.status)) {
      throw new ApiError(400, 'Invalid status filter', null, 'BAD_REQUEST');
    }
    whereParts.push(`pf.status = $${index}`);
    values.push(query.status);
    index += 1;
  }

  if (query.userId) {
    whereParts.push(`pf.user_id = $${index}`);
    values.push(query.userId);
    index += 1;
  }

  if (query.search) {
    whereParts.push(`(pf.title ILIKE $${index} OR pf.reference_number ILIKE $${index} OR pf.applicant_name ILIKE $${index})`);
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
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
       pf.submitted_at, pf.updated_at, pf.created_at,
       pf.assigned_agent_id, pf.assigned_at,
       u.name AS client_name, u.email AS client_email,
       a.name AS agent_name
     FROM patent_filings pf
     LEFT JOIN users u ON u.id = pf.user_id
     LEFT JOIN users a ON a.id = pf.assigned_agent_id
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

const adminGetPatentFiling = async (id) => {
  const result = await db.query(
    `SELECT
       pf.*,
       u.name AS client_name, u.email AS client_email,
       a.name AS agent_name, a.email AS agent_email
     FROM patent_filings pf
     LEFT JOIN users u ON u.id = pf.user_id
     LEFT JOIN users a ON a.id = pf.assigned_agent_id
     WHERE pf.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

const adminUpdatePatentFilingStatus = async (id, status, adminNote) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`, null, 'BAD_REQUEST');
  }

  const check = await db.query(`SELECT id, status FROM patent_filings WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }

  if (check.rows[0].status === 'DRAFT') {
    throw new ApiError(409, 'Cannot update status of a DRAFT filing', null, 'STATUS_CONFLICT');
  }

  const setClauses = [`status = $2`, `updated_at = NOW()`];
  const values = [id, status];

  if (adminNote !== undefined) {
    setClauses.push(`admin_note = $${values.length + 1}`);
    values.push(adminNote);
  }

  const result = await db.query(
    `UPDATE patent_filings SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
};

const adminAssignAgentToPatent = async (filingId, agentId) => {
  // Verify filing exists
  const filingCheck = await db.query(`SELECT id, status FROM patent_filings WHERE id = $1`, [filingId]);
  if (filingCheck.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }

  // Verify agent exists and is an agent
  const agentCheck = await db.query(
    `SELECT id, name, email FROM users WHERE id = $1 AND role = 'agent'`,
    [agentId]
  );
  if (agentCheck.rows.length === 0) {
    throw new ApiError(404, 'Agent not found', null, 'NOT_FOUND');
  }

  const agent = agentCheck.rows[0];

  const result = await db.query(
    `UPDATE patent_filings
     SET assigned_agent_id = $2, agent_name = $3, assigned_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [filingId, agentId, agent.name]
  );
  return result.rows[0];
};

const adminSetPatentEstimation = async (id, estimation) => {
  if (typeof estimation !== 'number' || estimation < 0) {
    throw new ApiError(400, 'Estimation must be a non-negative number', null, 'BAD_REQUEST');
  }
  const check = await db.query(`SELECT id FROM patent_filings WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  const result = await db.query(
    `UPDATE patent_filings SET estimation = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, estimation]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Non-Patent Filing Management (Admin)
// ─────────────────────────────────────────────

const NON_PATENT_SORT_MAP = {
  submittedAt: 'submitted_at',
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  status: 'status',
  filingType: 'filing_type',
};

const adminListNonPatentFilings = async ({ query }) => {
  const whereParts = [];
  const values = [];
  let index = 1;

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

  if (query.userId) {
    whereParts.push(`npf.user_id = $${index}`);
    values.push(query.userId);
    index += 1;
  }

  if (query.search) {
    whereParts.push(`(npf.reference_number ILIKE $${index} OR npf.filing_identifier ILIKE $${index})`);
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
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
       npf.status, npf.submitted_at, npf.updated_at, npf.created_at,
       npf.assigned_agent_id, npf.assigned_at,
       u.name AS client_name, u.email AS client_email,
       a.name AS agent_name
     FROM non_patent_filings npf
     LEFT JOIN users u ON u.id = npf.user_id
     LEFT JOIN users a ON a.id = npf.assigned_agent_id
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

const adminGetNonPatentFiling = async (id) => {
  const result = await db.query(
    `SELECT
       npf.*,
       u.name AS client_name, u.email AS client_email,
       a.name AS agent_name, a.email AS agent_email
     FROM non_patent_filings npf
     LEFT JOIN users u ON u.id = npf.user_id
     LEFT JOIN users a ON a.id = npf.assigned_agent_id
     WHERE npf.id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

const adminUpdateNonPatentFilingStatus = async (id, status, adminNote) => {
  if (!ALLOWED_STATUSES.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}`, null, 'BAD_REQUEST');
  }

  const check = await db.query(`SELECT id, status FROM non_patent_filings WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }

  if (check.rows[0].status === 'DRAFT') {
    throw new ApiError(409, 'Cannot update status of a DRAFT filing', null, 'STATUS_CONFLICT');
  }

  const setClauses = [`status = $2`, `updated_at = NOW()`];
  const values = [id, status];

  if (adminNote !== undefined) {
    setClauses.push(`admin_note = $${values.length + 1}`);
    values.push(adminNote);
  }

  const result = await db.query(
    `UPDATE non_patent_filings SET ${setClauses.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return result.rows[0];
};

const adminAssignAgentToNonPatent = async (filingId, agentId) => {
  const filingCheck = await db.query(
    `SELECT id, status FROM non_patent_filings WHERE id = $1`,
    [filingId]
  );
  if (filingCheck.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }

  const agentCheck = await db.query(
    `SELECT id, name, email FROM users WHERE id = $1 AND role = 'agent'`,
    [agentId]
  );
  if (agentCheck.rows.length === 0) {
    throw new ApiError(404, 'Agent not found', null, 'NOT_FOUND');
  }

  const agent = agentCheck.rows[0];

  const result = await db.query(
    `UPDATE non_patent_filings
     SET assigned_agent_id = $2, agent_name = $3, assigned_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [filingId, agentId, agent.name]
  );
  return result.rows[0];
};

const adminSetNonPatentEstimation = async (id, estimation) => {
  if (typeof estimation !== 'number' || estimation < 0) {
    throw new ApiError(400, 'Estimation must be a non-negative number', null, 'BAD_REQUEST');
  }
  const check = await db.query(`SELECT id FROM non_patent_filings WHERE id = $1`, [id]);
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  const result = await db.query(
    `UPDATE non_patent_filings SET estimation = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, estimation]
  );
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Agent Workload
// ─────────────────────────────────────────────

const getAgentWorkload = async () => {
  const result = await db.query(
    `SELECT
       u.id, u.name, u.email,
       COUNT(pf.id)::int AS patent_filings_count,
       COUNT(npf.id)::int AS non_patent_filings_count,
       (COUNT(pf.id) + COUNT(npf.id))::int AS total_filings
     FROM users u
     LEFT JOIN patent_filings pf ON pf.assigned_agent_id = u.id
     LEFT JOIN non_patent_filings npf ON npf.assigned_agent_id = u.id
     WHERE u.role = 'agent'
     GROUP BY u.id, u.name, u.email
     ORDER BY total_filings DESC`
  );
  return result.rows;
};

module.exports = {
  getDashboardStats,
  listUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  createAdminUser,
  adminListPatentFilings,
  adminGetPatentFiling,
  adminUpdatePatentFilingStatus,
  adminAssignAgentToPatent,
  adminSetPatentEstimation,
  adminListNonPatentFilings,
  adminGetNonPatentFiling,
  adminUpdateNonPatentFilingStatus,
  adminAssignAgentToNonPatent,
  adminSetNonPatentEstimation,
  getAgentWorkload,
};
