import { createClient } from '@supabase/supabase-js';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project'));
const supabase = hasCloud ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const GOALS = {
  protein: 60,
  stepsStart: 8000,
  stepsStretch: 10000,
  water: 2.5,
  sleepBefore: '00:00',
  alcoholMonthlyLimit: 2,
};

const defaultMeals = [
  { key: 'breakfast', label: 'Breakfast', idea: 'Eggs / oats / curd bowl' },
  { key: 'lunch', label: 'Lunch', idea: 'Chicken/fish + rice/roti + dal + greens' },
  { key: 'snack', label: 'Snack', idea: 'Fruit + chana / eggs / curd' },
  { key: 'dinner', label: 'Dinner', idea: 'Fish/chicken/prawns + veggies + salad' },
];

const state = {
  session: null,
  profile: null,
  partnerProfiles: [],
  entries: [],
  selectedDate: today(),
  localPerson: localStorage.getItem('localPerson') || 'Partner A',
  message: '',
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTime(time) {
  if (!time) return '';
  return String(time).slice(0, 5);
}

function isBeforeMidnight(time) {
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  return h < 24 && (h < 24 || m === 0);
}

function calculateScore(habits, meals) {
  const totalProtein = totalMealProtein(meals);
  const points = [
    totalProtein >= GOALS.protein,
    safeNumber(habits.steps) >= GOALS.stepsStart,
    safeNumber(habits.workoutMinutes) >= 20 || habits.workoutType === 'Badminton',
    safeNumber(habits.cigarettes) === 0,
    safeNumber(habits.alcoholDrinks) === 0,
    Boolean(habits.mobility),
    Boolean(habits.reading),
    isBeforeMidnight(habits.sleepTime),
  ];
  return points.filter(Boolean).length;
}

function totalMealProtein(meals = {}) {
  return defaultMeals.reduce((sum, meal) => sum + safeNumber(meals?.[meal.key]?.protein), 0);
}

function getLocalStore() {
  return JSON.parse(localStorage.getItem('coupleHealthEntries') || '[]');
}

function setLocalStore(entries) {
  localStorage.setItem('coupleHealthEntries', JSON.stringify(entries));
}

async function boot() {
  if (hasCloud) {
    const { data } = await supabase.auth.getSession();
    state.session = data.session;
    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      await hydrate();
      render();
    });
  }
  await hydrate();
  render();
}

async function hydrate() {
  state.message = '';
  if (!hasCloud) {
    state.entries = getLocalStore();
    return;
  }
  if (!state.session) {
    state.profile = null;
    state.entries = [];
    state.partnerProfiles = [];
    return;
  }

  const userId = state.session.user.id;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) state.message = profileError.message;
  state.profile = profile;

  if (!profile?.couple_id) return;

  const since = daysAgo(45);
  const [{ data: entries, error: entriesError }, { data: profiles, error: partnersError }] = await Promise.all([
    supabase
      .from('daily_entries')
      .select('*')
      .gte('entry_date', since)
      .order('entry_date', { ascending: false }),
    supabase
      .from('profiles')
      .select('*')
      .eq('couple_id', profile.couple_id),
  ]);

  if (entriesError) state.message = entriesError.message;
  if (partnersError) state.message = partnersError.message;
  state.entries = entries || [];
  state.partnerProfiles = profiles || [];
}

function currentPersonId() {
  return hasCloud ? state.session?.user?.id : state.localPerson;
}

function currentCoupleId() {
  return hasCloud ? state.profile?.couple_id : 'local-couple';
}

function currentDisplayName() {
  if (hasCloud) return state.profile?.display_name || state.session?.user?.email || 'You';
  return state.localPerson;
}

function findEntry(personId = currentPersonId(), date = state.selectedDate) {
  return state.entries.find((e) => e.user_id === personId && e.entry_date === date);
}

function blankEntry() {
  return {
    meals: Object.fromEntries(defaultMeals.map((m) => [m.key, { text: '', protein: '' }])),
    habits: {
      steps: '',
      workoutType: '',
      workoutMinutes: '',
      cigarettes: 0,
      alcoholDrinks: 0,
      cheatMeal: false,
      mobility: false,
      reading: false,
      sleepTime: '23:45',
      wakeTime: '07:30',
      water: '',
      mood: 'Good',
      notes: '',
    },
  };
}

function getEditableEntry() {
  const existing = findEntry();
  if (!existing) return blankEntry();
  return {
    meals: { ...blankEntry().meals, ...(existing.meals || {}) },
    habits: { ...blankEntry().habits, ...(existing.habits || {}) },
  };
}

