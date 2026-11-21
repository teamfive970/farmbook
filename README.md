# Farmbook

**Team 5 · RETRAP AgTech Innovation Hackathon · Challenge 2: Digital Farm Records & Quality Management**

An offline, picture-based phone ledger for smallholder crop farmers in Liberia. Each farm activity is recorded **once**, with **no reading or typing**, and that single record:

1. **Builds the farmer's ledger:** costs, harvest and sales.
2. **Shows their profit:** money in, money out and profit for the season, read aloud.
3. **Creates a trace for buyers:** a QR code per sold batch, linked to the plot's GPS outline, activities and dates. For export crops (cocoa, coffee, rubber, palm oil) this supports the EU deforestation rules (EUDR).

## The problem

Smallholder farmers either keep no farm records, or keep them so disorganised they can't be used. So they can't see whether they're making money, repeat what worked, or prove to buyers where and how their crop was grown.

## How it works

| Step | Farmer does (no text) | Result |
|---|---|---|
| 1 | Taps their photo, picks the crop, walks the plot edge | Farm profile + plot GPS outline |
| 2 | Taps a work picture, enters the cost on a number pad | Ledger entry + trace entry |
| 3 | Taps harvest, enters bags | Harvest recorded |
| 4 | Taps sale, enters bags and price, taps buyer | Money in + QR code for the batch |
| 5 | Shows QR to the buyer | Buyer scans and sees farm, plot map, activities, dates |
| 6 | Taps the speaker on the summary | Hears money in, money out and profit |

Every entry is read back aloud before saving, and stamped automatically with date, time and GPS.

## Architecture

```
┌──────────────────────────┐         when signal returns        ┌──────────────────────────┐
│  Phone app (PWA)         │  ───────── POST /entries ────────▶ │  Backend (Python)        │
│  frontend/               │                                    │  backend/                │
│  - works fully offline   │                                    │  - FastAPI + SQLite      │
│  - Dexie (IndexedDB)     │                                    │  - sync API              │
│  - GPS, read-back, QR    │                                    │  - /trace/{batch_id}     │
└──────────────────────────┘                                    │    buyer scan page       │
                                                                └──────────────────────────┘
```

- **Offline first:** everything is saved on the phone first; sync happens in the background when there is signal.
- **No duplicates:** every record gets a UUID on the phone, so re-sending is safe.
- **QR works offline too:** the QR code carries the key facts (farm, plot, crop, harvest date, bags) as well as the link.

## Tech stack

| Part | Tool |
|---|---|
| Phone app | JavaScript PWA (Vite), Dexie.js, browser Geolocation, speechSynthesis, MediaRecorder, `qrcode` |
| Backend | Python 3.11+, FastAPI, SQLite, Jinja2 (scan page) |
| Maps | Leaflet + OpenStreetMap |

## Repository layout

```
frontend/   Phone app (PWA)
backend/    FastAPI server: sync API + buyer scan page
docs/       Workbook notes, sample data, demo script
```

## Getting started

_Setup instructions will be added as each part is built._

### Backend (Python)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> The app must be served over **HTTPS** on a real phone for offline mode, GPS and the microphone to work.

## Demo data

The demo uses a **sample** season of lowland rice (1 hectare): 44,500 LRD costs, 89,800 LRD sales, 45,300 LRD profit. It is clearly labelled as sample data, not real farmer records.

## Team

| Role | Name |
|---|---|
| Team lead | |
| Tech lead | |
| Agriculture lead | |
| Design lead | |
| Pitch lead | |

## License

MIT. See [LICENSE](LICENSE).

Map data © OpenStreetMap contributors.
