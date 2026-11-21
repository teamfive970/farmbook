# Minders implementation status

## Scaffolded
- React + Vite frontend.
- Farmer self-registration and Phone + PIN sign-in for profiles stored in the current browser/device.
- Farm creation and activity logging/history.
- IndexedDB local persistence and a service worker app-shell cache.
- Local Admin preview showing profiles, farms and activity counts in the same browser.
- FastAPI health-check starter.

## Limitations
- Local profile creation is not server registration; records do not move between devices.
- The Admin preview is not authenticated or secure and must not be used as a real Admin portal.
- No API authentication, authorization, database persistence or cloud sync is implemented.
- Local PIN hashing is only a prototype measure; it is not production authentication.
- App-shell caching helps after the first successful visit; initial load requires the app to be served once.
- Harvest, quality, sales, profit reporting, QR traceability, GPS plot mapping, SMS/USSD and audio read-back are not implemented.

## Next implementation steps
1. Add server-side farmer registration/login with secure PIN hashing.
2. Add restricted Admin authentication, role-based authorization and audit logs.
3. Add PostgreSQL persistence and farmer-scoped farm/activity APIs.
4. Add a durable offline sync queue with idempotency and visible pending/synced/failed states.
5. Replace local Admin preview with a protected Admin Farmer Management interface.
6. Test account isolation, permissions, offline writes and sync retries.

The first usable MVP should prioritize farmer registration, farm management, activity logging/history and Admin visibility of registered farmers. Harvest, quality, sales, traceability and advanced reports are later phases.
