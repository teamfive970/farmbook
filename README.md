<div align="center">

# 🌱 FarmBok

**Simple farm records for smallholder farmers in Liberia.**
Pictures and voice instead of typing. Works without network. Shows the farmer their profit.

[Live app](https://farmbok.up.railway.app) · [Deploying](DEPLOY.md) · [License](LICENSE)

*Team 5 (Minders) · RETRAP AgTech Hackathon · Challenge 2: Digital Farm Records & Quality Management*

</div>

---

## Why FarmBok

Most smallholder farmers keep their records across exercise books, spreadsheets and memory, or keep none at all. Without organized records, a farmer cannot see their profit, learn from past seasons, or prove to a buyer where and how a crop was grown.

FarmBok puts one simple record book on the phone the farmer already has:

> **Farmers record once. Everyone who needs to know, knows.**
> The farmer sees their profit, the buyer gets a Harvest Passport, and cooperatives and the Ministry get live totals.

## Features

### For farmers
- **Record work in a few taps:** pick the farm, the work and the day from pictures. No typing.
- **Works offline:** every record saves on the phone first and syncs when network returns. Sign-in also works offline after the first online sign-in.
- **Voice read-aloud:** every screen can be read out loud in simple Liberian English. On-screen text uses simple standard English.
- **Crops, animals or mixed farms:** each planting and each animal group keeps its own history.
- **Harvests with quality grades,** linked to the planting or herd they came from.
- **Money:** sales, payments and costs in **L$ and US$, kept apart**, with profit by farm, crop and animal group. A farmer cannot sell more than was harvested.
- **Farm report:** one tap to save as **PDF** (to print or share) or **CSV** (Excel).
- **Harvest Passport:** a QR code and printable product tag for each harvest. Buyers scan it to see where and how the crop was grown, and its grade. The farmer decides whether to share it, and the farmer's phone number and full name are never shown.
- **Shared phones:** several farmers can use one phone, each with a private profile and PIN.
- **PIN recovery** by a security question, or by SMS when configured.
- **Messages:** one inbox with a bell and unread count. It holds news from the Ministry and the farmer's group, plus smart reminders worked out from the farmer's own records:
  - no work recorded for 3 days
  - money still owed a week after a sale
  - a grade A or B harvest whose Harvest Passport is still off

  Reminders disappear by themselves once the job is done. The last inbox is kept on the phone, so it opens offline. Farmers choose whether important news may also come by SMS.
- **Compare seasons:** this season next to the one before (or this year against the same time last year), crop by crop and animal group by animal group.
  - Shows harvest, money in, costs, profit, share of grade A and animals lost, with up and down arrows.
  - Up to three plain sentences about what changed, which the phone can read aloud.
  - Worked out on the phone, so it works offline.

### For cooperatives and the Ministry of Agriculture
- **Admin dashboard** with live charts by county, crop and month, in L$ or US$.
- **Farmer management:** search, filter, view, edit and reactivate farmers.
- **Cooperatives:** groups with join codes, members and group totals.
- **CSV exports** and an **audit log** of admin actions. Farmer phone numbers stay masked.
- **Announcements:** send a message to all farmers, one county or one group.
  - It lands in each farmer's Messages, and by SMS to farmers who allow it.
  - The screen shows how many farmers it will reach before sending.
  - Afterwards it shows how many read it, plus SMS sent, failed or skipped.
  - Every announcement is written to the audit log.

## How it works

```
 Phone (PWA)                          Server                     Database
┌──────────────────────┐   sync    ┌──────────────────────┐   ┌────────────┐
│ React app            │ ───────▶  │ Express API          │──▶│ PostgreSQL │
│ IndexedDB  (records) │ ◀───────  │ auth · rules · money │   └────────────┘
│ Sync queue (offline) │           │ reports · passports  │
└──────────────────────┘           │ admin analytics      │
                                   └──────────────────────┘
```

1. Every change is written to **IndexedDB** on the phone and added to a **sync queue**.
2. When the phone is online, the queue sends changes in order. Each record carries a client ID, so a retry never creates a duplicate.
3. The server checks every rule again (ownership, money limits, harvest quantities) before saving to **PostgreSQL**.
4. Cooperatives and the Ministry see the totals of the synced records.

## Tech stack

| Layer | Technology |
|---|---|
| Web app | React 18, Vite 6, Tailwind CSS 4, React Router, `idb` (IndexedDB), lucide icons, installable PWA |
| API | Node.js ≥ 20, Express 5, `pg`, bcrypt PIN hashing, Helmet, rate limiting |
| Database | PostgreSQL, with versioned SQL migrations |
| Hosting | Railway: Backend, Frontend and Postgres services |

## Project structure

```
farmbook/
├── backend/                 Express API
│   ├── db/migrations/       SQL migrations (001 … 011), applied in order
│   ├── scripts/             migrate · create-admin · seed-demo
│   ├── src/
│   │   ├── routes/          auth, farms, activities, records, reports, passport, cooperatives, notifications, admin
│   │   ├── services/        business rules and queries
│   │   ├── middleware/      auth, rate limits, errors
│   │   └── lib/             PINs, tokens, encryption, lockout, SMS, audit
│   └── tests/               node:test suites (auth, money integrity, admin, …)
├── frontend/                React web app (PWA)
│   └── src/
│       ├── pages/farmer/    farmer screens
│       ├── pages/admin/     admin screens
│       ├── lib/             sync engine, offline store and auth, reports, QR, voice, words, season compare
│       └── contexts/        auth, sync, voice, toasts, notifications
├── DEPLOY.md                Railway setup and troubleshooting
└── package.json             helper scripts for both folders
```

## Getting started (local)

**You need:** Node.js 20 or newer, and PostgreSQL 13 or newer.

### 1. Database
Create a database and a user, for example:
```sql
CREATE USER minders WITH PASSWORD 'change-me';
CREATE DATABASE minders OWNER minders;
```

### 2. API
```bash
cd backend
cp .env.example .env          # set DATABASE_URL; the other defaults suit local work
npm install
npm run migrate               # create the tables
npm run seed:demo             # optional: demo farmer + 40 more (PIN 123456)
npm run admin:create -- --name "Your Name" --code MND-LOCAL1 --pin 123456
npm run dev                   # http://127.0.0.1:8000
```

### 3. Web app
In a second terminal:
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5101
```
The dev server forwards `/api` to the API on port 8000, so no extra settings are needed. Phones on the same Wi-Fi can open the app using your computer's network address.

### Demo accounts (after `seed:demo`)

| Who | Sign in with | PIN |
|---|---|---|
| Farmer (James Kollie, Bong) | phone `0770000001` | `123456` |
| 40 more farmers | phones `0770000010` – `0770000049` | `123456` |
| Admin | access code `MND-LOCAL1` at `/admin/login` | `123456` |

> ⚠️ Demo accounts share a published PIN. `seed:demo` refuses to run in production. Use it on local and test databases only.

## Configuration

### API (`backend/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `DATABASE_SSL` | `true` if the database needs SSL |
| `NODE_ENV` | `development` or `production` |
| `HOST`, `PORT` | Listen address. In production it defaults to `0.0.0.0`, locally to `127.0.0.1:8000` |
| `FRONTEND_ORIGIN` | Comma-separated web app addresses allowed by CORS |
| `AUTO_MIGRATE` | `true` applies pending migrations at start-up (on by default in development) |
| `CREDENTIAL_KEY` | 32-byte base64 key, so admins can reveal their access code later |
| `SESSION_DAYS`, `FARMER_SESSION_DAYS` | Session lifetimes (farmers: long, because they work offline) |
| `BCRYPT_COST` | PIN hashing cost (default 10) |
| `SMS_PROVIDER` | `disabled`, `console`, `twilio` or `africastalking`, for PIN reset and announcements by SMS |
| `ANNOUNCEMENT_SMS_LIMIT` | Most SMS one announcement may send (default 1000) |
| `ADMIN_NAME`, `ADMIN_ACCESS_CODE`, `ADMIN_PIN`, `ADMIN_PHONE` | Creates the first admin at start-up while none exists |

### Web app (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | The API's address, only when the API is hosted at a different address. No `/api`, no trailing slash |
| `VITE_PUBLIC_URL` | Public address used in Harvest Passport links, QR codes and printed tags |

Vite builds these into the app, so rebuild after changing them.

## Scripts

| Where | Command | What it does |
|---|---|---|
| `backend/` | `npm run dev` | API with auto-reload |
| `backend/` | `npm start` | API for production |
| `backend/` | `npm run migrate` | Apply database migrations |
| `backend/` | `npm run admin:create -- --name "…"` | Create an admin (prints the access code and PIN once) |
| `backend/` | `npm run seed:demo` | Load demo farmers, harvests, sales and cooperatives |
| `backend/` | `npm test` | API tests |
| `frontend/` | `npm run dev` / `build` / `preview` | Web app |
| `frontend/` | `npm test` | Web app tests |
| root | `npm test` | Both test suites |

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

The API tests use `DATABASE_URL`, or `postgres://postgres@127.0.0.1:5433/minders_test` if it isn't set. **Point them at a separate test database**: the tests create and remove their own data and will clash with existing records.

## Deployment

FarmBok runs on Railway as three services: Backend (`/backend`), Frontend (`/frontend`) and Postgres. Each `git push` to `main` redeploys automatically. **[DEPLOY.md](DEPLOY.md)** lists every variable, how to create the first admin, and fixes for CORS and 502 errors.

## Security and privacy

- PINs and security answers are stored only as bcrypt hashes. Admin access codes are stored hashed, plus encrypted if `CREDENTIAL_KEY` is set.
- Accounts lock for a while after repeated wrong PINs, and sign-in and recovery are rate-limited.
- Each farmer can only read and change their own records; this is checked on the server for every request.
- Harvest Passports are off until the farmer turns them on, and never show the farmer's phone number or full name.
- Admin access to farmer data is written to an audit log, and phone numbers are masked in exports.
- Secrets live in `.env` files and hosting variables, never in git (see `.gitignore`).

## Roadmap

- Kpelle and Bassa voice
- Phone pop-up notifications while the app is closed (web push), and support for basic (non-smartphone) phones through cooperative agents
- GPS farm location on the Harvest Passport, for exporter traceability
- 4-week pilot with 10–20 farmers and a partner cooperative in Bong County

## Team

**Team 5 (Minders)**: RETRAP AgTech Hackathon

| Name | Role |
|---|---|
| Nehemiah Happie Flomo | Team Lead |
| Christian A. Harris | Tech Lead |
| Daniella F.K. Makundu | Agriculture Lead |
| King S. Gedegar | Design Lead |
| Michael T. Butler | Pitch Lead |

## License

[MIT](LICENSE) © 2026 teamfive970
