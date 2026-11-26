<div align="center">

# 🌱 FarmBok

**Simple farm records for smallholder farmers in Liberia.**
Pictures and voice instead of typing. Works without network. Shows the farmer their profit.

[Live app](https://farmbok.up.railway.app) · [Deploying](DEPLOY.md) · [License](LICENSE)

_Team 5 (Minders) · RETRAP AgTech Hackathon · Challenge 2: Digital Farm Records & Quality Management_

</div>

---

## Why FarmBok

Most smallholder farmers keep their records across exercise books, spreadsheets and memory, or keep none at all. Without organized records, a farmer cannot see their profit, learn from past seasons, or prove to a buyer where and how a crop was grown.

FarmBok puts one simple record book on the phone the farmer already has:

> **Farmers record once. Everyone who needs to know, knows.**
> The farmer sees their profit, the buyer gets a Harvest Passport, and cooperatives and the Ministry get live totals.

## Future Features

## Two sign-in method:

- **USSD sign-up/sign-in** (implemented: USSD menu)
- **Online sign-up/sign-in (already implemented)**
- **Dilect Translation (per farmer preference)**
- **USSD Voice**
- **Buyers getting in direct contact with farmers (implemented: "Contact this farmer")**
- **Buyer getting direct mapping on the farmer scan harvest passport** (implemented: farm location and passport map)
- **Weather update (in-app, sms, USSD)** (implemented: Weather page, heavy-rain SMS alerts, USSD weather)
- **Linking Farmers to e-advisory platforms**
- **AI analysis of farmer records**
- **Connecting farmers to market places (implemented: FarmBok market)**
- **Farmers getting market price in realtime (in-app, sms, USSD)** (in-app and USSD implemented)
- **Make a way that farmers without smartphone can also use the app through USSD & SMS** (implemented: USSD menu and SMS alerts)
- **Make a way that a specific farm or coorperative can benefit from micro-finance/load organization**
- **Make a way that buyers can connect with farmers even without having to scan the Harvest passport.** (implemented: Harvests for sale)

## Current Features

### For farmers

- **Record work in a few taps:** pick the farm, the work and the day from pictures. No typing.
- **Works offline:** every record saves on the phone first and syncs when network returns. Sign-in also works offline after the first online sign-in.
- **Voice read-aloud:** every screen can be read out loud in simple Liberian English. On-screen text uses simple standard English.
- **Crops, animals or mixed farms:** each planting and each animal group keeps its own history.
- **Harvests with quality grades,** linked to the planting or herd they came from.
- **Money:** sales, payments and costs in **L$ and US$, kept apart**, with profit by farm, crop and animal group. A farmer cannot sell more than was harvested.
- **Farm report:** one tap to save as **PDF** (to print or share) or **CSV** (Excel).
- **Harvest Passport:** a QR code and printable product tag for each harvest. Buyers scan it to see where and how the crop was grown, and its grade. The farmer decides whether to share it, and the farmer's phone number and full name are never shown.
- **Weather and farm advice:** a 7-day forecast for the farmer's county (rain, heat, wind) on the Home screen and a Weather page, with simple advice such as "rain is coming, do not spray now" or "dry days, good time to dry your rice". The last forecast stays on the phone for offline use. Data from Open-Meteo, shared per county and cached on the server.
- **Farm location and passport map:** standing on the farm, the farmer taps "Save my farm location" (GPS works without network). If the farmer turns on "Show my farm area to buyers", the Harvest Passport shows the farm area on a map, rounded to about 1 km, with a directions button. Without it, buyers get a map search for the town.
- **Heavy-rain alerts:** a few times a day the server checks the forecast for every county with farmers. When heavy rain is coming in the next three days, each farmer there gets one message in the app, and one SMS if they allow SMS. The same rain day never alerts twice.
- **USSD for any phone:** farmers without a smartphone dial a short code to make an account, sign in with their PIN, record farm work, and see the weather, market prices, their messages and their money. It is the same account as the app. Wrong PINs count toward the same lock.
- **Shared phones:** several farmers can use one phone, each with a private profile and PIN.
- **Buyer requests ("Contact this farmer"):** a buyer who scans a Harvest Passport can leave their name, number, quantity and a message.
  - The farmer is told in Messages, and by SMS if they allow it.
  - From **Buyer requests** the farmer can call, text, share their own number (sent to the buyer by SMS) or say "not now".
  - The farmer's number is never shown on the passport.
- **FarmBok market** (`/market`, public, also linked from the home page and every passport):
  - **Harvests for sale:** every harvest whose passport is on and that still has some left, with crop, grade, county and first name. Buyers filter by crop, county and grade, then tap **Contact**. No phone numbers are shown. Harvests that failed their quality check are left out.
  - **Market prices:** typical price per unit and the usual range from sales FarmBok farmers recorded in the last 60 days, by county, with the change against the 60 days before. A price only shows when at least 3 different farmers sold that crop, so no single farmer's price can be worked out. Farmers find it under Money → Market prices.
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

| Layer    | Technology                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------ |
| Web app  | React 18, Vite 6, Tailwind CSS 4, React Router, `idb` (IndexedDB), lucide icons, installable PWA |
| API      | Node.js ≥ 20, Express 5, `pg`, bcrypt PIN hashing, Helmet, rate limiting                         |
| Database | PostgreSQL, with versioned SQL migrations                                                        |
| Hosting  | Railway: Backend, Frontend and Postgres services                                                 |

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

| Who                         | Sign in with                               | PIN      |
| --------------------------- | ------------------------------------------ | -------- |
| Farmer (James Kollie, Bong) | phone `0770000001`                         | `123456` |
| 40 more farmers             | phones `0770000010` – `0770000049`         | `123456` |
| Admin                       | access code `MND-LOCAL1` at `/admin/login` | `123456` |

> ⚠️ Demo accounts share a published PIN. `seed:demo` refuses to run in production. Use it on local and test databases only.

## Configuration

### API (`backend/.env`)

| Variable                                                      | Purpose                                                                                                                                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                | PostgreSQL connection string (**required**)                                                                                                                                   |
| `DATABASE_SSL`                                                | `true` if the database needs SSL                                                                                                                                              |
| `NODE_ENV`                                                    | `development` or `production`                                                                                                                                                 |
| `HOST`, `PORT`                                                | Listen address. In production it defaults to `0.0.0.0`, locally to `127.0.0.1:8000`                                                                                           |
| `FRONTEND_ORIGIN`                                             | Comma-separated web app addresses allowed by CORS                                                                                                                             |
| `AUTO_MIGRATE`                                                | `true` applies pending migrations at start-up (on by default in development)                                                                                                  |
| `CREDENTIAL_KEY`                                              | 32-byte base64 key, so admins can reveal their access code later                                                                                                              |
| `SESSION_DAYS`, `FARMER_SESSION_DAYS`                         | Session lifetimes (farmers: long, because they work offline)                                                                                                                  |
| `BCRYPT_COST`                                                 | PIN hashing cost (default 10)                                                                                                                                                 |
| `SMS_PROVIDER`                                                | `disabled`, `console`, `twilio` or `africastalking`, for PIN reset and announcements by SMS                                                                                   |
| `ANNOUNCEMENT_SMS_LIMIT`                                      | Most SMS one announcement may send (default 1000)                                                                                                                             |
| `MARKET_MIN_FARMERS`, `MARKET_MIN_SALES` | How many different farmers and sales a market price needs before it is shown (default 3 and 3) |
| `WEATHER_CACHE_MINUTES` | How long one county's forecast is reused before asking again (default 30) |
| `WEATHER_API_URL` | Forecast service address (default Open-Meteo). Set `WEATHER_PROVIDER=off` to turn weather off |
| `WEATHER_ALERTS`, `WEATHER_ALERT_HOURS`, `WEATHER_ALERT_MM` | Heavy-rain alerts: `off` to stop them, how often to check (default 6 hours), and how many mm of rain in a day counts as heavy (default 30) |
| `USSD_SECRET` | Turns on the USSD menu. The gateway must call `/api/ussd?key=<USSD_SECRET>`; without it the address answers 404 |
| `DEMO_ADMIN_ACCESS_CODE`, `DEMO_ADMIN_PIN`                    | Shared tester login shown on the home page. The server keeps this admin working; it cannot change its code or PIN or send SMS. Delete both and the next start switches it off |
| `ADMIN_NAME`, `ADMIN_ACCESS_CODE`, `ADMIN_PIN`, `ADMIN_PHONE` | Creates the first admin at start-up while none exists                                                                                                                         |

### Web app (`frontend/.env`)

| Variable          | Purpose                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`    | The API's address, only when the API is hosted at a different address. No `/api`, no trailing slash |
| `VITE_PUBLIC_URL` | Public address used in Harvest Passport links, QR codes and printed tags                            |

Vite builds these into the app, so rebuild after changing them.

## Scripts

| Where       | Command                              | What it does                                          |
| ----------- | ------------------------------------ | ----------------------------------------------------- |
| `backend/`  | `npm run dev`                        | API with auto-reload                                  |
| `backend/`  | `npm start`                          | API for production                                    |
| `backend/`  | `npm run migrate`                    | Apply database migrations                             |
| `backend/`  | `npm run admin:create -- --name "…"` | Create an admin (prints the access code and PIN once) |
| `backend/`  | `npm run seed:demo`                  | Load demo farmers, harvests, sales and cooperatives   |
| `backend/`  | `npm test`                           | API tests                                             |
| `frontend/` | `npm run dev` / `build` / `preview`  | Web app                                               |
| `frontend/` | `npm test`                           | Web app tests                                         |
| root        | `npm test`                           | Both test suites                                      |

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

The API tests use `DATABASE_URL`, or `postgres://postgres@127.0.0.1:5433/minders_test` if it isn't set. **Point them at a separate test database**: the tests create and remove their own data and will clash with existing records.

## Deployment

FarmBok runs on Railway as three services: Backend (`/backend`), Frontend (`/frontend`) and Postgres. Each `git push` to `main` redeploys automatically. **[DEPLOY.md](DEPLOY.md)** lists every variable, how to create the first admin, and fixes for CORS and 502 errors.

## USSD setup (Africa's Talking)

1. In Africa's Talking, create a USSD channel (a sandbox code works for testing, for example `*384*1234#`).
2. On the Backend service, set `USSD_SECRET` to a long random text.
3. Set the channel's callback URL to `https://<your-backend>/api/ussd?key=<USSD_SECRET>`.
4. Dial the code. A new number gets "Make my account"; a known number is asked for its PIN, then sees the menu.

The menu keeps no session on the server: each screen is worked out from the answers so far. A retried "save" in the same USSD session saves only once.

## Security and privacy

- PINs and security answers are stored only as bcrypt hashes. Admin access codes are stored hashed, plus encrypted if `CREDENTIAL_KEY` is set.
- Accounts lock for a while after repeated wrong PINs, and sign-in and recovery are rate-limited.
- Each farmer can only read and change their own records; this is checked on the server for every request.
- Harvest Passports are off until the farmer turns them on, and never show the farmer's phone number or full name.
- Admin access to farmer data is written to an audit log, and phone numbers are masked in exports.
- Secrets live in `.env` files and hosting variables, never in git (see `.gitignore`).

## Roadmap

- Kpelle and Bassa voice
- Phone pop-up notifications while the app is closed (web push)
- 4-week pilot with 10–20 farmers and a partner cooperative in Bong County

## Team

**Team 5 (Minders)**: RETRAP AgTech Hackathon

| Name                  | Role             |
| --------------------- | ---------------- |
| Nehemiah Happie Flomo | Team Lead        |
| Christian A. Harris   | Tech Lead        |
| Daniella F.K. Makundu | Agriculture Lead |
| King S. Gedegar       | Design Lead      |
| Michael T. Butler     | Pitch Lead       |

## Photo credits

The welcome page uses real photos of farming in Liberia from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Agriculture_in_Liberia), all under free licences (CC BY / CC BY-SA). Each photo links to its Commons page, which names the photographer and licence, and the credits are shown in the page footer. The list lives in `frontend/src/lib/homePhotos.js`; to use your own photos, put them in `frontend/public/photos/` and change `src` there.

## License

[MIT](LICENSE) © 2026 teamfive970
