# USSD and voice menu (IVR)

FarmBok has three ways in to the same farm records: the **app**, **USSD** (any phone, no data) and the **voice menu / IVR** (a phone call, keys on the keypad). All three save through the same backend services, so a harvest recorded by USSD or by voice is in the farmer's app, the reports, the Ministry dashboard and the market prices like any other.

This page covers how it is built, how to test it **without paying for anything**, and how to connect a real telephone line later.

- [What works today](#what-works-today)
- [Architecture](#architecture)
- [USSD menu](#ussd-menu)
- [Voice menu (IVR) call flow](#voice-menu-ivr-call-flow)
- [Browser IVR simulator](#browser-ivr-simulator)
- [Testing without paid services](#testing-without-paid-services)
- [Africa's Talking USSD sandbox](#africas-talking-ussd-sandbox)
- [Languages and recorded prompts](#languages-and-recorded-prompts)
- [Sessions and security](#sessions-and-security)
- [Environment variables](#environment-variables)
- [Database migration](#database-migration)
- [API endpoints](#api-endpoints)
- [Automated tests](#automated-tests)
- [Connecting a live voice provider later](#connecting-a-live-voice-provider-later)

## What works today

| Channel | Status |
| --- | --- |
| USSD with Africa's Talking (sandbox and live) | Works. Tested against the request format the sandbox sends |
| Voice menu in the browser simulator | Works. Runs the real menu and saves real records |
| Voice menu over a real phone call | **Not live.** The Africa's Talking Voice adapter is built and tested with sample callbacks, but no voice number is configured. According to the project brief, Africa's Talking Voice does not list Liberia among its markets and its voice sandbox is not working, so real calls need a supported provider and number first |
| Kpelle and Bassa voice prompts | **Not available yet.** The language can be chosen; the prompts fall back to English and are marked missing until native speakers translate and record them |

## Architecture

```
 Button phone ─USSD─▶ Africa's Talking ─▶ /api/ussd ──────────┐
 Phone call ─voice─▶ (future provider) ─▶ /api/voice ─ adapter ─┤
 Browser ─────────── IVR simulator page ─▶ /api/voice/simulator ┤
                                                                ▼
                    channels/menu.js  (one menu for USSD and voice)
                    channels/sessions.js  (Postgres sessions)
                    channels/prompts.js + voice-prompts/*.json  (words)
                                   │
         existing services: activityService, resourceService (harvests,
         sales, payments, expenses), reportService, weatherService,
         marketService, notificationService, authService
                                   │
                               PostgreSQL
```

| File | Job |
| --- | --- |
| `backend/src/channels/menu.js` | The menu: sign-in, farm activities, harvest, sales, summary, weather, prices, advice, notifications, help. Every save goes through the app's own services |
| `backend/src/channels/sessions.js` | USSD sessions and calls in Postgres: create, read, update, expire, end, lock per session |
| `backend/src/channels/prompts.js` | Prompt packs (`backend/voice-prompts/<language>.json`) and the English fallback |
| `backend/src/channels/render.js` | Screen → USSD text (182 characters max), or → voice prompts (recording or computer voice) |
| `backend/src/channels/ivr.js` | One step of a call, whatever the provider |
| `backend/src/channels/providers/africastalking.js` | Africa's Talking Voice callbacks and XML |
| `backend/src/channels/providers/simulator.js` | The browser simulator's call tokens and JSON |
| `backend/src/services/ussdService.js` | USSD requests (Africa's Talking format) |
| `backend/src/services/voiceService.js` | Voice provider choice, simulator calls |
| `backend/src/services/demoFarmerService.js` | Demo farmers for the simulator's demo mode |
| `frontend/src/pages/IvrSimulator.jsx` | The simulator page at `/ivr-simulator` |

The menu is worked out from the list of answers given so far (the way Africa's Talking sends USSD), so the same answers always lead to the same screen. Anything that changes data runs **once per session** (`ctx.once`), so a provider retry or a double tap never saves twice.

## USSD menu

A farmer who is not registered sees:

```
Welcome to FarmBok.
1. Make my account   → name, county, district, town, PIN, PIN again
2. Weather           → county → today and tomorrow
3. Market prices
4. Help
```

A registered farmer types their PIN, then:

```
Welcome to FarmBok.
1. Farm Activities      → farm → work (8 kinds) → day (today / yesterday / DDMM) → note or 0 → Save / Cancel
2. Record Harvest       → farm → crop (from the farm) → amount → unit → day → Save / Cancel
3. Record Sales         → harvest with stock → amount (not more than is left) → price per unit
                          → L$ / US$ → paid now / not yet → cost for the sale or 0 → (cost type) → Save / Cancel
4. Farm Summary         → 1 Money (income, expenses, profit) · 2 Harvests · 3 Recent sales
5. Weather Information  → the farmer's county: rain, rainfall in mm, temperatures, a farm tip
6. Market Prices        → from sales FarmBok farmers recorded, labelled "not outside-checked"
7. Notifications        → 1 Read new messages · 2 Weekly price SMS on/off
8. Help
0. Exit                 → signs out and ends the session
```

- A sale paid now also saves the payment; a cost is saved as an expense on the harvest. Profit in the app and on USSD/voice is worked out by the same `reportService`.
- Nothing is saved until **1. Save**. Cancelling, a wrong key, or walking away saves nothing.
- A wrong key ends with "Wrong choice. Please dial again." (USSD can't step back).

## Voice menu (IVR) call flow

```
"Welcome to FarmBok, your farm record assistant. Please select your preferred language."
  1 English · 2 Kpelle · 3 Bassa                    (saved on the farmer's profile)
"Hello <name>. Please type your FarmBok PIN on the phone keys, then press the hash key."
"Welcome to FarmBok. Please select an option."
  1 Farm activities   2 Record harvest   3 Record sale   4 Farm summary   5 Weather
  6 Market prices     7 Farm advice      8 Help          9 End the call
After each result: "Press 0 for the main menu. Press 9 to end the call."
```

- Numbers (amounts, prices, the PIN, dates) end with **#**. Menus take one key.
- A key that isn't on the menu: "That key is not on the menu." and the same question again.
- No key for 20 seconds (on a real call): "We did not hear any keys. Please call again. Goodbye."
- Callers whose number has no account are told to register by USSD or the app (a name can't be typed with keys).
- The summary reads income, expenses, profit, harvest totals and the last sales.
- Weather reads today, tomorrow and the next day: conditions, rainfall in millimetres and temperatures.
- Market prices say where they come from, and that no independently verified prices are in FarmBok yet.
- Farm advice reads only what FarmBok already has: the weather rules for the farmer's county, and the advice to talk to an extension officer. Nothing else is made up or claimed as expert-checked.

## Browser IVR simulator

Open **`/ivr-simulator`** on the web app (for example `https://farmbok.up.railway.app/ivr-simulator`). It's also linked from the testers box on the home page and from the admin menu ("Voice simulator").

1. Choose the mode:
   - **Demo**: pick a demo farmer (Musu Demo in Bong, Kollie Demo in Nimba). The demo PIN is shown on the page (`1234` unless `IVR_DEMO_PIN` is set).
   - **Development**: type the phone number of a FarmBok **test** account. Only on when `IVR_SIMULATOR_DEV=true`, or outside production.
2. Press the green call button. The page shows the call status (Connecting, Active call, Call completed), the timer, what FarmBok is saying, and a phone keypad (0–9, *, #). The computer's number keys and Enter (= #) work too.
3. Each prompt is labelled **Recorded audio** when a recording exists, or **English stand-in (computer voice)** when the browser reads the English words. Prompts in a language with no translation are labelled **Translation missing**.
4. "This call" shows what was said and pressed (PINs as "PIN entered (hidden)"). "Call history" lists the calls made on the page, with how many records each saved.
5. The red button hangs up; the circular arrow restarts.

Every simulated call is labelled "Simulated call · no phone line is used". Calls are stored like real calls (`channel_sessions`, provider `simulator`).

**Demo data stays separate.** Demo farmers have phone numbers starting `+231000`, which no real phone has, so nobody can sign in to the app or USSD as one, and they never block a real farmer's registration. They are marked `is_demo`, and the Ministry dashboard, the farmer list, analytics and exports, market prices, announcements, weekly price SMS and weather alerts all leave them out. Development mode refuses demo farmers, and demo mode refuses real ones.

## Testing without paid services

| What | How | Cost |
| --- | --- | --- |
| Voice menu | The browser simulator (above) | Free |
| USSD | Africa's Talking **sandbox** USSD simulator (below), or `curl` | Free |
| Everything, automatically | `cd backend && npm test` | Free |

USSD with `curl` against a local backend (`USSD_SECRET=dev-key`):

```bash
curl -X POST "http://localhost:8000/api/ussd?key=dev-key" \
  -d sessionId=test-1 -d serviceCode="*384*1#" -d phoneNumber=+231770000001 -d text="1234*2"
```

Each request sends the whole answer list so far (`text`, answers separated by `*`), exactly like the sandbox. Use a new `sessionId` for each new dial.

## Africa's Talking USSD sandbox

1. Sign in to [Africa's Talking](https://account.africastalking.com) and open the **sandbox** app.
2. USSD → Service codes → create a sandbox channel (for example `*384*1234#`).
3. Callback URL: `https://<your-backend>/api/ussd?key=<USSD_SECRET>` (the backend must be reachable on the internet, e.g. the Railway backend).
4. On the backend, set `USSD_SECRET` to a long random text.
5. Open the sandbox **simulator**, enter a phone number (`+231…` for a Liberian number), dial the code.

No API key is needed for USSD: Africa's Talking calls FarmBok and FarmBok answers. The API key (`AT_USERNAME`, `AT_API_KEY`) is only for sending SMS. Keep keys in Railway variables or `backend/.env`, never in code or in `.env.example`.

## Languages and recorded prompts

- Words: `backend/voice-prompts/en.json` (complete), `kpelle.json` and `bassa.json` (empty, marked `"_status": "missing"`). Same keys in every file.
- Recordings: `backend/voice-clips/<language>/<prompt key>.mp3`, e.g. `voice-clips/en/ivr.menu.title.mp3`.
- `npm run voice:script` (in `backend/`) writes `backend/voice-clips/RECORDING-SCRIPT.md`: every prompt to record, with its file name and the translation and recording status per language.
- Prompts with a name or number in them (e.g. "Hello {name}") are read by the computer voice.
- Kpelle and Bassa must be translated by native speakers and checked by a second speaker. No machine translation, and no computer voice pretending to speak them: until then the English words are used and marked missing.
- The farmer's language is kept on their profile (`farmers.preferred_language`). The voice menu sets it when the farmer chooses; the app sets it in **Me → Language** (`PUT /api/auth/language`).

## Sessions and security

- Sessions (USSD and calls) are rows in `channel_sessions`. They expire after 5 minutes (USSD) or 10 minutes (voice) without activity, and never last more than 30 minutes. A finished or expired session can't be continued ("Your session has ended. Please dial again.").
- Each step runs under a lock on its session, so a repeated callback waits for the first. A repeat of the same USSD request gets the same answer. A simulator key press sent twice (same `step`) is answered once.
- **PINs are never stored**: the voice session keeps "*" in place of the PIN; USSD keeps only a hash of the request. The PIN is checked once per session with the same lockout as the app (locked after 5 wrong tries).
- A USSD session belongs to the phone number that started it.
- `/api/ussd` and live `/api/voice` answer 404 without the right secret key. The simulator is rate-limited, and its call token is stored only as a hash.
- Server logs show one line per step, with the phone number shortened and PIN steps as `[pin]`. Set `CHANNEL_LOG=off` to turn them off.
- Old sessions are deleted after 30 days.

## Environment variables

Backend service (Railway → Backend → Variables, or `backend/.env`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `USSD_SECRET` | none (USSD off) | Turns on USSD. The callback URL carries it: `/api/ussd?key=…` |
| `USSD_SESSION_MINUTES` | `5` | Idle time before a USSD session expires |
| `IVR_SIMULATOR` | `on` | `off` hides the browser simulator |
| `IVR_SIMULATOR_DEV` | on outside production | `true` allows development mode (real test accounts) on a production server |
| `IVR_DEMO_PIN` | `1234` | PIN of the demo farmers (4–6 digits; it is shown publicly) |
| `VOICE_PROVIDER` | `none` (or `africastalking` if `VOICE_SECRET` is set) | Which company carries real calls |
| `VOICE_SECRET` | none | Secret in the live voice callback URL |
| `VOICE_SESSION_MINUTES` | `10` | Idle time before a call session expires |
| `VOICE_SAY_VOICE` | `woman` | Africa's Talking computer voice: `woman` or `man` |
| `PUBLIC_API_URL` | from the request | The backend's public address, used in callback and recording links |
| `VOICE_PROMPTS_DIR`, `VOICE_CLIPS_DIR` | `backend/voice-prompts`, `backend/voice-clips` | Other folders for words and recordings |
| `CHANNEL_LOG` | on | `off` stops the per-step log lines |

Nothing paid is switched on by default: with none of these set, USSD and live voice are off and only the simulator works.

## Database migration

`backend/db/migrations/018_channels.sql` (applied by `npm run migrate`, or automatically with `AUTO_MIGRATE=true`):

- `channel_sessions`: USSD sessions and calls (channel, provider, session key, phone, farmer, language, authenticated time, state, steps, demo flag, expiry, end).
- `farmers.preferred_language` (default `en`).
- `farmers.is_demo` (default `false`).

## API endpoints

| Method and path | Who | What |
| --- | --- | --- |
| `POST /api/ussd?key=<USSD_SECRET>` | Africa's Talking | USSD request (`sessionId`, `phoneNumber`, `text`) → `CON …` / `END …` |
| `POST /api/voice?key=<VOICE_SECRET>` | Voice provider | Call callback (Africa's Talking: `sessionId`, `callerNumber`, `dtmfDigits`, `isActive`) → XML. 404 unless a provider is set |
| `GET /api/voice/clips/:language/:file` | Anyone | A recorded prompt (only files in the clips folder) |
| `GET /api/voice/simulator` | Anyone | Simulator modes, demo farmers, demo PIN, languages |
| `POST /api/voice/simulator/calls` | Anyone | Start a call: `{ mode: "demo", demoFarmerId }` or `{ mode: "development", phone }` → call token, prompts, what input is expected |
| `POST /api/voice/simulator/calls/:token/keys` | The caller | `{ digits, step }` → next prompts |
| `POST /api/voice/simulator/calls/:token/end` | The caller | Hang up |
| `GET /api/voice/simulator/calls/:token` | The caller | Transcript (PINs hidden), status, records saved |
| `PUT /api/auth/language` | Signed-in farmer | `{ language }` → saves the farmer's language |

## Automated tests

```bash
cd backend && npm test      # all API tests, including:
#   tests/ussd.test.js        registration, sign-in, wrong PIN and lock, menu, farm selection,
#                             activity, harvest, sales (+payment, cost, oversell), summary,
#                             weather, prices, notifications, expiry, repeats, invalid input,
#                             182-character screens, records shown in the app and reports
#   tests/voice.test.js       call start, language choice saved, menu, keypad, PIN, invalid keys,
#                             activity/harvest/sale saved and shown in the app, summary, weather,
#                             prices, advice, help, sessions without PINs, repeats, timeout,
#                             hang-up, demo separation from Ministry stats, Africa's Talking XML
#   tests/voiceClips.test.js  recordings served and played, English stand-in, prompt packs
cd frontend && npm test     # includes tests/ivrSimulator.test.js (keypad, hidden PIN, timer)
```

The API tests need a separate test database (see the README).

## Connecting a live voice provider later

The menu and sessions don't depend on any telephone company. To add one:

1. Write `backend/src/channels/providers/<name>.js` with two functions, like `africastalking.js`:
   - read the provider's callback into `{ sessionKey, phone, digits, hangup }`;
   - turn the result of `handleCallStep()` into the provider's answer format (play recordings from `item.audio`, otherwise say `item.text`; ask for one key or for keys ending with `#` from `voice.input`).
2. In `backend/src/routes/voiceRoutes.js`, accept that provider's callback when `VOICE_PROVIDER=<name>` (check its signature or a secret key, as for Africa's Talking).
3. Set `VOICE_PROVIDER`, the provider's secret, and `PUBLIC_API_URL` on the Backend service. Point the provider's number at the callback URL.
4. Test with the provider's test tools before telling anyone that live calls work.

For Africa's Talking specifically (if they add Liberia): get a voice number on a live app (voice@africastalking.com), set `VOICE_SECRET` (and `VOICE_PROVIDER=africastalking`), and set the number's callback URL to `https://<your-backend>/api/voice?key=<VOICE_SECRET>`.
