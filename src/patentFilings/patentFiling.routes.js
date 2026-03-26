const express = require('express');
const validate = require('../utils/validate');
const { protect } = require('../auth/auth.middleware');
const patentFilingController = require('./patentFiling.controller');
const {
  createPatentFilingSchema,
  updatePatentFilingSchema,
  uploadDocumentSchema,
  presignRequestSchema,
} = require('./patentFiling.validation');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * /api/patent-filings:
 *   post:
 *     summary: Create a patent filing draft or submit directly
 *     tags: [Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - fieldOfInvention
 *               - abstractText
 *               - applicantName
 *               - applicantEmail
 *               - applicantMobile
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 300
 *               fieldOfInvention:
 *                 type: string
 *               fieldOfInventionOther:
 *                 type: string
 *               abstractText:
 *                 type: string
 *                 maxLength: 5000
 *               applicantName:
 *                 type: string
 *               applicantEmail:
 *                 type: string
 *                 format: email
 *               applicantMobile:
 *                 type: string
 *               supportingDocumentUrl:
 *                 type: string
 *                 format: uri
 *               saveAsDraft:
 *                 type: boolean
 *                 default: false
 *               estimation:
 *                 type: object
 *                 properties:
 *                   total:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   selections:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       201:
 *         description: Filing created
 *       422:
 *         description: Validation failed
 */
router.post(
  '/patent-filings',
  validate(createPatentFilingSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  patentFilingController.createPatentFiling
);

/**
 * @swagger
 * /api/patent-filings/{id}/submit:
 *   post:
 *     summary: Submit a DRAFT patent filing
 *     tags: [Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Filing submitted
 *       404:
 *         description: Filing not found
 *       409:
 *         description: Only draft filing can be submitted
 */
router.post('/patent-filings/:id/submit', patentFilingController.submitPatentFiling);

/**
 * @swagger
 * /api/patent-filings/{id}:
 *   patch:
 *     summary: Update draft filing fields
 *     tags: [Patent Filings]
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
 *               title:
 *                 type: string
 *               fieldOfInvention:
 *                 type: string
 *               fieldOfInventionOther:
 *                 type: string
 *               abstractText:
 *                 type: string
 *               applicantName:
 *                 type: string
 *               applicantEmail:
 *                 type: string
 *                 format: email
 *               applicantMobile:
 *                 type: string
 *               supportingDocumentUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Filing updated
 *       409:
 *         description: Filing is not in DRAFT status
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/patent-filings/:id',
  validate(updatePatentFilingSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  patentFilingController.updateDraftPatentFiling
);

/**
 * @swagger
 * /api/patent-filings/{referenceNumber}:
 *   get:
 *     summary: Get filing detail by reference number
 *     tags: [Patent Filings]
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
 *         description: Filing detail
 *       404:
 *         description: Filing not found
 */
router.get('/patent-filings/:referenceNumber', patentFilingController.getPatentFilingByReference);

/**
 * @swagger
 * /api/patent-filings/{id}/documents:
 *   post:
 *     summary: Attach supporting document URL to filing
 *     tags: [Patent Filings]
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
 *               - supportingDocumentUrl
 *             properties:
 *               supportingDocumentUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Document URL attached
 *       422:
 *         description: Validation failed
 */
router.post(
  '/patent-filings/:id/documents',
  validate(uploadDocumentSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  patentFilingController.uploadSupportingDocument
);

/**
 * @swagger
 * /api/client/patents:
 *   get:
 *     summary: List patent filings with pagination and optional status filter
 *     tags: [Patent Filings]
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
 *         description: Paginated filing list
 *       422:
 *         description: Query validation failed
 */
router.get('/client/patents', patentFilingController.listPatentFilings);

/**
 * @swagger
 * /api/files/presign:
 *   post:
 *     summary: Generate a pre-signed upload URL (mock implementation)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Pre-signed upload payload
 */
router.post(
  '/files/presign',
  validate(presignRequestSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  patentFilingController.createPresignedUpload
);

/**
 * @swagger
 * /api/v1/patents/submit:
 *   post:
 *     summary: Legacy patent submit endpoint for frontend compatibility
 *     tags: [Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: title
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fieldOfInvention
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: fieldOfInventionOther
 *         schema:
 *           type: string
 *       - in: query
 *         name: abstract
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: applicantName
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: applicantEmail
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *       - in: query
 *         name: applicantMobile
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - supportingDocument
 *             properties:
 *               supportingDocument:
 *                 type: string
 *                 format: uri
 *     responses:
 *       201:
 *         description: Filing submitted
 *       422:
 *         description: Validation failed
 */
router.post('/v1/patents/submit', patentFilingController.submitLegacyPatent);

/**
 * @swagger
 * /api/v1/patents/user/filings:
 *   get:
 *     summary: Legacy list endpoint for frontend compatibility
 *     tags: [Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Filing list
 */
router.get('/v1/patents/user/filings', patentFilingController.listPatentFilings);

/**
 * @swagger
 * /api/v1/patents/{referenceNumber}:
 *   get:
 *     summary: Legacy detail endpoint for frontend compatibility
 *     tags: [Patent Filings]
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
 *         description: Filing detail
 *       404:
 *         description: Filing not found
 */
router.get('/v1/patents/:referenceNumber', patentFilingController.getPatentFilingByReference);

module.exports = router;
