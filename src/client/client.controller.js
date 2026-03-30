const asyncHandler = require('../utils/asyncHandler');
const clientService = require('./client.service');

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

const getProfile = asyncHandler(async (req, res) => {
  const data = await clientService.getProfile(req.user.id);
  res.status(200).json({ data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const data = await clientService.updateProfile(req.user.id, { name, email });
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Password
// ─────────────────────────────────────────────

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const data = await clientService.changePassword(req.user.id, { currentPassword, newPassword });
  res.status(200).json({ data });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const data = await clientService.forgotPassword({ email, newPassword });
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Patent Filings
// ─────────────────────────────────────────────

const listPatentFilings = asyncHandler(async (req, res) => {
  const data = await clientService.clientListPatentFilings({
    userId: req.user.id,
    query: req.query,
  });
  res.status(200).json({ data });
});

const getPatentFiling = asyncHandler(async (req, res) => {
  const data = await clientService.clientGetPatentFiling(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const deletePatentFiling = asyncHandler(async (req, res) => {
  await clientService.clientDeletePatentFiling(req.user.id, req.params.id);
  res.status(200).json({ message: 'Patent filing deleted successfully' });
});

// ─────────────────────────────────────────────
// Non-Patent Filings
// ─────────────────────────────────────────────

const listNonPatentFilings = asyncHandler(async (req, res) => {
  const data = await clientService.clientListNonPatentFilings({
    userId: req.user.id,
    query: req.query,
  });
  res.status(200).json({ data });
});

const getNonPatentFiling = asyncHandler(async (req, res) => {
  const data = await clientService.clientGetNonPatentFiling(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const deleteNonPatentFiling = asyncHandler(async (req, res) => {
  await clientService.clientDeleteNonPatentFiling(req.user.id, req.params.id);
  res.status(200).json({ message: 'Non-patent filing deleted successfully' });
});

// ─────────────────────────────────────────────
// Payment Info (Admin-set estimation)
// ─────────────────────────────────────────────

const getPatentPaymentInfo = asyncHandler(async (req, res) => {
  const data = await clientService.getPatentPaymentInfo(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const getNonPatentPaymentInfo = asyncHandler(async (req, res) => {
  const data = await clientService.getNonPatentPaymentInfo(req.user.id, req.params.id);
  res.status(200).json({ data });
});

// ─────────────────────────────────────────────
// Assigned Agent
// ─────────────────────────────────────────────

const getPatentAssignedAgent = asyncHandler(async (req, res) => {
  const data = await clientService.getPatentAssignedAgent(req.user.id, req.params.id);
  res.status(200).json({ data });
});

const getNonPatentAssignedAgent = asyncHandler(async (req, res) => {
  const data = await clientService.getNonPatentAssignedAgent(req.user.id, req.params.id);
  res.status(200).json({ data });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  listPatentFilings,
  getPatentFiling,
  deletePatentFiling,
  listNonPatentFilings,
  getNonPatentFiling,
  deleteNonPatentFiling,
  getPatentPaymentInfo,
  getNonPatentPaymentInfo,
  getPatentAssignedAgent,
  getNonPatentAssignedAgent,
};
