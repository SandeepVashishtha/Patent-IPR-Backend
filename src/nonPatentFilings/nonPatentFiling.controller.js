const asyncHandler = require('../utils/asyncHandler');
const nonPatentFilingService = require('./nonPatentFiling.service');
const { NON_PATENT_TYPE_CONFIG } = require('./nonPatentFiling.constants');
const ApiError = require('../utils/apiError');
const { parseListFilingsQuery } = require('./nonPatentFiling.validation');
const { NON_PATENT_TYPES } = require('./nonPatentFiling.constants');

const buildSummaryResponse = (filingType, filing) => {
  const config = NON_PATENT_TYPE_CONFIG[filingType];
  return {
    id: filing.id,
    referenceNumber: filing.referenceNumber,
    [config.idField]: filing[config.idField],
    status: filing.status,
    submittedAt: filing.submittedAt,
  };
};

const buildNonPatentFilingController = (filingType) => {
  const config = NON_PATENT_TYPE_CONFIG[filingType];

  const createFiling = asyncHandler(async (req, res) => {
    const filing = await nonPatentFilingService.createNonPatentFiling({
      user: req.user,
      payload: req.body,
      filingType,
    });

    res.status(201).json({
      data: buildSummaryResponse(filingType, filing),
      message: `${config.label} created successfully`,
    });
  });

  const listFilings = asyncHandler(async (req, res) => {
    const query = parseListFilingsQuery(req.query);
    const data = await nonPatentFilingService.listNonPatentFilings({
      user: req.user,
      query,
      filingType,
    });
    res.status(200).json({ data });
  });

  const getFilingByReference = asyncHandler(async (req, res) => {
    const data = await nonPatentFilingService.getNonPatentFilingByReference({
      user: req.user,
      filingType,
      referenceNumber: req.params.referenceNumber,
    });
    res.status(200).json({ data });
  });

  const updateDraftFiling = asyncHandler(async (req, res) => {
    const data = await nonPatentFilingService.updateDraftNonPatentFiling({
      user: req.user,
      filingType,
      id: req.params.id,
      payload: req.body,
    });
    res.status(200).json({
      data,
      message: `${config.label} updated successfully`,
    });
  });

  const uploadDocument = asyncHandler(async (req, res) => {
    const data = await nonPatentFilingService.attachDocument({
      user: req.user,
      filingType,
      id: req.params.id,
      documentUrl: req.body[config.documentField],
    });
    res.status(200).json({
      data,
      message: 'Document attached successfully',
    });
  });

  return {
    createFiling,
    listFilings,
    getFilingByReference,
    updateDraftFiling,
    uploadDocument,
  };
};

const parseOptionalFilingType = (value) => {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return undefined;
  }

  const normalized = String(value).trim().toUpperCase();
  const validValues = Object.values(NON_PATENT_TYPES);

  if (!validValues.includes(normalized)) {
    throw new ApiError(
      422,
      'Validation failed',
      [
        {
          field: 'type',
          message: `type must be one of ${validValues.join(', ')}`,
        },
      ],
      'VALIDATION_ERROR'
    );
  }

  return normalized;
};

const listAllNonPatentFilings = asyncHandler(async (req, res) => {
  const query = parseListFilingsQuery(req.query);
  const filingType = parseOptionalFilingType(req.query.type);

  const data = await nonPatentFilingService.listNonPatentFilings({
    user: req.user,
    query,
    filingType,
  });

  res.status(200).json({ data });
});

const getAnyNonPatentFilingByReference = asyncHandler(async (req, res) => {
  const filingType = parseOptionalFilingType(req.query.type);

  const data = await nonPatentFilingService.getNonPatentFilingByReference({
    user: req.user,
    referenceNumber: req.params.referenceNumber,
    filingType,
  });

  res.status(200).json({ data });
});

module.exports = {
  buildNonPatentFilingController,
  listAllNonPatentFilings,
  getAnyNonPatentFilingByReference,
};
