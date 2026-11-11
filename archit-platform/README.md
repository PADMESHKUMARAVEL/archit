# Archit Platform — Full-stack MVP

Architecture-focused professional network for students, architects and clients.

## Included
- JWT authentication and role-specific profiles
- Connection requests between students and architects
- Public / connections-only feed, likes and comments
- Architect jobs and internships; student applications do not require a connection
- Client discovery and direct project enquiries
- Persistent conversations and messages with Socket.IO
- Photo uploads for profiles, posts, and chat messages
- MySQL migration and demo seed data
- React + Vite + Tailwind CSS frontend

## Requirements
- Node.js 20+
- MySQL 8+
- npm

## 1. Database
Create a database/user, then run:

```bash
mysql -u root -p < database/migrations/001_initial.sql
cp .env.example .env
cd server && npm install && npm run seed
```

The migration creates the database if it does not exist.

## 2. Backend
```bash
cd server
# Edit DB credentials and JWT_SECRET
npm install
npm run dev
```
API runs at http://localhost:5000. Health check: http://localhost:5000/api/health

## 3. Frontend
In another terminal:
```bash
cd client
npm install
npm run dev
```
Open the Vite URL shown in the terminal (normally http://localhost:5173).

## Deploy (Aiven + Render + Vercel)

This repository keeps the app in the `archit-platform` subdirectory. Configure the
deployment root directories accordingly.

### Aiven database
1. Rotate the database password if it has been shared anywhere public or in chat.
2. In the Aiven console, download the service CA certificate and copy its PEM
   contents for the Render `DB_SSL_CA` environment variable.
3. Apply `database/migrations/001_initial.sql` and then
   `database/migrations/002_job_application_forward_email.sql` to the Aiven
   service. Both migrations use the `archit_platform` database; set `DB_NAME` to
   `archit_platform` in Render.
4. Keep the Aiven host, port, user, and newly rotated password in Render only.

### Render backend
Create a Web Service from this repository with:
- Root Directory: `archit-platform/server`
- Build Command: `npm install`
- Start Command: `npm start`

Set these Render environment variables (use values from your Aiven and Vercel
services; never commit them):
- `FRONTEND_URL`: the deployed Vercel origin, without a trailing slash. You may
  provide multiple comma-separated origins; local Vite origins are allowed for
  development automatically.
- `BACKEND_URL`: the Render service URL
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`: Aiven connection details
- `DB_NAME`: `archit_platform`
- `DB_SSL`: `true`
- `DB_SSL_CA`: contents of the Aiven CA PEM certificate
- `JWT_SECRET`: a newly generated, long random secret
- `MAX_UPLOAD_MB`: `5`
- `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`,
  `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET_NAME`: Supabase Storage S3
  endpoint, region, access key, secret key, and private bucket name
- `STORAGE_URL_TTL_SECONDS`: `3600` (signed download URLs expire after one hour)

Render supplies `PORT` automatically. After deployment, verify
`https://<your-render-service>.onrender.com/api/health` returns `{"status":"ok"}`.

Create a Supabase project and a **private** Storage bucket, then enable S3
protocol access in the Storage settings. Copy the S3 endpoint, region, and
access-key credentials from the Supabase S3 configuration page into Render.
Keep these credentials server-side only; Supabase S3 access keys can access all
the project's buckets and bypass Storage RLS policies. Uploaded files remain
private, and the API returns short-lived signed URLs to authenticated app
responses. A signed URL is a temporary bearer link, so anyone who obtains one
can access that object until it expires. Do not enable public bucket access or
put storage credentials in Vercel. Existing files in the server's local
`uploads` folder are not copied automatically and should be re-uploaded if
needed.

Supabase's Free plan currently includes 1 GB of file storage and 5 GB of egress.
Free projects may be paused after a week of inactivity; check current limits and
billing requirements in the Supabase dashboard before relying on it in
production.

### Vercel frontend
Create/import a Vercel project from this repository with:
- Root Directory: `archit-platform/client`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

Set the following Vercel environment variables for Production (and Preview if
needed):
- `VITE_API_URL`: `https://<your-render-service>.onrender.com/api`
- `VITE_SOCKET_URL`: `https://<your-render-service>.onrender.com`

Redeploy after setting these variables. Then update Render's `FRONTEND_URL` to
the exact Vercel domain you will use and redeploy the backend. `client/vercel.json`
provides the SPA fallback so routes work when opened directly.

## Test accounts
Run `npm run seed` in the `server` directory after configuring the root `.env` file.

### Students — password: `Student@123`
- student1@archit.test
- student2@archit.test
- student3@archit.test
- The account configured in `DEMO_EMAIL` uses `DEMO_PASSWORD`

### Architects — password: `Architect@123`
- architect@archit.test
- architect2@archit.test
- architect3@archit.test

### Clients — password: `Client@123`
- client@archit.test
- client2@archit.test
- client3@archit.test

## Important production hardening
This is a development MVP, not a security-audited production service. Before public deployment:
- use HTTPS and secure HttpOnly cookie/refresh-token design
- add email verification, password reset and account recovery
- use S3-compatible private object storage and signed upload/download URLs
- add request validation, rate limits, moderation, audit logs and backups
- enforce connection-pair uniqueness in both directions (the service checks both)
- add pagination and query limits to every list endpoint
- configure Socket.IO authentication and participant checks (included)
- run migrations through a migration tool in deployment rather than manually
- configure CORS to your exact production frontend origin
- add automated tests and monitoring

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/users?role=ARCHITECT&q=...`, `GET /api/users/:id`
- `POST /api/network/request/:userId`, `GET /api/network/requests`,
  `PATCH /api/network/requests/:id`, `GET /api/network/connections`
- `GET /api/posts`, `POST /api/posts`, `POST /api/posts/:id/like`,
  `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- `GET /api/jobs`, `POST /api/jobs`, `POST /api/jobs/:id/apply`,
  `GET /api/jobs/mine`, `GET /api/jobs/:id/applications`
- `POST /api/enquiries/:architectId`, `GET /api/enquiries`
- `GET /api/chat/conversations`, `GET /api/chat/:conversationId/messages`,
  `POST /api/chat/:conversationId/messages`

Socket.IO events:
- client emits `conversation:join` with `{ conversationId }`
- server emits `message:new` to authorized room members
- server emits `notification:new` to the recipient's personal room

## Notes
- Media URLs are stored as strings. This MVP does not implement file uploads yet.
- Chat messages are persisted in MySQL; Socket.IO only handles real-time delivery.
- Clients can contact architects without a connection. Students can apply for open jobs without a connection.
