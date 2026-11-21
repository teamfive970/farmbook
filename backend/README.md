# Minders API

Node.js 20+ and Express 5 API foundation for the Minders Digital Farm Records MVP.

## Install and run

~~~bash
npm install
cp .env.example .env
npm run dev
~~~

Configure DATABASE_URL in .env before expecting PostgreSQL readiness. The API listens on http://localhost:8000 by default.

## Endpoints

- GET /health — process liveness; does not require PostgreSQL.
- GET /ready — readiness check; returns HTTP 503 until PostgreSQL is configured and reachable.

## PostgreSQL

Create a database, set DATABASE_URL in .env, and apply db/migrations/001_initial_schema.sql using psql.

## Current scope

This is an API foundation, not a finished backend. Farmer/Admin authentication, PIN hashing, authorization, farmer/farm/activity CRUD routes, audit logging and synchronization endpoints still need implementation. The local Admin preview is not a real Admin portal.

Never commit .env or production credentials.