async function saveEntryFromForm(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);

  const meals = {};
  defaultMeals.forEach((meal) => {
    meals[meal.key] = {
      text: form.get(`${meal.key}_text`)?.toString() || '',
      protein: safeNumber(form.get(`${meal.key}_protein`), 0),
    };
  });

  const habits = {
    steps: safeNumber(form.get('steps'), 0),
    workoutType: form.get('workoutType')?.toString() || '',
    workoutMinutes: safeNumber(form.get('workoutMinutes'), 0),
    cigarettes: safeNumber(form.get('cigarettes'), 0),
    alcoholDrinks: safeNumber(form.get('alcoholDrinks'), 0),
    cheatMeal: form.get('cheatMeal') === 'on',
    mobility: form.get('mobility') === 'on',
    reading: form.get('reading') === 'on',
    sleepTime: normalizeTime(form.get('sleepTime')),
    wakeTime: normalizeTime(form.get('wakeTime')),
    water: safeNumber(form.get('water'), 0),
    mood: form.get('mood')?.toString() || 'Good',
    notes: form.get('notes')?.toString() || '',
  };

  const score = calculateScore(habits, meals);
  const user_id = currentPersonId();
  const couple_id = currentCoupleId();
  const entry_date = state.selectedDate;

  if (hasCloud) {
    if (!state.profile?.couple_id) {
      state.message = 'Create or join a couple first.';
      render();
      return;
    }
    const { error } = await supabase
      .from('daily_entries')
      .upsert({ user_id, couple_id, entry_date, meals, habits, score }, { onConflict: 'user_id,entry_date' });
    state.message = error ? error.message : 'Saved. Your partner can see this after refresh.';
  } else {
    const entries = getLocalStore().filter((e) => !(e.user_id === user_id && e.entry_date === entry_date));
    entries.push({ id: uid(), user_id, couple_id, entry_date, meals, habits, score, updated_at: new Date().toISOString() });
    setLocalStore(entries);
    state.entries = entries;
    state.message = 'Saved locally on this browser. Use export/import or connect Supabase for shared tracking.';
  }

  await hydrate();
  render();
}

async function signIn(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = form.get('email')?.toString();
  const password = form.get('password')?.toString();
  const mode = form.get('mode')?.toString();
  const action = mode === 'signup' ? supabase.auth.signUp : supabase.auth.signInWithPassword;
  const { error } = await action.call(supabase.auth, { email, password });
  state.message = error ? error.message : mode === 'signup' ? 'Account created. Check email if confirmation is enabled, then sign in.' : 'Signed in.';
  await hydrate();
  render();
}

async function signOut() {
  await supabase.auth.signOut();
  state.session = null;
  state.profile = null;
  state.entries = [];
  render();
}

async function onboarding(event, mode) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const displayName = form.get('displayName')?.toString() || 'Partner';
  const inviteCode = form.get('inviteCode')?.toString() || randomCode();
  const fn = mode === 'create' ? 'create_couple_with_profile' : 'join_couple_with_profile';
  const { error } = await supabase.rpc(fn, { display_name: displayName, invite_code: inviteCode });
  state.message = error ? error.message : mode === 'create' ? `Couple created. Invite code: ${inviteCode.toUpperCase()}` : 'Joined couple.';
  await hydrate();
  render();
}

function randomCode() {
  const words = ['TEAM', 'FIT', 'HEART', 'STREAK', 'MOVE'];
  return `${words[Math.floor(Math.random() * words.length)]}${Math.floor(100 + Math.random() * 900)}`;
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), entries: state.entries }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `couple-health-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.entries)) throw new Error('Invalid backup file');
      setLocalStore(parsed.entries);
      state.entries = parsed.entries;
      state.message = 'Backup imported into local mode.';
      render();
    } catch (error) {
      state.message = error.message;
      render();
    }
  };
  reader.readAsText(file);
}

function render() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main class="shell">
      ${hero()}
      ${state.message ? `<div class="toast">${escapeHtml(state.message)}</div>` : ''}
      ${!hasCloud ? localModeBanner() : ''}
      ${hasCloud && !state.session ? authView() : ''}
      ${hasCloud && state.session && !state.profile?.couple_id ? onboardingView() : ''}
      ${(!hasCloud || (state.session && state.profile?.couple_id)) ? trackerView() : ''}
    </main>
  `;
  bindEvents();
}

