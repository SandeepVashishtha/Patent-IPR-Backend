const db = require('../config/db');
const ApiError = require('../utils/apiError');

const DEFAULT_SORT = 'submitted_at DESC';

const normalizeFiling = (row) => ({
  id: row.id,
  type: row.filing_type === 'PATENT' ? 'patent' : 'nonPatent',
  title: row.title,
  referenceNumber: row.reference_number,
  status: row.status,
  applicantName: row.applicant_name || 'N/A',
  assignedAgentId: row.assigned_agent_id,
  assignedAgentName: row.assigned_agent_name,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

const buildListQuery = ({ query }) => {
  const values = [];
  const conditions = [];
  let index = 1;

  if (query.status) {
    conditions.push(`combined.status = $${index}`);
    values.push(query.status);
    index += 1;
  }

  if (query.unassigned) {
    conditions.push('combined.assigned_agent_id IS NULL');
  }

  if (query.type === 'patent') {
    conditions.push("combined.filing_type = 'PATENT'");
  }

  if (query.type === 'nonPatent') {
    conditions.push("combined.filing_type <> 'PATENT'");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = query.page * query.size;

  const baseCombined = `
    SELECT
      id,
      'PATENT' AS filing_type,
      title,
      reference_number,
      patent_id AS identifier,
      status,
      COALESCE(applicant_name, applicant_email, 'N/A') AS applicant_name,
      assigned_agent_id,
      assigned_agent_name,
      assigned_at,
      submitted_at,
      updated_at,
      created_at
    FROM patent_filings

    UNION ALL

    SELECT
      id,
      filing_type,
      COALESCE(payload->>'title', payload->>'trademarkName', payload->>'workTitle', payload->>'designTitle', 'N/A') AS title,
      reference_number,
      filing_identifier AS identifier,
      status,
      COALESCE(applicant_name, payload->>'applicantName', payload->>'applicant', payload->>'fullName', payload->>'name', 'N/A') AS applicant_name,
      assigned_agent_id,
      assigned_agent_name,
      assigned_at,
      submitted_at,
      updated_at,
      created_at
    FROM non_patent_filings
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total_elements
    FROM (${baseCombined}) AS combined
    ${whereClause}
  `;

  const listSql = `
    SELECT *
    FROM (${baseCombined}) AS combined
    ${whereClause}
    ORDER BY ${DEFAULT_SORT}
    LIMIT $${index}
    OFFSET $${index + 1}
  `;

  return {
    countSql,
    listSql,
    values,
    paginationValues: [...values, query.size, offset],
  };
};

const listFilings = async ({ query }) => {
  const sql = buildListQuery({ query });

  const [countResult, listResult] = await Promise.all([
    db.query(sql.countSql, sql.values),
    db.query(sql.listSql, sql.paginationValues),
  ]);

  const totalElements = countResult.rows[0].total_elements;
  const totalPages = Math.ceil(totalElements / query.size) || 0;

  return {
    content: listResult.rows.map(normalizeFiling),
    pageable: {
      page: query.page,
      size: query.size,
      totalElements,
      totalPages,
    },
  };
};

const getAgentById = async (agentId) => {
  const result = await db.query(
    `
      SELECT id, name, email, role
      FROM users
      WHERE id = $1
    `,
    [agentId]
  );

  return result.rows[0] || null;
};

const updatePatentAssignment = async ({ filingId, agentId }) => {
  const result = await db.query(
    `
      UPDATE patent_filings
      SET agent_id = $2,
      SET assigned_agent_id = $2,
          assigned_agent_name = (SELECT name FROM users WHERE id = $2),
          assigned_at = NOW(),
          status = CASE
            WHEN status = 'PENDING' THEN 'ASSIGNED'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        'PATENT' AS filing_type,
        title,
        reference_number,
        patent_id AS identifier,
        status,
        COALESCE(applicant_name, applicant_email, 'N/A') AS applicant_name,
        assigned_agent_id,
        assigned_agent_name,
        assigned_at,
        submitted_at,
        updated_at,
        created_at
    `,
    [filingId, agentId]
  );

  return result.rows[0] || null;
};

const updateNonPatentAssignment = async ({ filingId, agentId }) => {
  const result = await db.query(
    `
      UPDATE non_patent_filings
      SET agent_id = $2,
      SET assigned_agent_id = $2,
          assigned_agent_name = (SELECT name FROM users WHERE id = $2),
          assigned_at = NOW(),
          status = CASE
            WHEN status = 'PENDING' THEN 'ASSIGNED'
            ELSE status
          END,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        filing_type,
        COALESCE(payload->>'title', payload->>'trademarkName', payload->>'workTitle', payload->>'designTitle', 'N/A') AS title,
        reference_number,
        filing_identifier AS identifier,
        status,
        COALESCE(applicant_name, payload->>'applicantName', payload->>'applicant', payload->>'fullName', payload->>'name', 'N/A') AS applicant_name,
        assigned_agent_id,
        assigned_agent_name,
        assigned_at,
        submitted_at,
        updated_at,
        created_at
    `,
    [filingId, agentId]
  );

  return result.rows[0] || null;
};

const assignAgentToFiling = async ({ filingId, agentId }) => {
  const agent = await getAgentById(agentId);

  if (!agent) {
    throw new ApiError(404, 'Agent not found', null, 'NOT_FOUND');
  }

  if (agent.role !== 'agent') {
    throw new ApiError(422, 'Selected user is not an agent', null, 'VALIDATION_ERROR');
  }

  const patentUpdated = await updatePatentAssignment({ filingId, agentId });
  if (patentUpdated) {
    return {
      id: patentUpdated.id,
      assignedAgentId: patentUpdated.assigned_agent_id,
      status: patentUpdated.status,
    };
  }

  const nonPatentUpdated = await updateNonPatentAssignment({ filingId, agentId });
  if (nonPatentUpdated) {
    return {
      id: nonPatentUpdated.id,
      assignedAgentId: nonPatentUpdated.assigned_agent_id,
      status: nonPatentUpdated.status,
    };
  }

  throw new ApiError(404, 'Filing not found', null, 'NOT_FOUND');
};

const setFilingDecision = async ({ filingId, status }) => {
  const patentUpdateResult = await db.query(
    `
      UPDATE patent_filings
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        'PATENT' AS filing_type,
        title,
        reference_number,
        patent_id AS identifier,
        status,
        COALESCE(applicant_name, applicant_email, 'N/A') AS applicant_name,
        assigned_agent_id,
        assigned_agent_name,
        assigned_at,
        submitted_at,
        updated_at,
        created_at
    `,
    [filingId, status]
  );

  if (patentUpdateResult.rows.length > 0) {
    return {
      id: patentUpdateResult.rows[0].id,
      status: patentUpdateResult.rows[0].status,
      updatedAt: patentUpdateResult.rows[0].updated_at,
    };
  }

  const nonPatentUpdateResult = await db.query(
    `
      UPDATE non_patent_filings
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        filing_type,
        COALESCE(payload->>'title', payload->>'trademarkName', payload->>'workTitle', payload->>'designTitle', 'N/A') AS title,
        reference_number,
        filing_identifier AS identifier,
        status,
        COALESCE(applicant_name, payload->>'applicantName', payload->>'applicant', payload->>'fullName', payload->>'name', 'N/A') AS applicant_name,
        assigned_agent_id,
        assigned_agent_name,
        assigned_at,
        submitted_at,
        updated_at,
        created_at
    `,
    [filingId, status]
  );

  if (nonPatentUpdateResult.rows.length > 0) {
    return {
      id: nonPatentUpdateResult.rows[0].id,
      status: nonPatentUpdateResult.rows[0].status,
      updatedAt: nonPatentUpdateResult.rows[0].updated_at,
    };
  }

  throw new ApiError(404, 'Filing not found', null, 'NOT_FOUND');
};

const listAgents = async () => {
  const result = await db.query(
    `
      SELECT
        id,
        name,
        email,
        (
          SELECT COUNT(*)::int
          FROM patent_filings pf
          WHERE pf.assigned_agent_id = users.id
            AND pf.status IN ('ASSIGNED', 'IN_PROGRESS')
        ) + (
          SELECT COUNT(*)::int
          FROM non_patent_filings npf
          WHERE npf.assigned_agent_id = users.id
            AND npf.status IN ('ASSIGNED', 'IN_PROGRESS')
        ) AS active_assignments
      FROM users
      WHERE role = 'agent'
      ORDER BY name ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    activeAssignments: row.active_assignments,
  }));
};

module.exports = {
  listFilings,
  assignAgentToFiling,
  setFilingDecision,
  listAgents,
};
