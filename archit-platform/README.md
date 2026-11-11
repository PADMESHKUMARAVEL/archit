# Archit Platform — Full-stack MVP

Architecture-focused professional network for students, architects and clients.

## Included
- JWT authentication and role-specific profiles
- Connection requests between students and architects
- Public / connections-only feed, likes and comments; extended profiles and
  connections-only posts are visible only to accepted connections
- Architect jobs and internships; student applications do not require a connection
- Client discovery and direct project enquiries
- Client profiles, paginated architect discovery, portfolio browsing, and saved architects
- Enquiry tracking, private attachments, accepted project workspaces, milestones, and progress updates
- Client dashboard, shared project documents, notifications, and profile/password settings
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
mysql -u root -p < database/migrations/002_job_application_forward_email.sql
mysql -u root -p < database/migrations/003_chat_message_hidden_for.sql
mysql -u root -p < database/migrations/004_client_workspace.sql
mysql -u root -p < database/migrations/005_client_project_board.sql
mysql -u root -p < database/migrations/006_chat_profile_post_shares.sql
mysql -u root -p < database/migrations/007_client_fields_on_users.sql
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
3. Apply any migrations not already applied to the Aiven service, in order:
   `001_initial.sql`, `002_job_application_forward_email.sql`,
   `003_chat_message_hidden_for.sql`, `004_client_workspace.sql`,
   `005_client_project_board.sql`, `006_chat_profile_post_shares.sql`, then
   `007_client_fields_on_users.sql`. Migration 007 copies client-specific fields
   into `users` and removes the now-redundant `client_profiles` table.
   Do not rerun already-applied migrations (in particular, migration `002`
   adds a column and is not repeatable). The migrations use the
   `archit_platform` database; set `DB_NAME`
   to `archit_platform` in Render.
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
- `STORAGE_ENDPOINT`: Supabase S3 endpoint in the form
  `https://<project-ref>.storage.supabase.co/storage/v1/s3`
- `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
  `STORAGE_BUCKET_NAME`: Supabase S3 region and credentials plus the private
  bucket name
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
put storage credentials in Vercel. New uploads are buffered in memory and sent
directly to Supabase Storage; the server does not save uploads to a local
`uploads` directory. For legacy localhost upload URLs, run
`node scripts/migrateLocalUploadsToSupabase.js` from `server` to preview
migration, then add `--apply` to upload locally available source files and
update the database references. The script refuses remote databases unless
`--allow-remote` is explicitly added and leaves original local files untouched.

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
- `POST /api/auth/register` (Student, Architect, or Client),
  `POST /api/auth/login`, `GET /api/auth/me`
- `POST /api/auth/password` (authenticated password change)
- `GET /api/users?role=ARCHITECT&q=...`, `GET /api/users/:id`
- `POST /api/network/request/:userId`, `GET /api/network/requests`,
  `PATCH /api/network/requests/:id`, `GET /api/network/connections`
- `GET /api/posts`, `GET /api/posts/:id`, `POST /api/posts`, `DELETE /api/posts/:id`,
  `POST /api/posts/:id/like`,
  `GET /api/posts/:id/comments`, `POST /api/posts/:id/comments`
- `GET /api/jobs`, `POST /api/jobs`, `POST /api/jobs/:id/apply`,
  `GET /api/jobs/mine`, `GET /api/jobs/:id/applications`
- `GET /api/client/dashboard`, `GET|PUT /api/client/profile`
- `GET /api/client/architects` (paginated search and filters),
  `GET /api/client/architects/:id`, `GET /api/client/saved-architects`,
  `POST|DELETE /api/client/saved-architects/:architectId`
- `POST /api/enquiries/:architectId`, `GET /api/enquiries`,
  `GET /api/enquiries/:id`, `PATCH /api/enquiries/:id/status`,
  `PATCH /api/enquiries/:id/cancel`
- `GET /api/client/projects`, `GET /api/client/projects/:id`,
  `POST /api/client/projects/:id/milestones`,
  `PATCH /api/client/projects/:id/milestones/:milestoneId`,
  `POST /api/client/projects/:id/updates`,
  `PATCH /api/client/projects/:id/status`,
  `POST /api/client/projects/:id/documents`, `GET /api/client/documents`
- `GET /api/client/project-board` (architect discovery of public client briefs),
  `GET|POST /api/client/project-requests` (client's briefs),
  `GET /api/client/project-requests/:id`,
  `POST /api/client/project-requests/:id/proposals`,
  `PATCH /api/client/project-requests/:id/proposals/:proposalId`,
  `PATCH /api/client/project-requests/:id/close`
- `GET /api/chat/conversations`, `GET /api/chat/:conversationId/messages`,
  `POST /api/chat/:conversationId/messages`,
  `DELETE /api/chat/:conversationId/messages/:messageId?for=me|everyone`,
  `DELETE /api/chat/:conversationId/messages`

Socket.IO events:
- client emits `conversation:join` with `{ conversationId }`
- server emits `message:new` to authorized room members
- server emits `notification:new` to the recipient's personal room

## Notes
- Client documents, enquiry attachments, and public-brief references use the
  configured private S3-compatible object storage. Apply all seven database
  migrations before using the latest chat and client marketplace functionality.
- Chat messages are persisted in MySQL; Socket.IO only handles real-time delivery.
- `POST /api/chat/:conversationId/messages` also accepts `shareType=PROFILE|POST`
  and `shareId`; sharing is restricted to accepted-connection conversations.
- Profiles and posts can be shared from their pages into an accepted-connection
  chat. Shared profile details and connections-only posts are resolved for each
  viewer using the same connection/visibility checks as normal profile and feed
  requests; a share does not bypass those checks. Public posts remain public.
- Clients can contact architects without a connection. Students can apply for open jobs without a connection.
- Registration supports Student, Architect, and Client roles. Role-based
  middleware controls each role's capabilities.
- Students can post work and achievements and apply to architect jobs. Architects
  can publish work and jobs, review student applications and shortlist candidates,
  discover clients, and respond to client project briefs. Clients can publish
  briefs for architects to discover or contact an architect directly.
- Client role features reuse the existing authentication, conversations,
  notifications, portfolio, and object-storage services. Architect education
  records and email verification are not currently represented in the existing
  schema/workflows.
