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
