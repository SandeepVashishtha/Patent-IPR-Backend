const express = require('express');
const validate = require('../utils/validate');
const { protect } = require('../auth/auth.middleware');
const { NON_PATENT_TYPES } = require('./nonPatentFiling.constants');
const { buildNonPatentFilingController } = require('./nonPatentFiling.controller');
const {
  getCreateFilingSchema,
  getUpdateFilingSchema,
  getUploadDocumentSchema,
} = require('./nonPatentFiling.validation');

const router = express.Router();

router.use(protect);

const trademarkController = buildNonPatentFilingController(NON_PATENT_TYPES.TRADEMARK);
const copyrightController = buildNonPatentFilingController(NON_PATENT_TYPES.COPYRIGHT);
const designController = buildNonPatentFilingController(NON_PATENT_TYPES.DESIGN);

router.post(
  '/trademark-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.createFiling
);
router.get('/client/trademark-filings', trademarkController.listFilings);
router.get('/trademark-filings/:referenceNumber', trademarkController.getFilingByReference);
router.patch(
  '/trademark-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.updateDraftFiling
);
router.post(
  '/trademark-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.uploadDocument
);

router.post(
  '/copyright-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.createFiling
);
router.get('/client/copyright-filings', copyrightController.listFilings);
router.get('/copyright-filings/:referenceNumber', copyrightController.getFilingByReference);
router.patch(
  '/copyright-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.updateDraftFiling
);
router.post(
  '/copyright-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.uploadDocument
);

router.post(
  '/design-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.createFiling
);
router.get('/client/design-filings', designController.listFilings);
router.get('/design-filings/:referenceNumber', designController.getFilingByReference);
router.patch(
  '/design-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.updateDraftFiling
);
router.post(
  '/design-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.uploadDocument
);

module.exports = router;
