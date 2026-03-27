const db = require('../config/db');
const ApiError = require('../utils/apiError');

const DEFAULT_SORT = 'submitted_at DESC';
const NON_PATENT_TITLE_SQL = "COALESCE(payload->>'title', payload->>'trademarkName', payload->>'titleOfWork', payload->>'articleName', 'N/A')";
const NON_PATENT_APPLICANT_SQL = "COALESCE(payload->>'applicantName', payload->>'applicant', payload->>'fullName', payload->>'name', 'N/A')";
const ACTIVE_STATUSES = ['DRAFT', 'PENDING'];
const DECIDED_STATUSES = ['APPROVED', 'REJECTED'];

const normalizeFiling = (row) => ({
  id: row.id,
  type: row.filing_type === 'PATENT' ? 'patent' : 'nonPatent',
  title: row.title,
  referenceNumber: row.reference_number,
  status: row.status,
  applicantName: row.applicant_name || 'N/A',
  assignedAgentId: row.assigned_agent_id,
  assignedAgentName: row.agent_name,
  submittedAt: row.submitted_at,
  updatedAt: row.updated_at,
});

const buildListQuery = ({ query, fixedConditions = [] }) => {
  const values = [];
  const conditions = [...fixedConditions];
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
      agent_name,
      assigned_at,
      submitted_at,
      updated_at,
      created_at
    FROM patent_filings

    UNION ALL

    SELECT
      id,
      filing_type,
      ${NON_PATENT_TITLE_SQL} AS title,
      reference_number,
      filing_identifier AS identifier,
      status,
      ${NON_PATENT_APPLICANT_SQL} AS applicant_name,
      assigned_agent_id,
      agent_name,
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

const listFilingsWithConditions = async ({ query, fixedConditions = [] }) => {
  const sql = buildListQuery({ query, fixedConditions });

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

const listFilings = async ({ query }) => listFilingsWithConditions({ query, fixedConditions: [] });

const listUnassignedFilings = async ({ query }) => {
  const fixedConditions = [
    'combined.assigned_agent_id IS NULL',
    `combined.status IN ('${ACTIVE_STATUSES[0]}', '${ACTIVE_STATUSES[1]}')`,
  ];
  return listFilingsWithConditions({ query, fixedConditions });
};

const listAssignments = async ({ query }) => {
  const fixedConditions = [
    'combined.assigned_agent_id IS NOT NULL',
    `combined.status IN ('${ACTIVE_STATUSES[0]}', '${ACTIVE_STATUSES[1]}')`,
  ];
  return listFilingsWithConditions({ query, fixedConditions });
};

const listDecisions = async ({ query }) => {
  const fixedConditions = [
    `combined.status IN ('${DECIDED_STATUSES[0]}', '${DECIDED_STATUSES[1]}')`,
  ];
  return listFilingsWithConditions({ query, fixedConditions });
};

const getDashboard = async ({ query }) => {
  const statsResult = await db.query(
    `
      SELECT
        COUNT(*)::int AS total_filings,
        COUNT(*) FILTER (
          WHERE assigned_agent_id IS NULL
            AND status IN ('${ACTIVE_STATUSES[0]}', '${ACTIVE_STATUSES[1]}')
        )::int AS unassigned,
        COUNT(*) FILTER (
          WHERE assigned_agent_id IS NOT NULL
            AND status IN ('${ACTIVE_STATUSES[0]}', '${ACTIVE_STATUSES[1]}')
        )::int AS in_progress,
        COUNT(*) FILTER (
          WHERE status IN ('${DECIDED_STATUSES[0]}', '${DECIDED_STATUSES[1]}')
        )::int AS decided
      FROM (
        SELECT status, assigned_agent_id FROM patent_filings
        UNION ALL
        SELECT status, assigned_agent_id FROM non_patent_filings
      ) AS combined
    `
  );

  const filings = await listFilings({ query });
  const stats = statsResult.rows[0];

  return {
    stats: {
      totalFilings: stats.total_filings,
      unassigned: stats.unassigned,
      inProgress: stats.in_progress,
      decided: stats.decided,
    },
    filings,
  };
};

const getAdminProfile = async ({ userId }) => {
  const profileResult = await db.query(
    `
      SELECT id, name, email, role, created_at
      FROM users
      WHERE id = $1 AND role = 'admin'
    `,
    [userId]
  );

  if (profileResult.rows.length === 0) {
    throw new ApiError(404, 'Admin not found', null, 'NOT_FOUND');
  }

  const summaryResult = await db.query(
    `
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE role = 'agent') AS total_agents,
        (SELECT COUNT(*)::int FROM users WHERE role = 'client') AS total_clients,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT status FROM patent_filings
            UNION ALL
            SELECT status FROM non_patent_filings
          ) AS all_filings
        ) AS total_filings,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT status FROM patent_filings
            UNION ALL
            SELECT status FROM non_patent_filings
          ) AS all_filings
          WHERE status IN ('${ACTIVE_STATUSES[0]}', '${ACTIVE_STATUSES[1]}')
        ) AS active_filings,
        (
          SELECT COUNT(*)::int
          FROM (
            SELECT status FROM patent_filings
            UNION ALL
            SELECT status FROM non_patent_filings
          ) AS all_filings
          WHERE status IN ('${DECIDED_STATUSES[0]}', '${DECIDED_STATUSES[1]}')
        ) AS decided_filings
    `
  );

  const profile = profileResult.rows[0];
  const summary = summaryResult.rows[0];

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    createdAt: profile.created_at,
    summary: {
      totalAgents: summary.total_agents,
      totalClients: summary.total_clients,
      totalFilings: summary.total_filings,
      activeFilings: summary.active_filings,
      decidedFilings: summary.decided_filings,
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
      SET assigned_agent_id = $2,
          agent_name = (SELECT name FROM users WHERE id = $2),
          assigned_at = NOW(),
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
        agent_name,
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
      SET assigned_agent_id = $2,
          agent_name = (SELECT name FROM users WHERE id = $2),
          assigned_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        filing_type,
        ${NON_PATENT_TITLE_SQL} AS title,
        reference_number,
        filing_identifier AS identifier,
        status,
        ${NON_PATENT_APPLICANT_SQL} AS applicant_name,
        assigned_agent_id,
        agent_name,
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
        agent_name,
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
        ${NON_PATENT_TITLE_SQL} AS title,
        reference_number,
        filing_identifier AS identifier,
        status,
        ${NON_PATENT_APPLICANT_SQL} AS applicant_name,
        assigned_agent_id,
        agent_name,
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
            AND pf.status IN ('DRAFT', 'PENDING')
        ) + (
          SELECT COUNT(*)::int
          FROM non_patent_filings npf
          WHERE npf.assigned_agent_id = users.id
            AND npf.status IN ('DRAFT', 'PENDING')
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

const listClients = async () => {
  const result = await db.query(
    `
      SELECT id, name, email, role, created_at
      FROM users
      WHERE role = 'client'
      ORDER BY created_at DESC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }));
};

module.exports = {
  getDashboard,
  listFilings,
  listUnassignedFilings,
  listAssignments,
  listDecisions,
  assignAgentToFiling,
  setFilingDecision,
  getAdminProfile,
  listAgents,
  listClients,
};
