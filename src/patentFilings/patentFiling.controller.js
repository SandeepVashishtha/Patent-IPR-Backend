const asyncHandler = require('../utils/asyncHandler');
const crypto = require('crypto');
const patentFilingService = require('./patentFiling.service');
const {
  parseListFilingsQuery,
  parseLegacySubmitPayload,
} = require('./patentFiling.validation');

const createPatentFiling = asyncHandler(async (req, res) => {
  const filing = await patentFilingService.createPatentFiling({
    user: req.user,
    payload: req.body,
  });

  res.status(201).json({
    data: {
      id: filing.id,
      referenceNumber: filing.referenceNumber,
      patentId: filing.patentId,
      status: filing.status,
      submittedAt: filing.submittedAt,
    },
  });
});

const submitPatentFiling = asyncHandler(async (req, res) => {
  const filing = await patentFilingService.submitPatentFiling({
    user: req.user,
    id: req.params.id,
  });

  res.status(200).json({
    data: {
      id: filing.id,
      referenceNumber: filing.referenceNumber,
      patentId: filing.patentId,
      status: filing.status,
      submittedAt: filing.submittedAt,
    },
  });
});

const listPatentFilings = asyncHandler(async (req, res) => {
  const query = parseListFilingsQuery(req.query);
  const data = await patentFilingService.listPatentFilings({
    user: req.user,
    query,
  });
  res.status(200).json({ data });
});

const getPatentFilingByReference = asyncHandler(async (req, res) => {
  const data = await patentFilingService.getPatentFilingByReference({
    user: req.user,
    referenceNumber: req.params.referenceNumber,
  });
  res.status(200).json({ data });
});

const updateDraftPatentFiling = asyncHandler(async (req, res) => {
  const data = await patentFilingService.updateDraftPatentFiling({
    user: req.user,
    id: req.params.id,
    payload: req.body,
  });
  res.status(200).json({ data });
});

const uploadSupportingDocument = asyncHandler(async (req, res) => {
  const data = await patentFilingService.attachSupportingDocument({
    user: req.user,
    id: req.params.id,
    supportingDocumentUrl: req.body.supportingDocumentUrl,
  });
  res.status(200).json({ data });
});

const submitLegacyPatent = asyncHandler(async (req, res) => {
  const payload = parseLegacySubmitPayload(req);
  const filing = await patentFilingService.createPatentFiling({
    user: req.user,
    payload: {
      ...payload,
      saveAsDraft: false,
    },
  });

  res.status(201).json({
    data: {
      id: filing.id,
      referenceNumber: filing.referenceNumber,
      patentId: filing.patentId,
      status: filing.status,
      submittedAt: filing.submittedAt,
    },
  });
});

const createPresignedUpload = asyncHandler(async (req, res) => {
  const safeFileName = String(req.body.fileName || 'supporting-document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 255);

  const fileId = crypto.randomUUID();
  const filePath = `uploads/${req.user.id}/${Date.now()}-${fileId}-${safeFileName}`;
  const fileBaseUrl = process.env.FILE_BASE_URL || 'https://files.example.com';

  res.status(200).json({
    data: {
      uploadUrl: `${fileBaseUrl}/${filePath}?signature=mock-signature&expiresIn=900`,
      fileUrl: `${fileBaseUrl}/${filePath}`,
      expiresIn: 900,
      contentType: req.body.contentType || 'application/octet-stream',
    },
  });
});

module.exports = {
  createPatentFiling,
  submitPatentFiling,
  listPatentFilings,
  getPatentFilingByReference,
  updateDraftPatentFiling,
  uploadSupportingDocument,
  submitLegacyPatent,
  createPresignedUpload,
};
