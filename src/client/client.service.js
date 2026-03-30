const db = require('../config/db');
const ApiError = require('../utils/apiError');
const bcrypt = require('bcrypt');

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

/**
 * Get the authenticated client's profile
 */
const getProfile = async (userId) => {
  const result = await db.query(
    `SELECT id, name, email, role, created_at FROM users WHERE id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

/**
 * Update the authenticated client's name and/or email
 */
const updateProfile = async (userId, { name, email }) => {
  if (!name && !email) {
    throw new ApiError(400, 'At least one field (name or email) is required', null, 'BAD_REQUEST');
  }

  const setClauses = [];
  const values = [userId];
  let index = 2;

  if (name) {
    setClauses.push(`name = $${index}`);
    values.push(name.trim());
    index += 1;
  }

  if (email) {
    // Check for email conflicts
    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1 AND id != $2`,
      [email.toLowerCase().trim(), userId]
    );
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'Email already in use by another account', null, 'CONFLICT');
    }
    setClauses.push(`email = $${index}`);
    values.push(email.toLowerCase().trim());
    index += 1;
  }

  const result = await db.query(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING id, name, email, role, created_at`,
    values
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

// ─────────────────────────────────────────────
// Password Management
// ─────────────────────────────────────────────

/**
 * Change password — requires current password verification
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required', null, 'BAD_REQUEST');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters', null, 'BAD_REQUEST');
  }

  const result = await db.query(`SELECT password FROM users WHERE id = $1`, [userId]);
  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found', null, 'NOT_FOUND');
  }

  const passwordMatch = await bcrypt.compare(currentPassword, result.rows[0].password);
  if (!passwordMatch) {
    throw new ApiError(401, 'Current password is incorrect', null, 'UNAUTHORIZED');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password = $2 WHERE id = $1`,
    [userId, hashedPassword]
  );

  return { message: 'Password changed successfully' };
};

/**
 * Reset password by email (no token/email sending — sets a new password directly).
 * In a real system this would send an email. Here it allows resetting with email + new password.
 * Extend with OTP/email flow as needed.
 */
