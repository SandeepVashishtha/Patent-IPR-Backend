# Express Backend - Secure Auth and Filing APIs

## Setup

1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   npm install
3. Run migration:
   npm run migrate
4. Optionally create admin manually:
   npm run create-admin -- "Admin Name" admin@example.com StrongPassword123
5. Start server:
   npm run dev

## API

Auth:
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me` (protected)

Swagger docs: `http://localhost:5000/api-docs`

All filing and auth endpoints use JSON responses. Protected endpoints require `Authorization: Bearer <jwt>`.
