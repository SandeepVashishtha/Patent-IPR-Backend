const express = require('express');
const adminController = require('./admin.controller');
const { protect, authorize } = require('../auth/auth.middleware');

const router = express.Router();

// All admin routes are protected — must be logged-in AND have role 'admin'
router.use(protect, authorize('admin'));

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get admin dashboard statistics
 *     description: Returns counts of users, patent filings, and non-patent filings grouped by status, plus recent activity.
 *     tags: [Admin - Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         clients: { type: integer }
 *                         agents: { type: integer }
 *                     patentFilings:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         byStatus: { type: object }
 *                     nonPatentFilings:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         byStatus: { type: object }
 *                     recentActivity:
 *                       type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – admin role required
 */
router.get('/dashboard', adminController.getDashboardStats);

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (paginated)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, agent, admin]
 *         description: Filter by role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email (case-insensitive)
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
 *           example: createdAt,desc
 *         description: "Sort format: field,direction (e.g. name,asc)"
 *     responses:
 *       200:
 *         description: Paginated list of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/users', adminController.listUsers);

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new admin or agent user
 *     description: Allows admins to create users with role 'admin' or 'agent'. Regular clients register through the public endpoint.
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               role:
 *                 type: string
 *                 enum: [admin, agent]
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
router.post('/users', adminController.createAdminUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Admin - Users]
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
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get('/users/:id', adminController.getUserById);

/**
 * @swagger
 * /api/admin/users/{id}/role:
 *   patch:
 *     summary: Update a user's role
 *     tags: [Admin - Users]
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
 *             required: [role]
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [client, agent, admin]
 *     responses:
 *       200:
 *         description: Role updated
 *       400:
 *         description: Invalid role
 *       404:
 *         description: User not found
 */
router.patch('/users/:id/role', adminController.updateUserRole);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Permanently deletes a user. Admins cannot delete themselves.
 *     tags: [Admin - Users]
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
 *         description: User deleted
 *       400:
 *         description: Self-deletion not allowed
 *       404:
 *         description: User not found
 */
router.delete('/users/:id', adminController.deleteUser);

// ─────────────────────────────────────────────────────────────
// PATENT FILINGS
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/patent-filings:
 *   get:
 *     summary: List all patent filings (admin view, paginated)
 *     tags: [Admin - Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED, IN_REVIEW]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by submitting user ID
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
 *           example: submittedAt,desc
 *     responses:
 *       200:
 *         description: Paginated patent filings with client and agent details
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/patent-filings', adminController.listPatentFilings);

/**
 * @swagger
 * /api/admin/patent-filings/{id}:
 *   get:
 *     summary: Get a patent filing by ID (admin, full details)
 *     tags: [Admin - Patent Filings]
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
 *         description: Full patent filing detail including client and agent info
 *       404:
 *         description: Not found
 */
router.get('/patent-filings/:id', adminController.getPatentFiling);

/**
 * @swagger
 * /api/admin/patent-filings/{id}/status:
 *   patch:
 *     summary: Update patent filing status
 *     description: Admin can move a non-DRAFT filing to PENDING, IN_REVIEW, APPROVED, or REJECTED.
 *     tags: [Admin - Patent Filings]
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
 *                 enum: [PENDING, IN_REVIEW, APPROVED, REJECTED]
 *               adminNote:
 *                 type: string
 *                 description: Optional note or feedback for the client
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Filing not found
 *       409:
 *         description: Cannot update a DRAFT filing
 */
router.patch('/patent-filings/:id/status', adminController.updatePatentFilingStatus);

/**
 * @swagger
 * /api/admin/patent-filings/{id}/assign-agent:
 *   patch:
 *     summary: Assign an agent to a patent filing
 *     tags: [Admin - Patent Filings]
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
 *             required: [agentId]
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the user with role 'agent'
 *     responses:
 *       200:
 *         description: Agent assigned
 *       404:
 *         description: Filing or agent not found
 */
router.patch('/patent-filings/:id/assign-agent', adminController.assignAgentToPatent);

/**
 * @swagger
 * /api/admin/patent-filings/{id}/estimation:
 *   patch:
 *     summary: Set cost estimation for a patent filing
 *     tags: [Admin - Patent Filings]
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
 *             required: [estimation]
 *             properties:
 *               estimation:
 *                 type: number
 *                 minimum: 0
 *                 description: Estimated cost in your currency
 *     responses:
 *       200:
 *         description: Estimation set
 *       400:
 *         description: Invalid estimation value
 *       404:
 *         description: Filing not found
 */
router.patch('/patent-filings/:id/estimation', adminController.setPatentEstimation);

// ─────────────────────────────────────────────────────────────
// NON-PATENT FILINGS
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/non-patent-filings:
 *   get:
 *     summary: List all non-patent filings (admin view, paginated)
 *     tags: [Admin - Non-Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED, IN_REVIEW]
 *       - in: query
 *         name: filingType
 *         schema:
 *           type: string
 *           enum: [TRADEMARK, COPYRIGHT, DESIGN]
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
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
 *           example: submittedAt,desc
 *     responses:
 *       200:
 *         description: Paginated non-patent filings
 */
router.get('/non-patent-filings', adminController.listNonPatentFilings);

/**
 * @swagger
 * /api/admin/non-patent-filings/{id}:
 *   get:
 *     summary: Get a non-patent filing by ID (admin, full details)
 *     tags: [Admin - Non-Patent Filings]
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
 *         description: Full non-patent filing detail
 *       404:
 *         description: Not found
 */
router.get('/non-patent-filings/:id', adminController.getNonPatentFiling);

/**
 * @swagger
 * /api/admin/non-patent-filings/{id}/status:
 *   patch:
 *     summary: Update non-patent filing status
 *     tags: [Admin - Non-Patent Filings]
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
 *                 enum: [PENDING, IN_REVIEW, APPROVED, REJECTED]
 *               adminNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Not found
 *       409:
 *         description: Cannot update DRAFT
 */
router.patch('/non-patent-filings/:id/status', adminController.updateNonPatentFilingStatus);

/**
 * @swagger
 * /api/admin/non-patent-filings/{id}/assign-agent:
 *   patch:
 *     summary: Assign an agent to a non-patent filing
 *     tags: [Admin - Non-Patent Filings]
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
 *             required: [agentId]
 *             properties:
 *               agentId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Agent assigned
 *       404:
 *         description: Filing or agent not found
 */
router.patch('/non-patent-filings/:id/assign-agent', adminController.assignAgentToNonPatent);

// ─────────────────────────────────────────────────────────────
// AGENT WORKLOAD
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/agents/workload:
 *   get:
 *     summary: Get workload summary for all agents
 *     description: Returns each agent with counts of assigned patent and non-patent filings.
 *     tags: [Admin - Agents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Agent workload list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string, format: uuid }
 *                       name: { type: string }
 *                       email: { type: string }
 *                       patent_filings_count: { type: integer }
 *                       non_patent_filings_count: { type: integer }
 *                       total_filings: { type: integer }
 */
router.get('/agents/workload', adminController.getAgentWorkload);

module.exports = router;
