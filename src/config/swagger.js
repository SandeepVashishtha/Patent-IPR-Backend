const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express Backend API',
      version: '1.0.0',
      description: 'Authentication and patent filing API',
    },
    tags: [
      { name: 'Auth', description: 'Authentication and authorization endpoints' },
      { name: 'Patent Filings', description: 'Patent filing lifecycle endpoints' },
      { name: 'Non-Patent Filings', description: 'Trademark, copyright and design filing endpoints' },
      { name: 'Files', description: 'File upload and presign endpoints' },
      { name: 'Admin - Dashboard', description: 'Admin dashboard statistics' },
      { name: 'Admin - Users', description: 'Admin user management (list, create, update role, delete)' },
      { name: 'Admin - Patent Filings', description: 'Admin patent filing management (status, agent assignment, estimation)' },
      { name: 'Admin - Non-Patent Filings', description: 'Admin non-patent filing management (status, agent assignment)' },
      { name: 'Admin - Agents', description: 'Agent workload and management' },
      { name: 'Agent - Dashboard', description: 'Agent dashboard and summary statistics' },
      { name: 'Agent - Profile', description: 'Agent profile endpoints' },
      { name: 'Agent - Patent Filings', description: 'Agent view and status management of assigned patent filings' },
      { name: 'Agent - Non-Patent Filings', description: 'Agent view and status management of assigned non-patent filings' },
      { name: 'System', description: 'System and health endpoints' },
    ],
    servers: [
      {
        url: 'https://express-backend-ajedhzd3h0bfbse5.westindia-01.azurewebsites.net',
      },
      {
        url: 'http://localhost:5000',
      },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['client', 'agent', 'admin'] },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            code: { type: 'string' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          required: ['message'],
        },
        Pageable: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            size: { type: 'integer' },
            totalElements: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
          required: ['page', 'size', 'totalElements', 'totalPages'],
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../app.js'),
    path.join(__dirname, '../auth/*.js'),
    path.join(__dirname, '../patentFilings/*.js'),
    path.join(__dirname, '../nonPatentFilings/*.js'),
    path.join(__dirname, '../admin/*.js'),
    path.join(__dirname, '../agent/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
