const asyncHandler = require('../utils/asyncHandler');
const agentService = require('./agent.service');

// ─────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────

const getAgentDashboard = asyncHandler(async (req, res) => {
  const data = await agentService.getAgentDashboard(req.user.id);
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

const getAgentProfile = asyncHandler(async (req, res) => {
  const data = await agentService.getAgentProfile(req.user.id);
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Patent Filings
// ─────────────────────────────────────────────

const listPatentFilings = asyncHandler(async (req, res) => {
  const data = await agentService.agentListPatentFilings({
    agentId: req.user.id,
    query: req.query,
  });
  res.status(200).json({ data });
});

const getPatentFiling = asyncHandler(async (req, res) => {
  const data = await agentService.agentGetPatentFiling(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const updatePatentFilingStatus = asyncHandler(async (req, res) => {
  const { status, agentNote } = req.body;
  const data = await agentService.agentUpdatePatentFilingStatus(
    req.user.id,
    req.params.id,
    status,
    agentNote
  );
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Non-Patent Filings
// ─────────────────────────────────────────────

const listNonPatentFilings = asyncHandler(async (req, res) => {
  const data = await agentService.agentListNonPatentFilings({
    agentId: req.user.id,
    query: req.query,
  });
  res.status(200).json({ data });
});

const getNonPatentFiling = asyncHandler(async (req, res) => {
  const data = await agentService.agentGetNonPatentFiling(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const updateNonPatentFilingStatus = asyncHandler(async (req, res) => {
  const { status, agentNote } = req.body;
  const data = await agentService.agentUpdateNonPatentFilingStatus(
    req.user.id,
    req.params.id,
    status,
    agentNote
  );
  res.status(200).json({ data });
});

module.exports = {
  getAgentDashboard,
  getAgentProfile,
  listPatentFilings,
  getPatentFiling,
  updatePatentFilingStatus,
  listNonPatentFilings,
  getNonPatentFiling,
  updateNonPatentFilingStatus,
};