function hero() {
  return `
    <section class="hero">
      <div>
        <p class="eyebrow">Two of Us · 90-Day Health Game</p>
        <h1>Build the healthy couple streak.</h1>
        <p class="subtitle">Track meals, protein, workouts, sleep, cigarettes, alcohol, badminton, and daily trust check-ins in one playful private dashboard.</p>
      </div>
      <div class="hero-card floaty">
        <span class="heart">♥</span>
        <strong>${escapeHtml(currentDisplayName())}</strong>
        <small>${hasCloud ? 'Cloud sync ready' : 'Local demo mode'}</small>
      </div>
    </section>
  `;
}

function localModeBanner() {
  return `
    <section class="notice-grid">
      <div class="notice">
        <strong>Demo/local mode is active.</strong>
        <p>Your logs are saved in this browser only. For both of you to use it across phones/laptops, connect Supabase using the README steps.</p>
      </div>
      <div class="notice actions-inline">
        <button class="ghost" data-action="export">Export backup JSON</button>
        <label class="ghost file-label">Import backup <input type="file" accept="application/json" data-action="import" hidden /></label>
      </div>
    </section>
  `;
}

function authView() {
  return `
    <section class="card narrow">
      <h2>Sign in</h2>
      <p class="muted">Use Supabase Auth so each partner has their own profile and both logs sync in the same couple dashboard.</p>
      <form class="stack" data-form="auth">
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" minlength="6" required />
        <div class="segmented">
          <label><input type="radio" name="mode" value="signin" checked /> Sign in</label>
          <label><input type="radio" name="mode" value="signup" /> Create account</label>
        </div>
        <button type="submit">Continue</button>
      </form>
    </section>
  `;
}

function onboardingView() {
  const code = randomCode();
  return `
    <section class="grid two">
      <div class="card">
        <h2>Create your couple space</h2>
        <p class="muted">Do this once. Share the invite code with your partner.</p>
        <form class="stack" data-form="create-couple">
          <input name="displayName" placeholder="Your name" required />
          <input name="inviteCode" value="${code}" placeholder="Invite code" required />
          <button type="submit">Create couple</button>
        </form>
      </div>
      <div class="card">
        <h2>Join your partner</h2>
        <p class="muted">Use the invite code your partner created.</p>
        <form class="stack" data-form="join-couple">
          <input name="displayName" placeholder="Your name" required />
          <input name="inviteCode" placeholder="Invite code" required />
          <button type="submit">Join couple</button>
        </form>
      </div>
    </section>
  `;
}

function trackerView() {
  const entry = getEditableEntry();
  const stats = getStats();
  return `
    ${topBar()}
    ${dashboard(stats)}
    <section class="grid main-grid">
      ${dailyForm(entry)}
      ${sidePanel(stats)}
    </section>
    ${plans()}
  `;
}

function topBar() {
  const profiles = hasCloud ? state.partnerProfiles : [{ id: 'Partner A', display_name: 'Partner A' }, { id: 'Partner B', display_name: 'Partner B' }];
  return `
    <section class="topbar card glass">
      <div>
        <label>Date</label>
        <input type="date" value="${state.selectedDate}" data-action="date" />
      </div>
      ${!hasCloud ? `
        <div>
          <label>Who is logging?</label>
          <select data-action="local-person">
            ${profiles.map((p) => `<option value="${p.id}" ${p.id === state.localPerson ? 'selected' : ''}>${p.display_name}</option>`).join('')}
          </select>
        </div>` : `
        <div>
          <label>Couple members</label>
          <div class="pill-row">${profiles.map((p) => `<span class="pill">${escapeHtml(p.display_name)}</span>`).join('')}</div>
        </div>`}
      <div>
        <label>Mode</label>
        <div class="pill good">${hasCloud ? 'Supabase cloud' : 'Local browser'}</div>
      </div>
      ${hasCloud ? `<button class="ghost" data-action="signout">Sign out</button>` : ''}
    </section>
  `;
}

function dashboard(stats) {
  const proteinPct = Math.min(100, (stats.todayProtein / GOALS.protein) * 100);
  const scorePct = Math.min(100, (stats.todayScore / 8) * 100);
  const stepPct = Math.min(100, (stats.todaySteps / GOALS.stepsStart) * 100);
  return `
    <section class="dash-grid">
      ${metricCard('Today score', `${stats.todayScore}/8`, scorePct, 'Daily habit points')}
      ${metricCard('Protein', `${stats.todayProtein}g`, proteinPct, 'Target 60g+')}
      ${metricCard('Steps', `${stats.todaySteps}`, stepPct, 'Target 8k now, 10k later')}
      <div class="card streak-card">
        <p class="label">No cigarette streak</p>
        <h3>${stats.noCigStreak} days</h3>
        <p class="muted">Complete quit from day 1. The rule: never buy just one.</p>
      </div>
    </section>
  `;
}

