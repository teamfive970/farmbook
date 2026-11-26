<div align="center">

# 🌱 FarmBok

**Simple farm records for smallholder farmers in Liberia.**
Pictures and voice instead of typing. Works without network. Works on a smartphone, on a simple button phone (USSD) or by phone call. Shows the farmer their profit.

[Live app](https://farmbok.up.railway.app) · [Deploying](DEPLOY.md) · [License](LICENSE)

_Team 5 (Minders) · RETRAP AgTech Hackathon · Challenge 2: Digital Farm Records & Quality Management_

</div>

---

## Contents

- [Why FarmBok](#why-farmbok)
- [Feature status](#feature-status)
- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started (local)](#getting-started-local)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [USSD and voice menu setup](#ussd-and-voice-menu-setup)
- [Languages](#languages)
- [Welcome page pictures](#welcome-page-pictures)
- [Security and privacy](#security-and-privacy)
- [Roadmap](#roadmap)
- [Team](#team)

## Why FarmBok

Most smallholder farmers keep their records across exercise books, spreadsheets and memory, or keep none at all. Without organized records, a farmer cannot see their profit, learn from past seasons, prove to a buyer where and how a crop was grown, or show a lender that the farm is doing well.

FarmBok puts one simple record book on the phone the farmer already has:

> **Farmers record once. Everyone who needs to know, knows.**
> The farmer sees their profit, the buyer gets a Harvest Passport, the lender gets a farm record, and cooperatives and the Ministry get live totals.

## Feature status

| Feature | Status | Where |
| --- | --- | --- |
| Online sign-up and sign-in | ✅ Done | App |
| USSD sign-up and sign-in | ✅ Done | USSD menu |
| Voice menu over a phone call (USSD voice) | ✅ Done | Call FarmBok |
| Farmers without a smartphone use FarmBok by USSD and SMS | ✅ Done | USSD menu, SMS alerts |
| Weather updates (in-app, SMS, USSD) | ✅ Done | Weather page, heavy-rain SMS, USSD weather |
| Real-time market prices (in-app, SMS, USSD) | ✅ Done | Market prices, weekly price SMS, USSD |
| Connecting farmers to market places | ✅ Done | FarmBok market |
| Buyers contact farmers directly | ✅ Done | "Contact this farmer" |
| Buyers find farmers without scanning a passport | ✅ Done | Harvests for sale |
| Buyers see the farm on a map from the passport | ✅ Done | Farm location and passport map |
| Harvest photo proof on the passport, profile photo | ✅ Done | Harvest page, Me page |
| Links to e-advisory platforms | ✅ Done | Farm advice |
| AI analysis of farmer records | ✅ Done | My farm insights |
| Micro-finance and loan organizations | ✅ Done | Show my record to a lender |
| Translation into Liberian languages (per farmer) | 🟡 Ready for translators | Me → Language (word packs need native speakers) |

## Features

### Recording the farm

- **Record work in a few taps:** pick the farm, the work and the day from pictures. No typing needed.
- **Works offline:** every record saves on the phone first and is sent when network returns. Sign-in also works offline after the first online sign-in.
- **Talk to me:** every screen can be read out loud in simple Liberian English. On-screen text uses simple standard English.
- **Crops, animals or mixed farms:** each planting and each animal group keeps its own history.
- **Farm location:** standing on the farm, the farmer taps "Save my farm location". GPS works without network.
- **Harvests with quality grades,** linked to the planting or herd they came from.
- **Harvest photos:** up to 4 photos as proof of the produce, taken when the harvest is recorded or later. Photos taken without network wait on the phone and are sent after the harvest.
- **Profile photo** on the Me page (shown in the app, never to buyers).
- **Shared phones:** several farmers can use one phone, each with a private profile and PIN.
- **PIN recovery** by a security question, or by SMS when configured.

### Money and insights

- **Money:** sales, payments and costs in **L$ and US$, kept apart**, with profit by farm, crop and animal group. A farmer cannot sell more than was harvested.
- **Farm report:** one tap to save as **PDF** (to print or share) or **CSV** (Excel).
- **Compare seasons:** this season next to the one before (or this year against the same time last year), crop by crop and animal group by animal group. Shows harvest, money in, costs, profit, share of grade A and animals lost, with up and down arrows and up to three plain sentences about what changed. Worked out on the phone, so it works offline.
- **My farm insights:** what changed this season (last 6 months) next to the season before, in plain words: profit, costs that went up or down ("you spent 50% more on fertilizer"), harvest changes, selling below or above the county market price, and gaps in records. Simple rules always work. If `ANTHROPIC_API_KEY` is set, an AI model also writes a short summary from the same numbers (no name or phone is sent), labelled "Written by AI".
- **Show my record to a lender:** the farmer makes a private link (code `CR-…`) for a micro-finance group, bank, VSLA or cooperative. Without signing in, the lender sees the last 12 months: money in and costs month by month, profit, harvests, sales and how many were fully paid, quality grades, group membership and how regularly records are kept, ready to print or save as PDF. The farmer chooses whether to show full name and phone and how long the link works (1 week, 1 month or 3 months), sees how often it was opened, and can stop it at any time.

### Selling

- **Harvest Passport:** a QR code and printable product tag for each harvest. Buyers scan it to see where and how the crop was grown, its grade, the farm work before harvest and the farmer's harvest photos. The farmer decides whether to share it; the farmer's phone number and full name are never shown.
- **Passport map:** if the farmer turns on "Show my farm area to buyers", the passport shows the farm area on a map, rounded to about 1 km, with a directions button. Otherwise buyers get a map search for the town.
- **Contact this farmer:** a buyer who scans a passport can leave their name, number, quantity and a message. The farmer is told in Messages (and by SMS if they allow it) and, from **Buyer requests**, can call, text, share their own number (sent to the buyer by SMS) or say "not now".
- **FarmBok market** (`/market`, public, linked from the home page and every passport):
  - **Harvests for sale:** every harvest whose passport is on and that still has some left, with crop, grade, county and first name. Buyers filter by crop, county and grade, then tap **Contact**. No phone numbers are shown; harvests that failed their quality check are left out.
  - **Market prices:** the typical price per unit and usual range from sales FarmBok farmers recorded in the last 60 days, by county, with the change against the 60 days before. A price only shows when at least 3 different farmers sold that crop, so no single farmer's price can be worked out. Farmers find it under Money → Market prices.
- **Market prices by SMS:** farmers can switch on a weekly text of what crops sell for in their county (in Messages, or option 6 on USSD). Off by default. A county with too few sales gets prices for all of Liberia, and nothing is sent when there are no prices. A copy also goes to the app inbox.

### Weather, advice and messages

- **Weather:** a 7-day forecast for the farmer's county (rain, heat, wind) on the Home screen and a Weather page, with simple advice such as "rain is coming, do not spray now" or "dry days, good time to dry your rice". The last forecast stays on the phone for offline use. Data from Open-Meteo, shared per county and cached on the server.
- **Heavy-rain alerts:** a few times a day the server checks the forecast for every county with farmers. When heavy rain is coming in the next three days, each farmer there gets one message in the app, and one SMS if they allow SMS. The same rain day never alerts twice.
- **Farm advice:** links to extension officers (Ministry of Agriculture county contacts) and free, trusted advice: RiceAdvice (AfricaRice), farmer training videos (Access Agriculture), pest and disease factsheets (CABI PlantwisePlus), the Ministry's cocoa field-school manual and FAO Liberia. Advice for the farmer's own crops comes first. The list is in `frontend/src/lib/advisory.js`.
- **Messages:** one inbox with a bell and unread count, holding news from the Ministry and the farmer's group, weather and price messages, and smart reminders worked out from the farmer's own records:
  - no work recorded for 3 days
  - money still owed a week after a sale
  - a grade A or B harvest whose Harvest Passport is still off

  Reminders disappear by themselves once the job is done. The last inbox is kept on the phone, so it opens offline. Farmers choose whether important news may also come by SMS.

### For farmers without a smartphone

- **USSD (any phone):** dial a short code to make an account, sign in with a PIN, record farm work, and see the weather, market prices, messages and money, or switch the weekly price SMS on and off. It is the same account as the app, and wrong PINs count toward the same lock.
- **Voice menu (call FarmBok):** call a FarmBok number and hear the same menu, spoken, pressing keys on the phone. Made for farmers who cannot read a screen. New callers are told to sign up by USSD (a name cannot be typed with keys). Sentences recorded by a real person (Liberian English, Kpelle, …) are played instead of the computer voice; see [Recorded voice clips](#recorded-voice-clips).
- **SMS:** heavy-rain alerts, weekly market prices, buyer requests and announcements.

### Languages

- **Me → Language** lets each farmer choose the language of the words on screen. Kpelle, Bassa, Dan (Gio), Mano, Kru, Loma, Vai, Kissi, Grebo, Gola, Mandingo and Krahn appear as soon as native speakers fill in their word pack. Untranslated words stay in English, and recorded voice clips in a language are played by "Talk to me". No machine translation is used. See [Languages](#languages).

### For cooperatives and the Ministry of Agriculture

- **Admin dashboard** with live charts by county, crop and month, in L$ or US$.
- **Farmer management:** search, filter, view, edit and reactivate farmers.
- **Cooperatives:** groups with join codes, members and group totals.
- **CSV exports** and an **audit log** of admin actions. Farmer phone numbers stay masked.
- **Announcements:** send a message to all farmers, one county or one group. It lands in each farmer's Messages, and by SMS to farmers who allow it. The screen shows how many farmers it will reach before sending, and afterwards how many read it plus SMS sent, failed or skipped. Every announcement is written to the audit log.
- **Tester login:** an optional shared admin login for judges, shown on the home page (`DEMO_ADMIN_*`).

## How it works

```
 Phone (PWA)                          Server                     Database
┌──────────────────────┐   sync    ┌──────────────────────┐   ┌────────────┐
│ React app            │ ───────▶  │ Express API          │──▶│ PostgreSQL │
│ IndexedDB  (records) │ ◀───────  │ auth · rules · money │   └────────────┘
│ Sync queue (offline) │           │ reports · passports  │
│ Photo queue          │           │ market · insights    │
└──────────────────────┘           │ admin analytics      │
                                   └──────────┬───────────┘
 Button phone ── USSD / voice call ──▶ Africa's Talking ──┘
 Weather ◀── Open-Meteo        SMS ──▶ Africa's Talking or Twilio
```

1. Every change is written to **IndexedDB** on the phone and added to a **sync queue**.
2. When the phone is online, the queue sends changes in order. Each record carries a client ID, so a retry never creates a duplicate.
3. The server checks every rule again (ownership, money limits, harvest quantities) before saving to **PostgreSQL**.
4. USSD and voice calls reach the same API through Africa's Talking, so a farmer has one account whatever phone they use.
5. Cooperatives and the Ministry see the totals of the synced records.

## Tech stack

| Layer    | Technology                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------ |
| Web app  | React 18, Vite 6, Tailwind CSS 4, React Router, `idb` (IndexedDB), lucide icons, installable PWA |
| API      | Node.js ≥ 20, Express 5, `pg`, bcrypt PIN hashing, Helmet, rate limiting                         |
| Database | PostgreSQL, with versioned SQL migrations (photos are stored here too)                           |
| Services | Open-Meteo (weather), Africa's Talking (SMS, USSD, voice) or Twilio (SMS), optional Anthropic API (insights summary) |
| Hosting  | Railway: Backend, Frontend and Postgres services                                                 |

## Project structure

```
farmbook/
├── backend/                 Express API
│   ├── db/migrations/       SQL migrations (001 … 017), applied in order
│   ├── scripts/             migrate · create-admin · seed-demo · voice-script
│   ├── voice-clips/         recorded voice menu clips, one folder per language
│   ├── src/
│   │   ├── routes/          auth, farms, activities, records, reports, passport, market, photos,
│   │   │                    notifications, buyer requests, weather, insights, credit, USSD, voice, admin
│   │   ├── services/        business rules and queries
│   │   ├── middleware/      auth, rate limits, errors
│   │   └── lib/             PINs, tokens, encryption, lockout, SMS, photo cleaning, audit
│   └── tests/               node:test suites
├── frontend/                React web app (PWA)
│   ├── public/
│   │   ├── i18n/            language word packs and the translators' guide
│   │   ├── audio/           recorded voice clips
│   │   └── images/home/     welcome page pictures
│   ├── scripts/             i18n-export · i18n-import (translation sheets)
│   └── src/
│       ├── pages/           public pages (welcome, passport, market, lender record)
│       ├── pages/farmer/    farmer screens
│       ├── pages/admin/     admin screens
│       ├── lib/             sync engine, offline store, photos, reports, QR, voice, words, languages
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

Everything runs with only `DATABASE_URL` set. The other variables switch on extra features or change defaults.

### API (`backend/.env`, or the Backend service on Railway)

**Core**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (**required**) |
| `DATABASE_SSL` | `true` if the database needs SSL |
| `NODE_ENV` | `development` or `production` |
| `HOST`, `PORT` | Listen address. In production it defaults to `0.0.0.0`, locally to `127.0.0.1:8000` |
| `FRONTEND_ORIGIN` | Comma-separated web app addresses allowed by CORS |
| `AUTO_MIGRATE` | `true` applies pending migrations at start-up (on by default in development) |
| `CREDENTIAL_KEY` | 32-byte base64 key, so admins can reveal their access code later |
| `SESSION_DAYS`, `FARMER_SESSION_DAYS` | Session lifetimes (farmers: long, because they work offline) |
| `BCRYPT_COST` | PIN hashing cost (default 10) |

**Admins**

| Variable | Purpose |
| --- | --- |
| `ADMIN_NAME`, `ADMIN_ACCESS_CODE`, `ADMIN_PIN`, `ADMIN_PHONE` | Creates the first admin at start-up while none exists |
| `DEMO_ADMIN_ACCESS_CODE`, `DEMO_ADMIN_PIN` | Shared tester login shown on the home page. The server keeps this admin working; it cannot change its code or PIN or send SMS. Delete both and the next start switches it off |

**SMS** (PIN reset, announcements, buyer requests, rain alerts, weekly prices)

| Variable | Purpose |
| --- | --- |
| `SMS_PROVIDER` | `disabled`, `console` (prints to the log, not allowed in production), `twilio` or `africastalking` |
| `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` | Africa's Talking account |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Twilio account |
| `ANNOUNCEMENT_SMS_LIMIT` | Most SMS one announcement may send (default 1000) |

**Market, weather and prices**

| Variable | Purpose |
| --- | --- |
| `MARKET_MIN_FARMERS`, `MARKET_MIN_SALES` | How many different farmers and sales a market price needs before it is shown (default 3 and 3) |
| `WEATHER_CACHE_MINUTES` | How long one county's forecast is reused (default 30) |
| `WEATHER_API_URL`, `WEATHER_PROVIDER` | Forecast service address (default Open-Meteo); `WEATHER_PROVIDER=off` turns weather off |
| `WEATHER_ALERTS`, `WEATHER_ALERT_HOURS`, `WEATHER_ALERT_MM` | Heavy-rain alerts: `off` to stop them, how often to check (default 6 hours), how many mm of rain in a day counts as heavy (default 30) |
| `PRICE_SMS`, `PRICE_SMS_CHECK_HOURS` | Weekly price SMS: `off` to stop it; how often to look for farmers due (default 3 hours; texts only go out 08:00–18:00 Liberia time) |

**USSD, voice and AI**

| Variable | Purpose |
| --- | --- |
| `USSD_SECRET` | Turns on the USSD menu. The gateway must call `/api/ussd?key=<USSD_SECRET>`; without it the address answers 404 |
| `VOICE_SECRET` | Turns on the voice menu. The gateway must call `/api/voice?key=<VOICE_SECRET>` |
| `PUBLIC_API_URL` | This backend's public address, used in the voice menu's next-step links |
| `VOICE_SAY_VOICE` | `woman` (default) or `man` |
| `VOICE_CLIP_LANG` | Folder of recorded clips to play in the voice menu, e.g. `en-lr` (default) or `kpe` |
| `ANTHROPIC_API_KEY` | Turns on the AI summary in My farm insights. Without it the page uses simple rules only |
| `INSIGHTS_MODEL`, `INSIGHTS_AI` | AI model (default `claude-haiku-5-5`); `INSIGHTS_AI=off` turns the AI off even with a key |

### Web app (`frontend/.env`, or the Frontend service on Railway)

| Variable          | Purpose                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`    | The API's address, only when the API is hosted at a different address. No `/api`, no trailing slash |
| `VITE_PUBLIC_URL` | Public address used in Harvest Passport links, lender links, QR codes and printed tags              |

Vite builds these into the app, so rebuild after changing them.

## Scripts

| Where       | Command                                   | What it does                                          |
| ----------- | ----------------------------------------- | ----------------------------------------------------- |
| `backend/`  | `npm run dev`                             | API with auto-reload                                  |
| `backend/`  | `npm start`                               | API for production                                    |
| `backend/`  | `npm run migrate`                         | Apply database migrations                             |
| `backend/`  | `npm run admin:create -- --name "…"`      | Create an admin (prints the access code and PIN once) |
| `backend/`  | `npm run seed:demo`                       | Load demo farmers, harvests, sales and cooperatives   |
| `backend/`  | `npm test`                                | API tests                                             |
| `backend/`  | `npm run voice:script`                    | List the voice menu sentences to record, with file names |
| `frontend/` | `npm run dev` / `build` / `preview`       | Web app                                               |
| `frontend/` | `npm test`                                | Web app tests                                         |
| `frontend/` | `npm run i18n:export -- <language>`       | Make the translation sheet for a language             |
| `frontend/` | `npm run i18n:import -- <language> <csv>` | Load a filled-in translation sheet into the app       |
| root        | `npm test`                                | Both test suites                                      |

## Testing

```bash
cd backend && npm test
cd frontend && npm test
```

The API tests use `DATABASE_URL`, or `postgres://postgres@127.0.0.1:5433/minders_test` if it isn't set. **Point them at a separate test database**: the tests create and remove their own data and will clash with existing records. Outside services (weather, SMS, AI) are replaced by test stand-ins, so the tests need no network.

## Deployment

FarmBok runs on Railway as three services: Backend (`/backend`), Frontend (`/frontend`) and Postgres. Each `git push` to `main` redeploys automatically, and with `AUTO_MIGRATE=true` new database migrations apply by themselves. **[DEPLOY.md](DEPLOY.md)** lists every variable, how to create the first admin, and fixes for CORS and 502 errors.

## USSD and voice menu setup

### USSD (Africa's Talking)

1. In Africa's Talking, create a USSD channel (a sandbox code works for testing, for example `*384*1234#`).
2. On the Backend service, set `USSD_SECRET` to a long random text.
3. Set the channel's callback URL to `https://<your-backend>/api/ussd?key=<USSD_SECRET>`.
4. Dial the code. A new number gets "Make my account"; a known number is asked for its PIN, then sees the menu.

The menu keeps no session on the server: each screen is worked out from the answers so far. A retried "save" in the same USSD session saves only once.

### Voice menu (Africa's Talking Voice)

1. Ask Africa's Talking for a voice number (voice@africastalking.com) on a live application.
2. On the Backend service, set `VOICE_SECRET` to a long random text and `PUBLIC_API_URL=https://<your-backend>`.
3. Set the voice number's callback URL to `https://<your-backend>/api/voice?key=<VOICE_SECRET>`.
4. Call the number. The menu is the same as USSD, spoken; farmers type their PIN and press #. The keys pressed are kept in the server's memory for the call only (never in a URL).

### Recorded voice clips

The voice menu reads each sentence with the computer voice unless a recording of it exists. To use real voices:

1. Run `npm run voice:script` in `backend/`. It writes `backend/voice-clips/RECORDING-SCRIPT.md`: every fixed sentence (about 80) with the file name its recording needs, for example `press-1-for-record-farm-work.mp3`.
2. Record each sentence as its own short MP3 or WAV file and put it in `backend/voice-clips/<language>/`, e.g. `en-lr/` for Liberian English or `kpe/` for Kpelle. In another language, say the meaning; the file name stays the English one.
3. Commit the files and deploy. Set `VOICE_CLIP_LANG` to the folder to use (default `en-lr`).

Clips can be added a few at a time: any sentence without a clip, and any sentence with a name, price or date in it, is still read by the computer voice. The backend serves the clips to Africa's Talking at `/api/voice/clips/<language>/<file>`. Run `npm run voice:script` again after changing the USSD or voice menu: it shows which sentences are recorded and which still need a clip.

## Languages

Translations must come from native speakers and be checked by a second speaker. The full guide is in [`frontend/public/i18n/README.md`](frontend/public/i18n/README.md). In short:

1. `npm run i18n:export -- kpelle` makes `translations/kpelle.csv` (about 400 short phrases).
2. A native speaker fills in the "translation" column in Excel or Google Sheets.
3. `npm run i18n:import -- kpelle translations/kpelle.csv "Checked by: …"` adds it to the app. Commit and deploy.
4. Optional: record each phrase and put the clips in `frontend/public/audio/kpelle/` (for example `welcome.title.mp3`), then import again. "Talk to me" plays the recordings.

## Welcome page pictures

The welcome page uses FarmBok's own pictures, stored with the app in `frontend/public/images/home/`. Each comes in two sizes (800 and 1600 pixels wide, WebP), so phones download the small one and nothing comes from another website.

| Picture | Where it is used |
| --- | --- |
| `profit` (harvest summary and profit) | Top of the page, phone and computer |
| `journal` (farm work, day by day) | "Farm work, day by day" |
| `passport` (Harvest Passport tag and QR check) | "Harvest Passport for buyers" |
| `market` (harvests for sale and fair prices) | FarmBok market section |

To change one, replace both files with the same names, or edit `frontend/src/lib/homePhotos.js`.

## Security and privacy

- PINs and security answers are stored only as bcrypt hashes. Admin access codes are stored hashed, plus encrypted if `CREDENTIAL_KEY` is set.
- Accounts lock for a while after repeated wrong PINs, on the app, USSD and voice alike. Sign-in and recovery are rate-limited.
- Each farmer can only read and change their own records; this is checked on the server for every request.
- Harvest Passports are off until the farmer turns them on, and never show the farmer's phone number or full name. Harvest photos are only visible while the passport is on.
- The farm's map point is shown to buyers only if the farmer allows it, and only rounded to about 1 km.
- Photos are made small on the phone, and the server removes hidden data (EXIF: GPS position, phone model) before saving.
- Market prices only show when at least 3 farmers sold a crop, so no single farmer's price can be worked out.
- Lender links are private, expire, can be stopped at any time, and show the name and phone only if the farmer chooses.
- The AI summary receives numbers only, never the farmer's name or phone.
- USSD and voice gateways must present a secret key; without it those addresses answer 404.
- Admin access to farmer data is written to an audit log, and phone numbers are masked in exports.
- Secrets live in `.env` files and hosting variables, never in git (see `.gitignore`).

## Roadmap

- Word packs and recorded voice for Kpelle and Bassa first, with native speakers from the pilot area
- Phone pop-up notifications while the app is closed (web push)
- Record the voice menu clips in Liberian English and Kpelle (support is built in)
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

## License

[MIT](LICENSE) © 2026 teamfive970
