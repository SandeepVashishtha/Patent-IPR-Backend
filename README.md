# Patent IPR Backend

Secure authentication and role-based filing management backend built with Express and PostgreSQL.

This service supports:
- JWT authentication
- Role-based authorization (`client`, `agent`, `admin`)
- Patent filings lifecycle
- Non-patent filings lifecycle (`TRADEMARK`, `COPYRIGHT`, `DESIGN`)
- Admin and agent workflows
- Swagger/OpenAPI documentation

## Tech Stack

- Node.js
- Express
- PostgreSQL (`pg`)
- JWT (`jsonwebtoken`)
- Password hashing (`bcrypt`)
- Request validation (`zod`)
- API documentation (`swagger-jsdoc`, `swagger-ui-express`)

## Project Structure

```
.
|-- server.js
|-- src/
|   |-- app.js
|   |-- auth/
|   |-- patentFilings/
|   |-- nonPatentFilings/
|   |-- admin/
|   |-- agent/
|   |-- client/
|   |-- config/
|   |-- scripts/
|   `-- utils/
`-- README.md
```

## Prerequisites

- Node.js 18+
- PostgreSQL 13+

## Environment Variables

Copy `.env.example` to `.env` and set the values.

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=replace_with_a_very_strong_secret

# Option 1: full connection string
# DATABASE_URL=postgresql://postgres:password@localhost:5432/express_backend

# Option 2: PG variables
PGHOST=localhost
PGPORT=5432
PGDATABASE=express_backend
PGUSER=postgres
PGPASSWORD=password
PGSSLMODE=disable
PGCHANNELBINDING=disable
```

Notes:
- `JWT_SECRET` is required.
- Database config is required via either `DATABASE_URL` or `PGHOST/PGDATABASE/PGUSER/PGPASSWORD`.

## Installation and Local Run

1. Install dependencies:

```bash
npm install
```

2. Run database migration:

```bash
npm run migrate
```

3. (Optional) Create or update an admin user:

```bash
npm run create-admin -- "Admin Name" admin@example.com StrongPassword123
```

4. Start development server:

```bash
npm run dev
```

For production mode:

```bash
npm start
```

## NPM Scripts

- `npm run dev` - Start with nodemon
- `npm start` - Start with node
- `npm run migrate` - Run idempotent DB migration
- `npm run create-admin -- "Name" email password` - Create or update an admin account

## API Base URLs

- Local: `http://localhost:5000`
- Deployed server (from Swagger config): `https://express-backend-ajedhzd3h0bfbse5.westindia-01.azurewebsites.net`

## API Documentation

Swagger UI:
- Local: `http://localhost:5000/api-docs`

Health and root:
- `GET /` -> service status text
- `GET /api/health` -> `{ "status": "ok" }`

## Authentication

Public auth endpoints:
- `POST /api/auth/register`
- `POST /api/auth/login`

Protected auth endpoint:
- `GET /api/auth/me`

Use bearer token header for protected routes:

```http
Authorization: Bearer <jwt>
```

## Role-Based Modules

### Client

- Profile and password management
- Forgot password flow (`POST /api/client/forgot-password`)
- Client filing views and management

### Agent

- Agent dashboard and profile
- View assigned filings
- Update assigned filing statuses

### Admin

- Dashboard statistics
- User management (list/create/update role/delete)
- Filing review and assignment workflows

## Filing APIs (High Level)

### Patent Filings

Examples:
- `POST /api/patent-filings`
- `PATCH /api/patent-filings/:id`
- `POST /api/patent-filings/:id/submit`
- `GET /api/patent-filings/:referenceNumber`
- `POST /api/patent-filings/:id/documents`

### Non-Patent Filings

Types supported: `TRADEMARK`, `COPYRIGHT`, `DESIGN`

Examples:
- `GET /api/non-patent-filings`
- `GET /api/non-patent-filings/:referenceNumber`
- `POST /api/trademark-filings`
- `GET /api/trademark-filings/:referenceNumber`

## Security and Middleware

- `helmet` for security headers
- `cors` enabled
- `express-rate-limit` on `/api` (200 requests per 15 minutes)
- Request body limit: `10kb`
- Centralized 404 and error handlers

## Database Migration Notes

Migration script is idempotent and creates/updates:
- Enum types for roles, statuses, and non-patent filing types
- `users`, `patent_filings`, `non_patent_filings` tables
- Useful indexes
- Assignment fields (`assigned_agent_id`, `agent_name`, `assigned_at`)
- `admin_note` fields
- `estimation` field for non-patent filings
- `IN_REVIEW` filing status value

## License

ISC
