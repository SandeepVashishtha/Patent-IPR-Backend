const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Express Auth API',
      version: '1.0.0',
      description: 'Authentication and authorization API',
    },
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
  apis: [path.join(__dirname, '../auth/*.js')],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
