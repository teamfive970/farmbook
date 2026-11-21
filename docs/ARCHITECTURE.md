# Minders architecture

## Current browser prototype

```text
React + Vite UI -> IndexedDB local storage
       |                |
       +---- Service worker caches app shell
```

The current frontend stores farmer profiles, farms and activities in the current browser/device only. This is local persistence, not cloud synchronization.

## Planned production architecture

```text
Farmer PWA / Admin UI -> HTTPS API -> FastAPI -> PostgreSQL
                                         |
                               Auth + RBAC + audit log
```

- Farmer self-registers and manages their own farms and records.
- Admin has a separately protected sign-in and may view/manage permitted farmer profiles.
- Server queries must scope farmer data to the authenticated farmer ID.
- Admin actions must be permission-checked and audited.
- Offline changes need a durable sync queue, idempotency keys and visible pending/synced/failed states.

## Core entities
- Farmer: id, full_name, phone_number, county, district, pin_hash, created_at, status
- Farm: id, farmer_id, farm_name, location, farm_type, crop_or_livestock, created_at
- FarmActivity: id, farm_id, farmer_id, activity_type, activity_date, description, input_used, quantity, unit, notes, created_at, updated_at

One farmer can have multiple farms; one farm can have multiple activity records.
