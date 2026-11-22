# Deploying FarmBok on Railway

FarmBok runs on Railway as three services in one project:

| Service | Root Directory | What it is |
|---|---|---|
| **Backend** | `/backend` | The API (Node/Express). Public address e.g. `farmbook-production-….up.railway.app` |
| **Frontend** | `/frontend` | The web app, built by Vite. Public address `farmbok.up.railway.app` |
| **Postgres** | – | The database |

Both app services deploy automatically on every `git push` to `main`.
Settings live in each service's **Variables** tab, not in the repository.
(Do not add a `railway.json`: Railway would apply it to both services.)

## Backend variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | `production` |
| `FRONTEND_ORIGIN` | `https://farmbok.up.railway.app` (exact, no trailing slash) |
| `AUTO_MIGRATE` | `true`, so database updates are applied when the server starts |
| `CREDENTIAL_KEY` | lets an admin reveal their access code later |
| `ADMIN_NAME`, `ADMIN_ACCESS_CODE`, `ADMIN_PIN` | create the first admin (see below) |

`HOST` and `PORT` are optional: in production the server listens on `0.0.0.0`
and the port Railway gives it. If you set `PORT`, the Backend's domain must
route to the same port (Settings → Networking).

## Frontend variables

| Variable | Value |
|---|---|
| `VITE_API_URL` | the Backend's public address, e.g. `https://farmbook-production-….up.railway.app` (no `/api`, no trailing slash) |
| `VITE_PUBLIC_URL` | `https://farmbok.up.railway.app` (used in QR codes and Harvest Passport links) |

Vite writes these into the app when it is built, so after changing one,
**redeploy the Frontend**.

## Creating the first admin

On the **Backend** service, add `ADMIN_NAME`, `ADMIN_ACCESS_CODE` (6–40
letters, numbers or dashes, e.g. `MND-TEAM5X`) and `ADMIN_PIN` (6 digits, not
123456). Railway redeploys; the deploy log shows
`First admin "…" created with access code …`. Sign in at
`https://farmbok.up.railway.app/admin/login`, then delete `ADMIN_PIN` from
Variables. The admin keeps working.

This only happens while the database has no admin. To add more admins, use
`railway ssh` on the Backend, then `npm run admin:create -- --name "…"`.

## Tester login on the home page (for judges)

On the **Backend**, set `DEMO_ADMIN_ACCESS_CODE` (e.g. `Minister-Demo`) and
`DEMO_ADMIN_PIN` (6 digits, e.g. `112233`). Railway redeploys. Then:

- the server creates that admin, or puts its PIN right and unlocks it, on every start;
- the home page shows a **For testers and judges** box with the code, the PIN
  and an **Admin sign-in** button that fills in the code;
- that login can look around and try things, but cannot change its code or PIN
  and cannot send SMS (its announcements stay in the app).

Anyone who opens the site can use it, so **delete both variables after
judging**. On the next start the box disappears and the tester login is
switched off and signed out. Choosing a new code does the same to the old one.

## Demo data (test servers only)

`npm run seed:demo` (in `backend/`) adds James Kollie and 40 demo farmers, all
with PIN 123456. It refuses to run in production, because anyone with that
PIN could sign in.

## If something goes wrong

| What you see | Fix |
|---|---|
| CORS error, or requests to `your-backend…` | `VITE_API_URL` is wrong or missing on the Frontend. Fix it and redeploy the Frontend. |
| CORS error with the right address | `FRONTEND_ORIGIN` on the Backend must be exactly `https://farmbok.up.railway.app`. |
| 502 Bad Gateway | The Backend is down or listening on 127.0.0.1. Remove `HOST=127.0.0.1`, and check `PORT` matches the domain's port. |
| Admin access code not accepted | `ADMIN_*` only creates an admin while there is none. Use the code from the deploy log, or create one with `railway ssh`. |
