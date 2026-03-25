require('dotenv').config();

const app = require('./src/app');
const { checkDbConnection } = require('./src/config/db');

const PORT = process.env.PORT || 5000;
let server;

const ensureRequiredConfig = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('Missing required environment variable: JWT_SECRET');
  }

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasPgConfig =
    Boolean(process.env.PGHOST) &&
    Boolean(process.env.PGDATABASE) &&
    Boolean(process.env.PGUSER) &&
    Boolean(process.env.PGPASSWORD);

  if (!hasDatabaseUrl && !hasPgConfig) {
    throw new Error('Missing DB config. Set DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD.');
  }
};

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.stack || error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  if (server) {
    server.close(() => process.exit(1));
    return;
  }
  process.exit(1);
});

const startServer = async () => {
  try {
    ensureRequiredConfig();
    await checkDbConnection();
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
