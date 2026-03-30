const asyncHandler = require('../utils/asyncHandler');
const adminService = require('./admin.service');

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

const getDashboardStats = asyncHandler(async (req, res) => {
  const data = await adminService.getDashboardStats();
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// User Management
// ─────────────────────────────────────────────

const listUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers({ query: req.query });
  res.status(200).json({ data });
});

const getUserById = asyncHandler(async (req, res) => {
  const data = await adminService.getUserById(req.params.id);
  res.status(200).json({ data });
});

const updateUserRole = asyncHandler(async (req, res) => {
  const data = await adminService.updateUserRole(req.params.id, req.body.role);
  res.status(200).json({ data });
});

const deleteUser = asyncHandler(async (req, res) => {
  await adminService.deleteUser(req.params.id, req.user.id);
  res.status(200).json({ message: 'User deleted successfully' });
});

const createAdminUser = asyncHandler(async (req, res) => {
  const data = await adminService.createAdminUser(req.body);
  res.status(201).json({ data });
});

// ─────────────────────────────────────────────
// Patent Filings
// ─────────────────────────────────────────────

const listPatentFilings = asyncHandler(async (req, res) => {
  const data = await adminService.adminListPatentFilings({ query: req.query });
  res.status(200).json({ data });
});

const getPatentFiling = asyncHandler(async (req, res) => {
  const data = await adminService.adminGetPatentFiling(req.params.id);
  res.status(200).json({ data });
});

const updatePatentFilingStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const data = await adminService.adminUpdatePatentFilingStatus(req.params.id, status, adminNote);
  res.status(200).json({ data });
});

const assignAgentToPatent = asyncHandler(async (req, res) => {
  const { agentId } = req.body;
  const data = await adminService.adminAssignAgentToPatent(req.params.id, agentId);
  res.status(200).json({ data });
});

const setPatentEstimation = asyncHandler(async (req, res) => {
  const { estimation } = req.body;
  const data = await adminService.adminSetPatentEstimation(req.params.id, estimation);
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Non-Patent Filings
// ─────────────────────────────────────────────

const listNonPatentFilings = asyncHandler(async (req, res) => {
  const data = await adminService.adminListNonPatentFilings({ query: req.query });
  res.status(200).json({ data });
});

const getNonPatentFiling = asyncHandler(async (req, res) => {
  const data = await adminService.adminGetNonPatentFiling(req.params.id);
  res.status(200).json({ data });
});

const updateNonPatentFilingStatus = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body;
  const data = await adminService.adminUpdateNonPatentFilingStatus(req.params.id, status, adminNote);
  res.status(200).json({ data });
});

const assignAgentToNonPatent = asyncHandler(async (req, res) => {
  const { agentId } = req.body;
  const data = await adminService.adminAssignAgentToNonPatent(req.params.id, agentId);
  res.status(200).json({ data });
});

const setNonPatentEstimation = asyncHandler(async (req, res) => {
  const { estimation } = req.body;
  const data = await adminService.adminSetNonPatentEstimation(req.params.id, estimation);
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Agent Workload
// ─────────────────────────────────────────────

const getAgentWorkload = asyncHandler(async (req, res) => {
  const data = await adminService.getAgentWorkload();
  res.status(200).json({ data });
});

module.exports = {
  getDashboardStats,
  listUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  createAdminUser,
  listPatentFilings,
  getPatentFiling,
  updatePatentFilingStatus,
  assignAgentToPatent,
  setPatentEstimation,
  listNonPatentFilings,
  getNonPatentFiling,
  updateNonPatentFilingStatus,
  assignAgentToNonPatent,
  setNonPatentEstimation,
  getAgentWorkload,
};