const forgotPassword = async ({ email, newPassword }) => {
  if (!email || !newPassword) {
    throw new ApiError(400, 'email and newPassword are required', null, 'BAD_REQUEST');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters', null, 'BAD_REQUEST');
  }

  const result = await db.query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  if (result.rows.length === 0) {
    // Generic message to avoid email enumeration
    throw new ApiError(404, 'No account found with that email', null, 'NOT_FOUND');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await db.query(
    `UPDATE users SET password = $2 WHERE id = $1`,
    [result.rows[0].id, hashedPassword]
  );

  return { message: 'Password reset successfully' };
};

// ─────────────────────────────────────────────
// Patent Filings (Client)
// ─────────────────────────────────────────────

/**
 * Get all patent filings for the authenticated client including payment estimation and agent details
 */
const clientListPatentFilings = async ({ userId, query }) => {
  const whereParts = [`pf.user_id = $1`];
  const values = [userId];
  let index = 2;

  if (query.status) {
    whereParts.push(`pf.status = $${index}`);
    values.push(query.status.toUpperCase());
    index += 1;
  }

  if (query.search) {
    whereParts.push(
      `(pf.title ILIKE $${index} OR pf.reference_number ILIKE $${index})`
    );
    values.push(`%${query.search}%`);
    index += 1;
  }

  const whereClause = `WHERE ${whereParts.join(' AND ')}`;
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
       pf.admin_note, pf.submitted_at, pf.assigned_at, pf.updated_at, pf.created_at,
       -- Assigned agent info
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email
     FROM patent_filings pf
     LEFT JOIN users a ON a.id = pf.assigned_agent_id
     ${whereClause}
     ORDER BY pf.created_at DESC
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

/**
 * Get a single patent filing for the authenticated client
 */
const clientGetPatentFiling = async (userId, filingId) => {
  const result = await db.query(
    `SELECT
       pf.*,
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email
     FROM patent_filings pf
     LEFT JOIN users a ON a.id = pf.assigned_agent_id
     WHERE pf.id = $1 AND pf.user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

/**
 * Delete a patent filing — only DRAFT filings can be deleted by the client
 */
const clientDeletePatentFiling = async (userId, filingId) => {
  const check = await db.query(
    `SELECT id, status FROM patent_filings WHERE id = $1 AND user_id = $2`,
    [filingId, userId]
  );
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  if (check.rows[0].status !== 'DRAFT') {
    throw new ApiError(
      409,
      'Only DRAFT filings can be deleted. Contact support to cancel a submitted filing.',
      null,
      'STATUS_CONFLICT'
    );
  }
  await db.query(`DELETE FROM patent_filings WHERE id = $1`, [filingId]);
  return { deleted: true };
};

// ─────────────────────────────────────────────
// Non-Patent Filings (Client)
// ─────────────────────────────────────────────

/**
 * Get all non-patent filings for the authenticated client
 */
const clientListNonPatentFilings = async ({ userId, query }) => {
  const whereParts = [`npf.user_id = $1`];
  const values = [userId];
  let index = 2;

  if (query.status) {
    whereParts.push(`npf.status = $${index}`);
    values.push(query.status.toUpperCase());
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
       npf.status, npf.estimation, npf.admin_note,
       npf.submitted_at, npf.assigned_at, npf.updated_at, npf.created_at,
       -- Assigned agent info
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email
     FROM non_patent_filings npf
     LEFT JOIN users a ON a.id = npf.assigned_agent_id
     ${whereClause}
     ORDER BY npf.created_at DESC
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

/**
 * Get a single non-patent filing for the authenticated client
 */
const clientGetNonPatentFiling = async (userId, filingId) => {
  const result = await db.query(
    `SELECT
       npf.*,
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email
     FROM non_patent_filings npf
     LEFT JOIN users a ON a.id = npf.assigned_agent_id
     WHERE npf.id = $1 AND npf.user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  return result.rows[0];
};

/**
 * Delete a non-patent filing — only DRAFT filings can be deleted by the client
 */
const clientDeleteNonPatentFiling = async (userId, filingId) => {
  const check = await db.query(
    `SELECT id, status FROM non_patent_filings WHERE id = $1 AND user_id = $2`,
    [filingId, userId]
  );
  if (check.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  if (check.rows[0].status !== 'DRAFT') {
    throw new ApiError(
      409,
      'Only DRAFT filings can be deleted. Contact support to cancel a submitted filing.',
      null,
      'STATUS_CONFLICT'
    );
  }
  await db.query(`DELETE FROM non_patent_filings WHERE id = $1`, [filingId]);
  return { deleted: true };
};

// ─────────────────────────────────────────────
// Payment / Estimation (Admin-set, Client reads)
// ─────────────────────────────────────────────

/**
 * Get payment/estimation info for a specific patent filing belonging to the client
 */
const getPatentPaymentInfo = async (userId, filingId) => {
  const result = await db.query(
    `SELECT id, reference_number, title, status, estimation, admin_note, updated_at
     FROM patent_filings
     WHERE id = $1 AND user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  const row = result.rows[0];
  return {
    filingId: row.id,
    referenceNumber: row.reference_number,
    title: row.title,
    status: row.status,
    estimation: row.estimation,       // Amount set by admin
    adminNote: row.admin_note,        // Note/feedback set by admin
    updatedAt: row.updated_at,
  };
};

/**
 * Get payment/estimation info for a specific non-patent filing belonging to the client
 */
const getNonPatentPaymentInfo = async (userId, filingId) => {
  const result = await db.query(
    `SELECT id, reference_number, filing_type, filing_identifier, status, estimation, admin_note, updated_at
     FROM non_patent_filings
     WHERE id = $1 AND user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  const row = result.rows[0];
  return {
    filingId: row.id,
    referenceNumber: row.reference_number,
    filingType: row.filing_type,
    filingIdentifier: row.filing_identifier,
    status: row.status,
    estimation: row.estimation,     // Amount set by admin
    adminNote: row.admin_note,
    updatedAt: row.updated_at,
  };
};

// ─────────────────────────────────────────────
// Assigned Agent Details (Client views)
// ─────────────────────────────────────────────

/**
 * Get the agent assigned to a specific patent filing
 */
const getPatentAssignedAgent = async (userId, filingId) => {
  const result = await db.query(
    `SELECT
       pf.id AS filing_id,
       pf.reference_number,
       pf.title,
       pf.assigned_at,
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email,
       a.created_at AS agent_since
     FROM patent_filings pf
     LEFT JOIN users a ON a.id = pf.assigned_agent_id
     WHERE pf.id = $1 AND pf.user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Patent filing not found', null, 'NOT_FOUND');
  }
  const row = result.rows[0];
  if (!row.agent_id) {
    return { assigned: false, agent: null };
  }
  return {
    assigned: true,
    assignedAt: row.assigned_at,
    agent: {
      id: row.agent_id,
      name: row.agent_name,
      email: row.agent_email,
      memberSince: row.agent_since,
    },
  };
};

/**
 * Get the agent assigned to a specific non-patent filing
 */
const getNonPatentAssignedAgent = async (userId, filingId) => {
  const result = await db.query(
    `SELECT
       npf.id AS filing_id,
       npf.reference_number,
       npf.filing_type,
       npf.assigned_at,
       a.id   AS agent_id,
       a.name AS agent_name,
       a.email AS agent_email,
       a.created_at AS agent_since
     FROM non_patent_filings npf
     LEFT JOIN users a ON a.id = npf.assigned_agent_id
     WHERE npf.id = $1 AND npf.user_id = $2`,
    [filingId, userId]
  );
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Non-patent filing not found', null, 'NOT_FOUND');
  }
  const row = result.rows[0];
  if (!row.agent_id) {
    return { assigned: false, agent: null };
  }
  return {
    assigned: true,
    assignedAt: row.assigned_at,
    agent: {
      id: row.agent_id,
      name: row.agent_name,
      email: row.agent_email,
      memberSince: row.agent_since,
    },
  };
};

module.exports = {
  // Profile
  getProfile,
  updateProfile,
  // Password
  changePassword,
  forgotPassword,
  // Patent Filings
  clientListPatentFilings,
  clientGetPatentFiling,
  clientDeletePatentFiling,
  // Non-Patent Filings
  clientListNonPatentFilings,
  clientGetNonPatentFiling,
  clientDeleteNonPatentFiling,
  // Payment Info
  getPatentPaymentInfo,
  getNonPatentPaymentInfo,
  // Assigned Agent
  getPatentAssignedAgent,
  getNonPatentAssignedAgent,
};
