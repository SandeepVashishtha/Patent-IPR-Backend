const express = require('express');
const clientController = require('./client.controller');
const { protect, authorize } = require('../auth/auth.middleware');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no auth required)
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/client/forgot-password:
 *   post:
 *     summary: Reset password using email (no token required — extend with OTP for production)
 *     description: |
 *       Allows a user to reset their password by supplying their email and a new password directly.
 *       This is a simplified flow; in production you should add OTP or email verification.
 *     tags: [Client - Profile]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: No account found with that email
 *       400:
 *         description: Validation error
 */
router.post('/forgot-password', clientController.forgotPassword);

// ─────────────────────────────────────────────────────────────
// PROTECTED ROUTES (login required)
// ─────────────────────────────────────────────────────────────

// All routes below require authentication.
router.use(protect, authorize('client', 'admin', 'agent'));

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/client/profile:
 *   get:
 *     summary: Get the current client's profile
 *     tags: [Client - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     role: { type: string }
 *                     created_at: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', clientController.getProfile);

/**
 * @swagger
 * /api/client/profile:
 *   patch:
 *     summary: Update the current client's name and/or email
 *     tags: [Client - Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: At least one field required
 *       409:
 *         description: Email already in use
 */
router.patch('/profile', clientController.updateProfile);

// ─────────────────────────────────────────────────────────────
// PASSWORD
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/client/profile/change-password:
 *   patch:
 *     summary: Change password (requires current password)
 *     tags: [Client - Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password incorrect
 *       400:
 *         description: Validation error
 */
router.patch('/profile/change-password', clientController.changePassword);

// ─────────────────────────────────────────────────────────────
// PATENT FILINGS
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/client/patent-filings:
 *   get:
 *     summary: List the client's patent filings (with estimation & agent info)
 *     tags: [Client - Patent Filings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED, IN_REVIEW]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by title or reference number
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
 *     responses:
 *       200:
 *         description: Paginated patent filings with payment estimation and assigned agent
 */
router.get('/patent-filings', clientController.listPatentFilings);

/**
 * @swagger
 * /api/client/patent-filings/{id}:
 *   get:
 *     summary: Get a specific patent filing (with estimation & agent info)
 *     tags: [Client - Patent Filings]
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
 *         description: Patent filing detail including payment estimation and assigned agent
 *       404:
 *         description: Not found
 */
router.get('/patent-filings/:id', clientController.getPatentFiling);

/**
 * @swagger
 * /api/client/patent-filings/{id}:
 *   delete:
 *     summary: Delete a patent filing (only DRAFT status allowed)
 *     tags: [Client - Patent Filings]
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
 *         description: Patent filing deleted
 *       404:
 *         description: Not found
 *       409:
 *         description: Cannot delete a non-DRAFT filing
 */
router.delete('/patent-filings/:id', clientController.deletePatentFiling);

/**
 * @swagger
 * /api/client/patent-filings/{id}/payment:
 *   get:
 *     summary: Get payment / estimation info for a patent filing (set by admin)
 *     tags: [Client - Patent Filings]
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
 *         description: Estimation and admin note
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     filingId: { type: string }
 *                     referenceNumber: { type: string }
 *                     title: { type: string }
 *                     status: { type: string }
 *                     estimation: { type: number, nullable: true }
 *                     adminNote: { type: string, nullable: true }
 *                     updatedAt: { type: string, format: date-time }
 *       404:
 *         description: Not found
 */
router.get('/patent-filings/:id/payment', clientController.getPatentPaymentInfo);

/**
 * @swagger
 * /api/client/patent-filings/{id}/agent:
 *   get:
 *     summary: Get assigned agent details for a patent filing
 *     tags: [Client - Patent Filings]
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
 *         description: Assigned agent info (or assigned=false if unassigned)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     assigned: { type: boolean }
 *                     assignedAt: { type: string, format: date-time, nullable: true }
 *                     agent:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id: { type: string }
 *                         name: { type: string }
 *                         email: { type: string }
 *                         memberSince: { type: string, format: date-time }
 *       404:
 *         description: Not found
 */
router.get('/patent-filings/:id/agent', clientController.getPatentAssignedAgent);

// ─────────────────────────────────────────────────────────────
// NON-PATENT FILINGS
// ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/client/non-patent-filings:
 *   get:
 *     summary: List the client's non-patent filings (with estimation & agent info)
 *     tags: [Client - Non-Patent Filings]
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
 *         name: search
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Paginated non-patent filings with payment estimation and assigned agent
 */
router.get('/non-patent-filings', clientController.listNonPatentFilings);

/**
 * @swagger
 * /api/client/non-patent-filings/{id}:
 *   get:
 *     summary: Get a specific non-patent filing (with estimation & agent info)
 *     tags: [Client - Non-Patent Filings]
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
 *         description: Not found
 */
router.get('/non-patent-filings/:id', clientController.getNonPatentFiling);

/**
 * @swagger
 * /api/client/non-patent-filings/{id}:
 *   delete:
 *     summary: Delete a non-patent filing (only DRAFT status allowed)
 *     tags: [Client - Non-Patent Filings]
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
 *         description: Non-patent filing deleted
 *       409:
 *         description: Cannot delete a non-DRAFT filing
 */
router.delete('/non-patent-filings/:id', clientController.deleteNonPatentFiling);

/**
 * @swagger
 * /api/client/non-patent-filings/{id}/payment:
 *   get:
 *     summary: Get payment / estimation info for a non-patent filing (set by admin)
 *     tags: [Client - Non-Patent Filings]
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
 *         description: Estimation and admin note
 *       404:
 *         description: Not found
 */
router.get('/non-patent-filings/:id/payment', clientController.getNonPatentPaymentInfo);

/**
 * @swagger
 * /api/client/non-patent-filings/{id}/agent:
 *   get:
 *     summary: Get assigned agent details for a non-patent filing
 *     tags: [Client - Non-Patent Filings]
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
 *         description: Assigned agent info (or assigned=false if unassigned)
 *       404:
 *         description: Not found
 */
router.get('/non-patent-filings/:id/agent', clientController.getNonPatentAssignedAgent);

module.exports = router;
