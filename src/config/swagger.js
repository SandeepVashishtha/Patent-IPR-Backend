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
      },
    },
  },
  apis: [
    path.join(__dirname, '../auth/*.js'),
    path.join(__dirname, '../patentFilings/*.js'),
    path.join(__dirname, '../nonPatentFilings/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
