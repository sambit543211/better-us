# Better Us — Sammy × Shreya

A private two-person habit web app for Sammy and Shreya.

This version is intentionally not a generic couple-space app. There is no invite code and no create/join flow. When the app opens, the user selects:

- I’m Sammy
- I’m Shreya

That selected side becomes editable. The other side stays visible for comparison, support and accountability.

## Features

- Warm mobile-first UI
- Fixed private profiles: Sammy and Shreya
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
- Supabase-ready cloud sync mode

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

## Supabase cloud mode

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

## Important data note

Food and workout images are compressed in-browser and saved as image data inside the entry JSON.

This is fine for a private MVP/prototype. Later, if the app grows, move images into Supabase Storage and keep only image URLs in the database.

## Supabase behavior

After login:

1. The app asks whether the current user is Sammy or Shreya.
2. It saves that identity in the `profiles` table.
3. That person can edit only their own daily entries.
4. Both people can view both sides of the shared dashboard.

The couple ID is fixed as:

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