function metricCard(label, value, pct, note) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return `
    <div class="card metric">
      <div class="ring" style="--offset:${offset}; --circ:${circumference}">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" class="track"></circle>
          <circle cx="50" cy="50" r="42" class="progress"></circle>
        </svg>
        <span>${value}</span>
      </div>
      <div>
        <p class="label">${label}</p>
        <p class="muted">${note}</p>
      </div>
    </div>
  `;
}

function dailyForm(entry) {
  return `
    <section class="card form-card">
      <div class="section-head">
        <div>
          <h2>Daily check-in</h2>
          <p class="muted">Log food, workout, sleep and cravings in under 3 minutes.</p>
        </div>
        <span class="pill">${escapeHtml(currentDisplayName())}</span>
      </div>
      <form data-form="entry">
        <h3>Meals & protein</h3>
        <div class="meal-grid">
          ${defaultMeals.map((meal) => mealInput(meal, entry.meals?.[meal.key])).join('')}
        </div>

        <h3>Habits</h3>
        <div class="habit-grid">
          ${numberInput('steps', 'Steps', entry.habits.steps, '8000')}
          ${selectInput('workoutType', 'Workout', entry.habits.workoutType, ['', 'Strength', 'Cardio', 'Mobility', 'Badminton', 'Walk', 'Rest'])}
          ${numberInput('workoutMinutes', 'Workout minutes', entry.habits.workoutMinutes, '30')}
          ${numberInput('cigarettes', 'Cigarettes', entry.habits.cigarettes, '0')}
          ${numberInput('alcoholDrinks', 'Alcohol drinks', entry.habits.alcoholDrinks, '0')}
          ${numberInput('water', 'Water litres', entry.habits.water, '2.5', '0.1')}
          ${timeInput('sleepTime', 'Sleep time', entry.habits.sleepTime)}
          ${timeInput('wakeTime', 'Wake time', entry.habits.wakeTime)}
          ${selectInput('mood', 'Mood', entry.habits.mood, ['Great', 'Good', 'Okay', 'Low', 'Stressed'])}
        </div>

        <div class="checks">
          ${checkInput('mobility', '10 min mobility', entry.habits.mobility)}
          ${checkInput('reading', '15 min reading before sleep', entry.habits.reading)}
          ${checkInput('cheatMeal', 'Weekly cheat meal used today', entry.habits.cheatMeal)}
        </div>

        <label class="field full">
          <span>Notes / cravings / wins</span>
          <textarea name="notes" rows="4" placeholder="Example: Craved cigarette after lunch, walked for 7 minutes instead.">${escapeHtml(entry.habits.notes || '')}</textarea>
        </label>

        <button type="submit" class="save">Save today</button>
      </form>
    </section>
  `;
}

function mealInput(meal, value = {}) {
  return `
    <div class="meal-card">
      <label>
        <span>${meal.label}</span>
        <textarea name="${meal.key}_text" rows="3" placeholder="${meal.idea}">${escapeHtml(value.text || '')}</textarea>
      </label>
      <label>
        <span>Protein g</span>
        <input name="${meal.key}_protein" type="number" min="0" value="${safeNumber(value.protein, '')}" placeholder="15" />
      </label>
    </div>
  `;
}

function numberInput(name, label, value, placeholder, step = '1') {
  return `<label class="field"><span>${label}</span><input name="${name}" type="number" step="${step}" min="0" value="${value ?? ''}" placeholder="${placeholder}" /></label>`;
}

function timeInput(name, label, value) {
  return `<label class="field"><span>${label}</span><input name="${name}" type="time" value="${normalizeTime(value)}" /></label>`;
}

function selectInput(name, label, value, options) {
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${o || 'Choose'}</option>`).join('')}</select></label>`;
}

function checkInput(name, label, checked) {
  return `<label class="check"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''} /><span>${label}</span></label>`;
}

