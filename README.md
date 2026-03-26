# Express Backend - Secure Auth Module

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

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me` (protected)
- GET `/api/auth/admin-only` (admin protected)

Non-patent filing contract: `non-patent-filing-api.md`

Non-patent filings (generic GET):
- GET `/api/non-patent-filings`
- GET `/api/non-patent-filings/:referenceNumber`

Swagger docs: `http://localhost:5000/api-docs`
