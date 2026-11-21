# Minders — Digital Farm Records and Quality Management System

**Team 5 · RETRAP AgTech Innovation Hackathon · Liberia**

Minders helps farmers capture, organize and retrieve farm activity records in one place. The MVP focuses on farmer self-registration, farm management, activity logging/history and offline-first local record keeping.

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v4 + retained custom CSS |
| Offline app | PWA, Service Worker, IndexedDB |
| Backend | Node.js 20+ + Express 5 |
| Database | PostgreSQL (pg) |

## Repository layout

- frontend/ — React farmer prototype and PWA.
- backend/ — Express API foundation and PostgreSQL migration.
- docs/ARCHITECTURE.md — target architecture and security boundaries.
- docs/IMPLEMENTATION_STATUS.md — scaffold features and known gaps.

## Run the frontend

Requirements: Node.js 20+ and npm.

~~~bash
cd frontend
npm install
npm run dev
~~~

Vite serves the app at http://localhost:5173.

## Run the backend

In another terminal:

~~~bash
cd backend
cp .env.example .env
npm install
npm run dev
~~~

The API runs at http://localhost:8000. Check GET /health for liveness and GET /ready for database readiness. Configure PostgreSQL in backend/.env before expecting readiness to pass.

## PostgreSQL setup

Create a database, configure DATABASE_URL in backend/.env, then apply the initial schema:

~~~bash
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql
~~~

On Windows PowerShell, use the equivalent connection string with your installed psql client.

## Important prototype boundaries

The existing farmer registration, login, farm and activity flows still use IndexedDB on the current browser/device. They are not connected to Express or PostgreSQL. The Admin screen is a local preview, not a secure Admin portal. Server-side authentication, CRUD APIs, cloud sync and production authorization remain future implementation tasks.

Never commit real .env files, credentials, PINs or database passwords.