function sidePanel(stats) {
  return `
    <aside class="side-stack">
      <section class="card">
        <h2>Buddy accountability</h2>
        <div class="buddy-list">
          <div><strong>Morning promise</strong><p>One sentence each: what habit matters most today?</p></div>
          <div><strong>No-judgment rescue</strong><p>If someone slips: “What can we do in the next 10 minutes?”</p></div>
          <div><strong>Sunday review</strong><p>Wins, hard moments, next week’s one adjustment.</p></div>
        </div>
      </section>

      <section class="card">
        <h2>Last 7 days</h2>
        <div class="mini-bars">
          ${stats.week.map((d) => `<div><span>${d.day}</span><i style="height:${Math.max(6, d.score * 12)}px"></i><b>${d.score}</b></div>`).join('')}
        </div>
        <p class="muted">Aim for 45+ couple points/week, but the real rule is never miss twice.</p>
      </section>

      <section class="card danger-soft">
        <h2>Cigarette craving protocol</h2>
        <ol>
          <li>Drink water.</li>
          <li>Chew saunf/gum.</li>
          <li>Walk for 5 minutes.</li>
          <li>Delay 10 minutes before acting.</li>
        </ol>
      </section>
    </aside>
  `;
}

function plans() {
  return `
    <section class="plan-grid">
      <div class="card">
        <h2>Food template</h2>
        <ul class="clean-list">
          <li><strong>Breakfast:</strong> eggs / oats / curd bowl, 18-25g protein.</li>
          <li><strong>Lunch:</strong> chicken or fish + dal + green veggies + rice/roti, 25-35g protein.</li>
          <li><strong>Snack:</strong> roasted chana, curd, fruit, or boiled eggs, 10-15g protein.</li>
          <li><strong>Dinner:</strong> fish/chicken/prawns + salad + fibre-rich veggies, 25-30g protein.</li>
        </ul>
      </div>
      <div class="card">
        <h2>Workout rhythm</h2>
        <ul class="clean-list">
          <li><strong>Mon:</strong> upper body strength.</li>
          <li><strong>Tue:</strong> lower body strength.</li>
          <li><strong>Wed:</strong> cardio + mobility.</li>
          <li><strong>Thu:</strong> upper body + core.</li>
          <li><strong>Fri:</strong> lower body + stamina.</li>
          <li><strong>Sat:</strong> badminton together.</li>
          <li><strong>Sun:</strong> recovery walk + review.</li>
        </ul>
      </div>
      <div class="card">
        <h2>Sleep contract</h2>
        <ul class="clean-list">
          <li>11:15 PM phone cut-off.</li>
          <li>15 minutes reading before sleep.</li>
          <li>12:00 AM max lights out.</li>
          <li>Wake target around 7:30 AM.</li>
        </ul>
      </div>
    </section>
  `;
}

function getStats() {
  const personId = currentPersonId();
  const entry = findEntry(personId, state.selectedDate);
  const todayProtein = totalMealProtein(entry?.meals || {});
  const todaySteps = safeNumber(entry?.habits?.steps);
  const todayScore = safeNumber(entry?.score);

  const weekDates = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
  const week = weekDates.map((date) => {
    const e = findEntry(personId, date);
    return { day: new Date(date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3), score: safeNumber(e?.score) };
  });

  let streak = 0;
  for (let i = 0; i < 45; i++) {
    const date = daysAgo(i);
    const e = findEntry(personId, date);
    if (!e || safeNumber(e.habits?.cigarettes) !== 0) break;
    streak += 1;
  }

  return { todayProtein, todaySteps, todayScore, week, noCigStreak: streak };
}

function bindEvents() {
  document.querySelector('[data-form="entry"]')?.addEventListener('submit', saveEntryFromForm);
  document.querySelector('[data-form="auth"]')?.addEventListener('submit', signIn);
  document.querySelector('[data-form="create-couple"]')?.addEventListener('submit', (e) => onboarding(e, 'create'));
  document.querySelector('[data-form="join-couple"]')?.addEventListener('submit', (e) => onboarding(e, 'join'));
  document.querySelector('[data-action="date"]')?.addEventListener('change', (e) => { state.selectedDate = e.target.value; render(); });
  document.querySelector('[data-action="local-person"]')?.addEventListener('change', (e) => { state.localPerson = e.target.value; localStorage.setItem('localPerson', e.target.value); render(); });
  document.querySelector('[data-action="signout"]')?.addEventListener('click', signOut);
  document.querySelector('[data-action="export"]')?.addEventListener('click', exportData);
  document.querySelector('[data-action="import"]')?.addEventListener('change', importData);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

boot();
