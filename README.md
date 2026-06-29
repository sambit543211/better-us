# Better Us — Sammy × Shreya

A private two-person habit web app for Sammy and Shreya.

This version has **no login**, **no invite code**, and **no create couple space** flow.

When the app opens, the user selects:

- I’m Sammy
- I’m Shreya

That selected side becomes editable. The other side stays visible for comparison, support, and accountability.

## Features

- Warm mobile-first UI
- Fixed private profiles: Sammy and Shreya
- First-screen identity picker
- Today dashboard with side-by-side comparison
- Daily habit score
- Protein-first meal logging
- Meal photo upload option
- Workout photo upload option
- Steps, workout, sleep, water, mobility and reading tracking
- Cigarette and alcohol tracking
- Mood timeline every 3 hours from 9 AM to 12 AM
- Daily gratitude entry
- Daily “what made me smile” entry
- Additional daily comments
- Message/challenge for tomorrow with duration
- Flashing top message cards
- Progress dashboard
- Gratitude wall
- Local prototype mode
- Supabase no-login cloud sync mode

## Deploy without running locally

1. Unzip the repository.
2. Upload the contents of this folder to GitHub.
3. Import the GitHub repo in Vercel.
4. Deploy.
5. Open the Vercel URL.
6. Choose Sammy or Shreya and test the UI.

Your GitHub repo root should contain:

```txt
index.html
package.json
vercel.json
src/
supabase/
.env.example
.gitignore
README.md
```

Do not upload the zip file itself.

## Local prototype mode

If Supabase environment variables are missing, the app works in local browser mode.

This is good for UI testing, but it will not sync between both phones.

Local mode saves data in the browser using localStorage. You can use the backup export/import buttons in Settings.

## Supabase no-login cloud mode

When you are happy with the UI, create a Supabase project.

Then run:

```txt
supabase/schema.sql
```

in Supabase SQL Editor.

Then add these environment variables in Vercel:

```txt
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
```

Redeploy the Vercel app after adding environment variables.

The app will then use Supabase directly with the public anon key. No Supabase Auth is used.

## Important privacy note

Because this version has no login, anyone with the Vercel URL can view or edit the tracker data. Keep the app link private.

For stronger privacy later, add either:

- a simple shared passcode screen, or
- Supabase Auth login.

## Important image note

Food and workout images are compressed in-browser and saved as image data inside the entry JSON.

This is fine for a private MVP/prototype. Later, if the app grows, move images into Supabase Storage and keep only image URLs in the database.

## Supabase behavior

1. The app opens.
2. User selects Sammy or Shreya.
3. The selected person can edit their own daily entries.
4. Both people can view both sides of the shared dashboard.
5. Data saves to the same fixed couple ID:

```txt
sammy-shreya-private
```

## Build settings for Vercel

Vercel should detect Vite automatically.

Expected settings:

```txt
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```
