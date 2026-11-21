# Minders implementation status

## Existing frontend work preserved

- React + Vite application.
- Farmer self-registration and local Phone + PIN sign-in for profiles stored on the current device.
- Farm creation and activity logging/history.
- IndexedDB local persistence and Service Worker app-shell caching.
- Local Admin preview that lists profiles, farms and activity counts in the same browser.
- Existing responsive UI and farmer workflow retained.

## Technology stack alignment in this branch

- Tailwind CSS v4 added through the official Vite plugin and imported in the existing stylesheet. Existing custom CSS is retained to preserve the current prototype design.
- Backend starter changed from Python/FastAPI to Node.js + Express.
- PostgreSQL connection pool and initial relational schema migration added.
- Backend health and database-readiness endpoints added.
- Python backend files and Python dependency manifest removed.

## Current limitations — not completed features

- Farmer registration/login is still local to one browser/device; no server-backed authentication exists.
- Admin preview is not authenticated or secure and is not a real Admin portal.
- Express currently exposes health/readiness endpoints only; farmer, farm and activity API routes are not implemented.
- PostgreSQL schema is supplied as an initial migration but has not been applied to a live database.
- No cloud synchronization, multi-device data sharing, production PIN hashing flow, JWT issuance, authorization middleware or audit log is implemented.
- Existing local PIN hashing is prototype-only and must not be reused as production authentication.
- Service Worker caching helps after the app shell has loaded successfully once; first visit requires network.
- Harvest, quality inspection, sales, profit reporting, QR traceability, GPS mapping, SMS/USSD and audio read-back are not implemented.

## Recommended next steps

1. Configure a development PostgreSQL database and apply backend/db/migrations/001_initial_schema.sql.
2. Implement server-side farmer self-registration/login with Argon2id or bcrypt PIN hashing and short-lived access tokens.
3. Implement restricted Admin provisioning, authentication, role-based authorization and audit logs.
4. Add farmer-scoped farm and activity CRUD API endpoints.
5. Connect React services to the API while retaining IndexedDB for offline use.
6. Implement an offline outbox, idempotent synchronization and conflict handling.
7. Replace the local Admin preview with a protected Admin Farmer Management interface.
8. Add automated API, UI, authorization, offline and synchronization tests.

The MVP remains focused on farmer self-registration, farm management, activity logging/history, offline local persistence and a protected Admin view of permitted farmer information.
