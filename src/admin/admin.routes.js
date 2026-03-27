const express = require('express');
const validate = require('../utils/validate');
const { protect, authorize } = require('../auth/auth.middleware');
const adminController = require('./admin.controller');
const { assignAgentSchema, updateAdminDecisionSchema } = require('./admin.validation');

const router = express.Router();

router.use(protect, authorize('admin'));

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard metrics and filings table data
 *     tags: [Admin]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [patent, nonPatent]
 *       - in: query
 *         name: unassigned
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Dashboard metrics with paginated filings list
 */
router.get('/admin/dashboard', adminController.getAdminDashboard);

/**
 * @swagger
 * /api/admin/filings:
 *   get:
 *     summary: List all filings for admin monitoring
 *     tags: [Admin]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [patent, nonPatent]
 *       - in: query
 *         name: unassigned
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Paginated filings list
 */
router.get('/admin/filings', adminController.listAdminFilings);

/**
 * @swagger
 * /api/admin/unassigned:
 *   get:
 *     summary: List unassigned active filings for quick assignment
 *     tags: [Admin]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [patent, nonPatent]
 *     responses:
 *       200:
 *         description: Paginated unassigned filings list
 */
router.get('/admin/unassigned', adminController.listUnassignedFilings);

/**
 * @swagger
 * /api/admin/assignments:
 *   get:
 *     summary: List assigned active filings for assignment management
 *     tags: [Admin]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [patent, nonPatent]
 *     responses:
 *       200:
 *         description: Paginated assigned filings list
 */
router.get('/admin/assignments', adminController.listAssignments);

/**
 * @swagger
 * /api/admin/decisions:
 *   get:
 *     summary: List decided filings
 *     tags: [Admin]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [APPROVED, REJECTED]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [patent, nonPatent]
 *     responses:
 *       200:
 *         description: Paginated decided filings list
 */
router.get('/admin/decisions', adminController.listDecisions);

/**
 * @swagger
 * /api/admin/filings/{id}/assign:
 *   patch:
 *     summary: Assign an agent to a filing
 *     tags: [Admin]
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
 *               - agentId
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Filing assigned to agent
 *       404:
 *         description: Filing or agent not found
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/admin/filings/:id/assign',
  validate(assignAgentSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  adminController.assignAgentToFiling
);

/**
 * @swagger
 * /api/admin/filings/{id}/reassign:
 *   patch:
 *     summary: Reassign a filing to a different agent
 *     tags: [Admin]
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
 *               - agentId
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Filing reassigned
 *       404:
 *         description: Filing or agent not found
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/admin/filings/:id/reassign',
  validate(assignAgentSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  adminController.reassignAgentToFiling
);

/**
 * @swagger
 * /api/admin/filings/{id}/status:
 *   patch:
 *     summary: Approve or reject a filing
 *     tags: [Admin]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *     responses:
 *       200:
 *         description: Filing status updated
 *       404:
 *         description: Filing not found
 *       422:
 *         description: Validation failed
 */
router.patch(
  '/admin/filings/:id/status',
  validate(updateAdminDecisionSchema, { statusCode: 422, code: 'VALIDATION_ERROR' }),
  adminController.setFilingDecision
);

/**
 * @swagger
 * /api/admin/agents:
 *   get:
 *     summary: List all assignable agents
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent list
 */
router.get('/admin/agents', adminController.listAgents);

/**
 * @swagger
 * /api/admin/clients:
 *   get:
 *     summary: List all client users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client users list
 */
router.get('/admin/clients', adminController.listClients);

/**
 * @swagger
 * /api/admin/profile:
 *   get:
 *     summary: Get profile and summary details of logged-in admin
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile with summary counters
 *       404:
 *         description: Admin not found
 */
router.get('/admin/profile', adminController.getAdminProfile);

module.exports = router;
