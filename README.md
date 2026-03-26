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
- GET `/api/auth/admin-only` (admin protected)

Patent filings:
- POST `/api/patent-filings`
- POST `/api/patent-filings/:id/submit`
- PATCH `/api/patent-filings/:id`
- GET `/api/patent-filings/:referenceNumber`
- POST `/api/patent-filings/:id/documents`
- GET `/api/client/patents`
- POST `/api/files/presign`

Non-patent filings:
- POST `/api/trademark-filings`
- GET `/api/client/trademark-filings`
- GET `/api/trademark-filings/:referenceNumber`
- PATCH `/api/trademark-filings/:id`
- POST `/api/trademark-filings/:id/documents`
- POST `/api/copyright-filings`
- GET `/api/client/copyright-filings`
- GET `/api/copyright-filings/:referenceNumber`
- PATCH `/api/copyright-filings/:id`
- POST `/api/copyright-filings/:id/documents`
- POST `/api/design-filings`
- GET `/api/client/design-filings`
- GET `/api/design-filings/:referenceNumber`
- PATCH `/api/design-filings/:id`
- POST `/api/design-filings/:id/documents`

System:
- GET `/`
- GET `/api/health`

Swagger docs: `http://localhost:5000/api-docs`

All filing and auth endpoints use JSON responses. Protected endpoints require `Authorization: Bearer <jwt>`.
