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

/**
 * @swagger
 * /api/trademark-filings:
 *   post:
 *     summary: Create a trademark filing draft or submit directly
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trademarkName
 *               - classOfTrademark
 *               - descriptionGoodsServices
 *               - usageStatus
 *               - dateOfFirstUse
 *               - applicantName
 *               - applicantType
 *               - address
 *               - trademarkLogo
 *             properties:
 *               trademarkName:
 *                 type: string
 *               classOfTrademark:
 *                 type: string
 *               descriptionGoodsServices:
 *                 type: string
 *               usageStatus:
 *                 type: string
 *               dateOfFirstUse:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               applicantType:
 *                 type: string
 *               address:
 *                 type: string
 *               trademarkLogo:
 *                 type: string
 *                 format: uri
 *               saveAsDraft:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Trademark filing created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/trademark-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.createFiling
);

/**
 * @swagger
 * /api/client/trademark-filings:
 *   get:
 *     summary: List trademark filings with pagination and optional status filter
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: submittedAt,desc
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Paginated trademark filings
 *       422:
 *         description: Query validation failed
 */
router.get('/client/trademark-filings', trademarkController.listFilings);

/**
 * @swagger
 * /api/trademark-filings/{referenceNumber}:
 *   get:
 *     summary: Get trademark filing detail by reference number
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referenceNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trademark filing detail
 *       404:
 *         description: Filing not found
 */
router.get('/trademark-filings/:referenceNumber', trademarkController.getFilingByReference);

/**
 * @swagger
 * /api/trademark-filings/{id}:
 *   patch:
 *     summary: Update draft trademark filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               trademarkName:
 *                 type: string
 *               classOfTrademark:
 *                 type: string
 *               descriptionGoodsServices:
 *                 type: string
 *               usageStatus:
 *                 type: string
 *               dateOfFirstUse:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               applicantType:
 *                 type: string
 *               address:
 *                 type: string
 *               trademarkLogo:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Trademark filing updated
 *       409:
 *         description: Filing is not in DRAFT status
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/trademark-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.updateDraftFiling
);

/**
 * @swagger
 * /api/trademark-filings/{id}/documents:
 *   post:
 *     summary: Attach trademark logo URL to trademark filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - trademarkLogo
 *             properties:
 *               trademarkLogo:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Trademark document URL attached
 *       422:
 *         description: Validation failed
 */
router.post(
  '/trademark-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.TRADEMARK), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  trademarkController.uploadDocument
);

/**
 * @swagger
 * /api/copyright-filings:
 *   post:
 *     summary: Create a copyright filing draft or submit directly
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workType
 *               - titleOfWork
 *               - authorDetails
 *               - yearOfCreation
 *               - applicantName
 *               - address
 *               - workFile
 *             properties:
 *               workType:
 *                 type: string
 *               titleOfWork:
 *                 type: string
 *               authorDetails:
 *                 oneOf:
 *                   - type: string
 *                   - type: object
 *                     additionalProperties: true
 *               yearOfCreation:
 *                 type: integer
 *               applicantName:
 *                 type: string
 *               address:
 *                 type: string
 *               workFile:
 *                 type: string
 *                 format: uri
 *               saveAsDraft:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Copyright filing created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/copyright-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.createFiling
);

/**
 * @swagger
 * /api/client/copyright-filings:
 *   get:
 *     summary: List copyright filings with pagination and optional status filter
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: submittedAt,desc
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Paginated copyright filings
 *       422:
 *         description: Query validation failed
 */
router.get('/client/copyright-filings', copyrightController.listFilings);

/**
 * @swagger
 * /api/copyright-filings/{referenceNumber}:
 *   get:
 *     summary: Get copyright filing detail by reference number
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referenceNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Copyright filing detail
 *       404:
 *         description: Filing not found
 */
router.get('/copyright-filings/:referenceNumber', copyrightController.getFilingByReference);

/**
 * @swagger
 * /api/copyright-filings/{id}:
 *   patch:
 *     summary: Update draft copyright filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workType:
 *                 type: string
 *               titleOfWork:
 *                 type: string
 *               authorDetails:
 *                 oneOf:
 *                   - type: string
 *                   - type: object
 *                     additionalProperties: true
 *               yearOfCreation:
 *                 type: integer
 *               applicantName:
 *                 type: string
 *               address:
 *                 type: string
 *               workFile:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Copyright filing updated
 *       409:
 *         description: Filing is not in DRAFT status
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/copyright-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.updateDraftFiling
);

/**
 * @swagger
 * /api/copyright-filings/{id}/documents:
 *   post:
 *     summary: Attach work file URL to copyright filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workFile
 *             properties:
 *               workFile:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Copyright document URL attached
 *       422:
 *         description: Validation failed
 */
router.post(
  '/copyright-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.COPYRIGHT), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  copyrightController.uploadDocument
);

/**
 * @swagger
 * /api/design-filings:
 *   post:
 *     summary: Create a design filing draft or submit directly
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - articleName
 *               - locarnoClass
 *               - briefDescription
 *               - applicantName
 *               - address
 *               - representationOfDesign
 *             properties:
 *               articleName:
 *                 type: string
 *               locarnoClass:
 *                 type: string
 *               briefDescription:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               address:
 *                 type: string
 *               representationOfDesign:
 *                 type: string
 *                 format: uri
 *               saveAsDraft:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Design filing created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/design-filings',
  validate(getCreateFilingSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.createFiling
);

/**
 * @swagger
 * /api/client/design-filings:
 *   get:
 *     summary: List design filings with pagination and optional status filter
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: submittedAt,desc
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Paginated design filings
 *       422:
 *         description: Query validation failed
 */
router.get('/client/design-filings', designController.listFilings);

/**
 * @swagger
 * /api/design-filings/{referenceNumber}:
 *   get:
 *     summary: Get design filing detail by reference number
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: referenceNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Design filing detail
 *       404:
 *         description: Filing not found
 */
router.get('/design-filings/:referenceNumber', designController.getFilingByReference);

/**
 * @swagger
 * /api/design-filings/{id}:
 *   patch:
 *     summary: Update draft design filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleName:
 *                 type: string
 *               locarnoClass:
 *                 type: string
 *               briefDescription:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               address:
 *                 type: string
 *               representationOfDesign:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Design filing updated
 *       409:
 *         description: Filing is not in DRAFT status
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/design-filings/:id',
  validate(getUpdateFilingSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.updateDraftFiling
);

/**
 * @swagger
 * /api/design-filings/{id}/documents:
 *   post:
 *     summary: Attach representation URL to design filing
 *     tags: [Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - representationOfDesign
 *             properties:
 *               representationOfDesign:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Design document URL attached
 *       422:
 *         description: Validation failed
 */
router.post(
  '/design-filings/:id/documents',
  validate(getUploadDocumentSchema(NON_PATENT_TYPES.DESIGN), {
    statusCode: 422,
    code: 'VALIDATION_ERROR',
  }),
  designController.uploadDocument
);

module.exports = router;
