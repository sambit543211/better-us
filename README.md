# Couple Health Habit Tracker

A fancy, interactive web app for a couple trying to build healthy habits together: meals, protein, workouts, steps, sleep, quit-cigarette streak, alcohol limits, cheat meal tracking, badminton, and buddy accountability.

The app works in two modes:

1. **Local demo mode**: no setup required, but data stays only in that browser.
2. **Cloud couple mode**: use Supabase + Vercel so both partners can log in from any phone/laptop and progress does not disappear after redeploys.

## Recommended setup

Use **Vercel for hosting** and **Supabase for database + auth**.

Vercel should only host the front-end. Supabase stores the actual progress, so redeploying the Vercel app will not delete your daily logs.

## What it tracks

- Daily meals: breakfast, lunch, snack, dinner
- Protein grams per meal and daily protein total
- Steps
- Workout type and minutes
- Badminton days
- Cigarettes, with no-cigarette streak
- Alcohol drinks
- Cheat meal usage
- Mobility
- 15-minute reading before sleep
- Sleep and wake time
- Water intake
- Mood and notes
- Last 7-day score trend
- Buddy accountability prompts

## Local run

```bash
npm install
npm run dev
```

Open the local URL shown in your terminal.

## Supabase setup

1. Create a project in Supabase.
2. Go to **SQL Editor**.
3. Copy everything from `supabase/schema.sql` and run it once.
4. Go to **Project Settings > API** and copy:
   - Project URL
   - anon public key
5. Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

6. Paste your values:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

7. Restart the app:

```bash
npm run dev
```

## Auth note

For a private couple app, the easiest setup is email + password auth.

In Supabase, if you do not want email confirmation during testing, go to:

**Authentication > Providers > Email**

Then adjust email confirmation settings based on your preference.

## Couple onboarding flow

1. Partner 1 signs up and signs in.
2. Partner 1 creates the couple space and gets an invite code.
3. Partner 2 signs up and signs in.
4. Partner 2 joins using the invite code.
5. Both partners can now see the couple dashboard and entries.

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repository in Vercel.
3. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.
5. In Supabase, add your Vercel URL under:
   **Authentication > URL Configuration > Site URL**

## Data safety

Your data is safe from normal Vercel redeploys because the data is stored in Supabase, not inside Vercel.

Still, good practice:

- Export a local JSON backup occasionally if using local demo mode.
- For cloud mode, use Supabase backups or periodically export your database table if the tracker becomes important long-term.
- Do not store medical records or sensitive documents inside this simple app.

## Suggested next features

- Monthly calendar heatmap
- Couple badges and streak animations
- Weekly PDF report
- Push notifications
- Google Fit / Apple Health step sync
- Meal photo uploads
- Weight and measurements tracker
- Progress charts
