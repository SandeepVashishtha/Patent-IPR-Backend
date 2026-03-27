const asyncHandler = require('../utils/asyncHandler');
const adminService = require('./admin.service');
const { parseAdminFilingsQuery } = require('./admin.validation');

const getAdminDashboard = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.getDashboard({ query });
  res.status(200).json({ data });
});

const listAdminFilings = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.listFilings({ query });
  res.status(200).json({ data });
});

const listUnassignedFilings = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.listUnassignedFilings({ query });
  res.status(200).json({ data });
});

const listAssignments = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.listAssignments({ query });
  res.status(200).json({ data });
});

const listDecisions = asyncHandler(async (req, res) => {
  const query = parseAdminFilingsQuery(req.query);
  const data = await adminService.listDecisions({ query });
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

const listClients = asyncHandler(async (req, res) => {
  const data = await adminService.listClients();
  res.status(200).json({ data });
});

const getAdminProfile = asyncHandler(async (req, res) => {
  const data = await adminService.getAdminProfile({ userId: req.user.id });
  res.status(200).json({ data });
});

module.exports = {
  getAdminDashboard,
  listAdminFilings,
  listUnassignedFilings,
  listAssignments,
  listDecisions,
  assignAgentToFiling,
  reassignAgentToFiling,
  setFilingDecision,
  listAgents,
  listClients,
  getAdminProfile,
};
