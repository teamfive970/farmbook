# FarmBok in Liberian languages

FarmBok can show its words in Kpelle, Bassa, Dan (Gio), Mano, Kru, Loma, Vai,
Kissi, Grebo, Gola, Mandingo and Krahn. A language appears in the app (Me →
Language) as soon as its word pack is here. Words that are not translated yet
stay in English, so a pack can grow little by little.

Translations must come from native speakers and be checked by a second
speaker (for example a teacher, extension officer or radio presenter from
that area). Please do not use machine translation for these languages.

## 1. Make the translation sheet

From the `frontend` folder:

    npm run i18n:export -- kpelle

This writes `translations/kpelle.csv` with about 400 short phrases. Open it in
Excel or Google Sheets.

| Column | What to do |
| --- | --- |
| key | Do not change |
| english (on screen) | The words the app shows now |
| english (spoken) | What the phone says when "Talk to me" is on |
| translation | **Fill in**: the words to show, short like the English |
| spoken (optional) | What the speaker should say when recording, if different |
| audio file name | Name to give the recording (see step 3) |

Start with the most used words: `welcome.*`, `login.*`, `activity.*`,
`unit.*`, crops and animals. Leave a row empty if you are not sure.

## 2. Add the sheet to the app

    npm run i18n:import -- kpelle translations/kpelle.csv "Checked by: Name, Name, date"

This writes `public/i18n/kpelle.json` and updates `public/i18n/index.json`.
Commit both and deploy. On the phone: Me → Language → Kpelle.

## 3. Recorded voice (best for farmers who do not read)

Phone voices cannot speak Kpelle or Bassa. Record a native speaker saying each
phrase (quiet room, phone voice recorder is fine), save each clip with the name
in the "audio file name" column, for example `welcome.title.mp3`, and put the
files in `public/audio/kpelle/`. Run the import command again: it lists the
clips in `public/audio/kpelle/manifest.json`. When "Talk to me" is on, the app
plays the recorded clip; phrases without a clip are read in English.

Keep clips short and small (mono, 32-64 kbps MP3): farmers download them once
and then they work without network.
