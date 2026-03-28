const express = require('express');
const agentController = require('./agent.controller');
const { protect, authorize } = require('../auth/auth.middleware');

const router = express.Router();

// All agent routes require a valid JWT and the 'agent' role
router.use(protect, authorize('agent'));

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/dashboard:
 *   get:
 *     summary: Get agent dashboard statistics
 *     description: Returns counts of filings assigned to the logged-in agent grouped by status, plus recent activity.
 *     tags: [Agent - Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignedPatentFilings:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         byStatus: { type: object }
 *                     assignedNonPatentFilings:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         byStatus: { type: object }
 *                     recentActivity:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – agent role required
 */
router.get('/dashboard', agentController.getAgentDashboard);

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/profile:
 *   get:
 *     summary: Get the logged-in agent's profile
 *     tags: [Agent - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/profile', agentController.getAgentProfile);

// ─────────────────────────────────────────────────────────────
// PATENT FILINGS (Assigned to agent)
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/patent-filings:
 *   get:
 *     summary: List patent filings assigned to the logged-in agent (paginated)
 *     tags: [Agent - Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_REVIEW, APPROVED, REJECTED]
 *         description: Filter by filing status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title, reference number, or applicant name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: assignedAt,desc
 *         description: "Sort format: field,direction (e.g. submittedAt,asc)"
 *     responses:
 *       200:
 *         description: Paginated list of assigned patent filings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pageable:
 *                       $ref: '#/components/schemas/Pageable'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/patent-filings', agentController.listPatentFilings);

/**
 * @swagger
 * /api/agent/patent-filings/{id}:
 *   get:
 *     summary: Get a patent filing assigned to the agent by ID
 *     tags: [Agent - Patent Filings]
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
 *         description: Patent filing detail
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Filing not found or not assigned to you
 */
router.get('/patent-filings/:id', agentController.getPatentFiling);

/**
 * @swagger
 * /api/agent/patent-filings/{id}/status:
 *   patch:
 *     summary: Update status of an assigned patent filing
 *     description: Agent can set status to IN_REVIEW, APPROVED, or REJECTED. Cannot update DRAFT filings.
 *     tags: [Agent - Patent Filings]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [IN_REVIEW, APPROVED, REJECTED]
 *               agentNote:
 *                 type: string
 *                 description: Optional note or feedback for the client/admin
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Filing not found or not assigned to you
 *       409:
 *         description: Cannot update a DRAFT filing
 */
router.patch('/patent-filings/:id/status', agentController.updatePatentFilingStatus);

// ─────────────────────────────────────────────────────────────
// NON-PATENT FILINGS (Assigned to agent)
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/agent/non-patent-filings:
 *   get:
 *     summary: List non-patent filings assigned to the logged-in agent (paginated)
 *     tags: [Agent - Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_REVIEW, APPROVED, REJECTED]
 *       - in: query
 *         name: filingType
 *         schema:
 *           type: string
 *           enum: [TRADEMARK, COPYRIGHT, DESIGN]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by reference number or filing identifier
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           example: assignedAt,desc
 *     responses:
 *       200:
 *         description: Paginated list of assigned non-patent filings
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/non-patent-filings', agentController.listNonPatentFilings);

/**
 * @swagger
 * /api/agent/non-patent-filings/{id}:
 *   get:
 *     summary: Get a non-patent filing assigned to the agent by ID
 *     tags: [Agent - Non-Patent Filings]
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
 *         description: Non-patent filing detail
 *       404:
 *         description: Filing not found or not assigned to you
 */
router.get('/non-patent-filings/:id', agentController.getNonPatentFiling);

/**
 * @swagger
 * /api/agent/non-patent-filings/{id}/status:
 *   patch:
 *     summary: Update status of an assigned non-patent filing
 *     description: Agent can set status to IN_REVIEW, APPROVED, or REJECTED. Cannot update DRAFT filings.
 *     tags: [Agent - Non-Patent Filings]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [IN_REVIEW, APPROVED, REJECTED]
 *               agentNote:
 *                 type: string
 *                 description: Optional note or feedback for the client/admin
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Filing not found or not assigned to you
 *       409:
 *         description: Cannot update a DRAFT filing
 */
router.patch('/non-patent-filings/:id/status', agentController.updateNonPatentFilingStatus);

module.exports = router;
