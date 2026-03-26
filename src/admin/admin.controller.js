const asyncHandler = require('../utils/asyncHandler');
const adminService = require('./admin.service');
const { parseAdminFilingsQuery } = require('./admin.validation');

const listAdminFilings = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.listFilings({ query });
  res.status(200).json({ data });
});

const assignAgentToFiling = asyncHandler(async (req, res) => {
  const data = await adminService.assignAgentToFiling({
    filingId: req.params.id,
    agentId: req.body.agentId,
  });
  res.status(200).json({ message: 'Filing assigned to agent', data });
});

const reassignAgentToFiling = asyncHandler(async (req, res) => {
  const data = await adminService.assignAgentToFiling({
    filingId: req.params.id,
    agentId: req.body.agentId,
  });
  res.status(200).json({ message: 'Filing reassigned', data });
});

const setFilingDecision = asyncHandler(async (req, res) => {
  const data = await adminService.setFilingDecision({
    filingId: req.params.id,
    status: req.body.status,
  });
  res.status(200).json({ message: 'Filing status updated', data });
});

const listAgents = asyncHandler(async (req, res) => {
  const data = await adminService.listAgents();
  res.status(200).json({ data });
});

module.exports = {
  listAdminFilings,
  assignAgentToFiling,
  reassignAgentToFiling,
  setFilingDecision,
  listAgents,
};
