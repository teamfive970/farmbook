# Minders architecture

## Agreed technology stack

- Frontend: React 18, Vite, Tailwind CSS v4, Progressive Web App (PWA).
- Offline persistence: IndexedDB; Service Worker caches the application shell.
- Backend: Node.js 20+ and Express 5 (JavaScript ES modules).
- Database: PostgreSQL, accessed through the pg connection pool.
- API: JSON REST endpoints over HTTPS.

## Target architecture

~~~text
Farmer PWA / Admin UI
  React + Tailwind CSS v4 + Vite
       |                  |
       |             IndexedDB
       |             offline records
       |                  |
       +---- HTTPS REST API
                  |
           Node.js + Express
                  |
              PostgreSQL
~~~

The existing frontend retains farmer self-registration, local Phone + PIN sign-in, farm creation, activity logging and history. These are browser-local prototype flows, not server-backed accounts.

## Backend foundation

The Express service provides GET /health for process liveness and GET /ready for PostgreSQL connectivity readiness. It includes PostgreSQL connection configuration, Helmet security headers, configurable CORS and JSON parsing.

Production farmer authentication, Admin authentication/authorization, and farmer/farm/activity CRUD endpoints are not yet implemented.

## Core data model

- Farmers: id, full_name, phone_number, county, district, pin_hash, status, created_at, updated_at.
- Farms: id, farmer_id, farm_name, location, farm_type, crop_or_livestock, created_at, updated_at.
- Farm activities: id, farm_id, farmer_id, activity_type, activity_date, description, input_used, quantity, unit, notes, created_at, updated_at.

One farmer can own multiple farms; each farm can contain multiple activities. The migration uses a composite foreign key so an activity's farmer must own the referenced farm.

## Access and privacy rules

- Farmers self-register; Admin approval is not a prerequisite.
- Admin accounts are provisioned only by an authorized system owner. There is no public Admin signup.
- Server-side PINs must use Argon2id or bcrypt, never plaintext or a fast general-purpose hash.
- Farmer-owned API queries must be scoped to the authenticated farmer ID.
- Admin access must be role-checked and limited to permitted operations; administrative changes require audit logging.
- Never trust a farmer ID supplied by the browser as proof of ownership.

## Offline and synchronization design

IndexedDB is the local working store. Cloud synchronization is separate and is not implemented. A safe sync implementation needs a durable outbox, stable client-generated IDs/idempotency keys, conflict handling, retry behavior, and visible pending/synced/failed states. First load still requires network unless the app has already been loaded and cached.

See backend/.env.example for configuration. Never commit real secrets or production database credentials.
