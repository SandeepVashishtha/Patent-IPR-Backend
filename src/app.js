const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const authRoutes = require('./auth/auth.routes');
const patentFilingRoutes = require('./patentFilings/patentFiling.routes');
const nonPatentFilingRoutes = require('./nonPatentFilings/nonPatentFiling.routes');
const adminRoutes = require('./admin/admin.routes');
const agentRoutes = require('./agent/agent.routes');
const { notFound, errorHandler } = require('./utils/errorHandler');

const app = express();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));
app.use('/api', apiLimiter);

/**
 * @swagger
 * /:
 *   get:
 *     summary: Root status endpoint
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Service is running
 */
app.get('/', (req, res) => {
  res.status(200).send('IPR Backend Running ');
});

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', patentFilingRoutes);
app.use('/api', nonPatentFilingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
