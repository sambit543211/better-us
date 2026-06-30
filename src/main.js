import { createClient } from '@supabase/supabase-js';
import './styles.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasCloud = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project'));
const supabase = hasCloud ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const APP_NAME = 'Better Us';
const FIXED_COUPLE_ID = 'sammy-shreya-private';

const PEOPLE = [
  { id: 'sammy', display_name: 'Sammy', emoji: '🌞', color: 'coral' },
  { id: 'shreya', display_name: 'Shreya', emoji: '🌙', color: 'mint' },
];

const GOALS = {
  protein: 60,
  steps: 8000,
  stretchSteps: 10000,
  water: 2.5,
  alcoholMonthlyLimit: 2,
  dailyMaxScore: 10,
};

const MEALS = [
  {
    key: 'breakfast',
    label: 'Breakfast',
    idea: 'Eggs / oats / curd bowl',
    presets: [
      ['2 eggs', 12],
      ['3 egg omelette', 18],
      ['Curd bowl', 8],
      ['Oats + curd', 12],
    ],
  },
  {
    key: 'lunch',
    label: 'Lunch',
    idea: 'Chicken/fish + rice/roti + dal + greens',
    presets: [
      ['Chicken 100g', 25],
      ['Fish 100g', 22],
      ['Dal bowl', 8],
      ['Green sabzi', 3],
    ],
  },
  {
    key: 'snack',
    label: 'Snack',
    idea: 'Fruit + chana / eggs / curd',
    presets: [
      ['Roasted chana', 10],
      ['Boiled egg', 6],
      ['Greek curd', 12],
      ['Sprouts', 9],
    ],
  },
  {
    key: 'dinner',
    label: 'Dinner',
    idea: 'Fish/chicken/prawns + veggies + salad',
    presets: [
      ['Prawns 100g', 24],
      ['Fish curry', 22],
      ['Chicken curry', 25],
      ['Paneer 100g', 18],
    ],
  },
];

const MOOD_SLOTS = [
  ['09', '9 AM'],
  ['12', '12 PM'],
  ['15', '3 PM'],
  ['18', '6 PM'],
  ['21', '9 PM'],
  ['24', '12 AM'],
];

const MOOD_OPTIONS = ['', 'Great', 'Good', 'Okay', 'Low', 'Stressed', 'Tired', 'Calm', 'Irritated'];

const state = {
  entries: [],
  messages: [],
  selectedDate: localDate(),
  activeView: localStorage.getItem('betterUsActiveView') || 'today',
  selectedPerson: localStorage.getItem('betterUsSelectedPerson') || '',
  message: '',
  syncStatus: hasCloud ? 'checking' : 'local',
  lastSyncError: '',
  lastSyncAt: '',
};

function localDate(date = new Date()) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function daysAgo(n) {
  return addDays(localDate(), -n);
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

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function sleptBeforeMidnight(time) {
  const mins = timeToMinutes(time);
  if (mins === null) return false;
  return mins <= 23 * 60 + 59;
}

function totalMealProtein(meals = {}) {
  return MEALS.reduce((sum, meal) => sum + safeNumber(meals?.[meal.key]?.protein), 0);
}

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function getPerson(personId = currentPersonId()) {
  return PEOPLE.find((p) => p.id === personId) || PEOPLE[0];
}

function personName(personId = currentPersonId()) {
  return getPerson(personId).display_name;
}

function partnerId(personId = currentPersonId()) {
  return personId === 'sammy' ? 'shreya' : 'sammy';
}

function orderedPeople() {
  const selected = currentPersonId() || 'sammy';
  return [getPerson(selected), getPerson(partnerId(selected))];
}

function currentPersonId() {
  return state.selectedPerson;
}

function currentDisplayName() {
  const id = currentPersonId();
  return id ? personName(id) : 'Choose Sammy or Shreya';
}

function getLocalEntries() {
  return JSON.parse(localStorage.getItem('betterUsEntriesV2') || '[]');
}

function setLocalEntries(entries) {
  localStorage.setItem('betterUsEntriesV2', JSON.stringify(entries));
}

function getLocalMessages() {
  return JSON.parse(localStorage.getItem('betterUsMessagesV2') || '[]');
}

function setLocalMessages(messages) {
  localStorage.setItem('betterUsMessagesV2', JSON.stringify(messages));
}

async function boot() {
  await hydrate();
  render();
}

async function hydrate() {
  state.message = '';

  if (!hasCloud) {
    state.entries = getLocalEntries();
    state.messages = getLocalMessages();
    state.syncStatus = 'local';
    state.lastSyncError = '';
    return;
  }

  state.syncStatus = 'checking';

  try {
    const since = daysAgo(90);
    const [entriesResult, messagesResult] = await Promise.all([
      supabase
        .from('daily_entries')
        .select('*')
        .eq('couple_id', FIXED_COUPLE_ID)
        .gte('entry_date', since)
        .order('entry_date', { ascending: false }),
      supabase
        .from('message_cards')
        .select('*')
        .eq('couple_id', FIXED_COUPLE_ID)
        .gte('end_date', since)
        .order('created_at', { ascending: false }),
    ]);

    if (entriesResult.error || messagesResult.error) {
      throw entriesResult.error || messagesResult.error;
    }

    state.entries = entriesResult.data || [];
    state.messages = messagesResult.data || [];
    state.syncStatus = 'connected';
    state.lastSyncError = '';
    state.lastSyncAt = new Date().toISOString();
  } catch (error) {
    // Keep the app clean and usable even if Supabase is not connected yet,
    // the schema is missing, or the network blocks a request.
    state.entries = getLocalEntries();
    state.messages = getLocalMessages();
    state.syncStatus = 'fallback';
    state.lastSyncError = readableSyncError(error);
  }
}

function readableSyncError(error) {
  const raw = error?.message || String(error || 'Cloud sync failed');
  if (/failed to fetch|load failed|network/i.test(raw)) return 'Supabase could not be reached from this browser/network.';
  if (/relation .* does not exist|schema|table/i.test(raw)) return 'Supabase schema may not be created yet. Run supabase/schema.sql.';
  return raw;
}

function blankMoodTimeline() {
  return Object.fromEntries(MOOD_SLOTS.map(([key]) => [key, { mood: '', note: '' }]));
}

function blankEntry() {
  return {
    meals: Object.fromEntries(MEALS.map((m) => [m.key, { text: '', protein: '', image: '' }])),
    habits: {
      steps: '',
      workoutType: '',
      workoutMinutes: '',
      workoutImage: '',
      cigarettes: 0,
      alcoholDrinks: 0,
      cheatMeal: false,
      mobility: false,
      reading: false,
      sleepTime: '23:45',
      wakeTime: '07:30',
      water: '',
      cravings: 0,
      energy: 'Good',
      soreness: 'Low',
      moodTimeline: blankMoodTimeline(),
      notes: '',
    },
    reflection: {
      grateful: '',
      smile: '',
      comments: '',
    },
  };
}

function findEntry(personId = currentPersonId(), date = state.selectedDate) {
  if (!personId) return null;
  return state.entries.find((e) => (e.person_key || e.user_id) === personId && e.entry_date === date);
}

function getEditableEntry() {
  const existing = findEntry();
  const blank = blankEntry();
  if (!existing) return blank;
  return {
    meals: mergeMeals(blank.meals, existing.meals || {}),
    habits: {
      ...blank.habits,
      ...(existing.habits || {}),
      moodTimeline: { ...blankMoodTimeline(), ...(existing.habits?.moodTimeline || {}) },
    },
    reflection: { ...blank.reflection, ...(existing.reflection || {}) },
  };
}

function mergeMeals(blank, saved) {
  const next = { ...blank };
  MEALS.forEach((meal) => {
    next[meal.key] = { ...blank[meal.key], ...(saved?.[meal.key] || {}) };
  });
  return next;
}

function calculateScore(habits, meals, reflection) {
  const totalProtein = totalMealProtein(meals);
  const points = [
    totalProtein >= GOALS.protein,
    safeNumber(habits.steps) >= GOALS.steps,
    safeNumber(habits.workoutMinutes) >= 20 || habits.workoutType === 'Badminton',
    safeNumber(habits.cigarettes) === 0,
    safeNumber(habits.alcoholDrinks) === 0,
    Boolean(habits.mobility),
    Boolean(habits.reading),
    sleptBeforeMidnight(habits.sleepTime),
    hasText(reflection.grateful),
    hasText(reflection.smile),
  ];
  return points.filter(Boolean).length;
}

async function chooseIdentity(persona) {
  state.selectedPerson = persona;
  localStorage.setItem('betterUsSelectedPerson', persona);
  await hydrate();
  render();
}

async function saveEntryFromForm(event) {
  event.preventDefault();
  if (!currentPersonId()) {
    state.message = 'Choose Sammy or Shreya first.';
    render();
    return;
  }

  const form = new FormData(event.currentTarget);
  const existing = getEditableEntry();

  const meals = {};
  for (const meal of MEALS) {
    meals[meal.key] = {
      text: form.get(`${meal.key}_text`)?.toString() || '',
      protein: safeNumber(form.get(`${meal.key}_protein`), 0),
      image: await imageFromInput(form.get(`${meal.key}_image`), existing.meals?.[meal.key]?.image || ''),
    };
  }

  const moodTimeline = {};
  for (const [key] of MOOD_SLOTS) {
    moodTimeline[key] = {
      mood: form.get(`mood_${key}`)?.toString() || '',
      note: form.get(`mood_${key}_note`)?.toString() || '',
    };
  }

  const habits = {
    steps: safeNumber(form.get('steps'), 0),
    workoutType: form.get('workoutType')?.toString() || '',
    workoutMinutes: safeNumber(form.get('workoutMinutes'), 0),
    workoutImage: await imageFromInput(form.get('workoutImage'), existing.habits?.workoutImage || ''),
    cigarettes: safeNumber(form.get('cigarettes'), 0),
    cravings: safeNumber(form.get('cravings'), 0),
    alcoholDrinks: safeNumber(form.get('alcoholDrinks'), 0),
    cheatMeal: form.get('cheatMeal') === 'on',
    mobility: form.get('mobility') === 'on',
    reading: form.get('reading') === 'on',
    sleepTime: normalizeTime(form.get('sleepTime')),
    wakeTime: normalizeTime(form.get('wakeTime')),
    water: safeNumber(form.get('water'), 0),
    energy: form.get('energy')?.toString() || 'Good',
    soreness: form.get('soreness')?.toString() || 'Low',
    moodTimeline,
    notes: form.get('notes')?.toString() || '',
  };

  const reflection = {
    grateful: form.get('grateful')?.toString() || '',
    smile: form.get('smile')?.toString() || '',
    comments: form.get('comments')?.toString() || '',
  };

  const score = calculateScore(habits, meals, reflection);
  const person_key = currentPersonId();
  const couple_id = FIXED_COUPLE_ID;
  const entry_date = state.selectedDate;

  const tomorrowMessage = form.get('tomorrowMessage')?.toString().trim();
  const messageDuration = Math.max(1, safeNumber(form.get('messageDuration'), 1));
  const messageStartChoice = form.get('messageStart')?.toString() || 'tomorrow';
  const start_date = messageStartChoice === 'today' ? entry_date : addDays(entry_date, 1);
  const end_date = addDays(start_date, messageDuration - 1);
  const audience = form.get('messageAudience')?.toString() || 'both';

  const saveLocally = () => {
    const entries = getLocalEntries().filter((e) => !((e.person_key || e.user_id) === person_key && e.entry_date === entry_date));
    entries.push({ id: uid(), person_key, user_id: person_key, couple_id, entry_date, meals, habits, reflection, score, updated_at: new Date().toISOString() });
    setLocalEntries(entries);
    state.entries = entries;

    if (tomorrowMessage) {
      const messages = getLocalMessages();
      messages.push({
        id: uid(),
        couple_id,
        author_key: person_key,
        author_id: person_key,
        author_name: currentDisplayName(),
        message_text: tomorrowMessage,
        audience,
        start_date,
        end_date,
        created_at: new Date().toISOString(),
      });
      setLocalMessages(messages);
      state.messages = messages;
    }
  };

  if (hasCloud) {
    try {
      const { error } = await supabase
        .from('daily_entries')
        .upsert({ person_key, couple_id, entry_date, meals, habits, reflection, score }, { onConflict: 'couple_id,person_key,entry_date' });

      if (error) throw error;

      // Mirror to local storage so fallback mode has fresh data if cloud goes down.
      const localEntries = getLocalEntries().filter((e) => !((e.person_key || e.user_id) === person_key && e.entry_date === entry_date));
      localEntries.push({ id: uid(), person_key, user_id: person_key, couple_id, entry_date, meals, habits, reflection, score, updated_at: new Date().toISOString() });
      setLocalEntries(localEntries);

      if (tomorrowMessage) {
        const { error: messageError } = await supabase.from('message_cards').insert({
          couple_id,
          author_key: person_key,
          author_name: currentDisplayName(),
          message_text: tomorrowMessage,
          audience,
          start_date,
          end_date,
        });
        if (messageError) throw messageError;
        const localMessages = getLocalMessages();
        localMessages.push({
          id: uid(),
          couple_id,
          author_key: person_key,
          author_id: person_key,
          author_name: currentDisplayName(),
          message_text: tomorrowMessage,
          audience,
          start_date,
          end_date,
          created_at: new Date().toISOString(),
        });
        setLocalMessages(localMessages);
      }
    } catch (error) {
      // If Supabase is not ready yet, save on the device without showing error cards.
      saveLocally();
    }
  } else {
    saveLocally();
  }

  await hydrate();
  render();
}

function imageFromInput(fileLike, fallback = '') {
  if (!(fileLike instanceof File) || !fileLike.size) return Promise.resolve(fallback);
  return compressImage(fileLike, 1100, 0.78);
}

function compressImage(file, maxSide = 1100, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function resetIdentity() {
  state.selectedPerson = '';
  localStorage.removeItem('betterUsSelectedPerson');
  render();
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), entries: state.entries, messages: state.messages }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `better-us-backup-${localDate()}.json`;
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
      setLocalEntries(parsed.entries);
      setLocalMessages(Array.isArray(parsed.messages) ? parsed.messages : []);
      state.entries = parsed.entries;
      state.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
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
      ${state.message ? `<div class="toast" role="alert">${escapeHtml(state.message)}</div>` : ''}
      ${!currentPersonId() ? identityPicker() : appView()}
    </main>
  `;
  bindEvents();
}

function hero() {
  return `
    <section class="hero">
      <div class="brand-lockup">
        <div class="logo-mark">BU</div>
        <div>
          <p class="eyebrow">${APP_NAME} · Sammy × Shreya</p>
          <h1>A private health game for two.</h1>
          <p class="subtitle">Track protein, workouts, mood every three hours, no cigarettes, sleep, gratitude, smiles and tomorrow's tiny promises.</p>
        </div>
      </div>
      <div class="hero-card floaty">
        <span class="heart">♥</span>
        <strong>${escapeHtml(currentDisplayName())}</strong>
      </div>
    </section>
  `;
}

function localModeBanner() {
  return `
    <section class="notice-grid">
      <div class="notice">
        <strong>Prototype mode is active.</strong>
        <p>Data is saved only in this browser. Connect Supabase when you want Sammy and Shreya to sync from different phones.</p>
      </div>
      <div class="notice actions-inline">
        <button class="ghost" data-action="export">Export backup JSON</button>
        <label class="ghost file-label">Import backup <input type="file" accept="application/json" data-action="import" hidden /></label>
      </div>
    </section>
  `;
}


function identityPicker() {
  return `
    <section class="identity-wrap">
      <div class="card identity-card">
        <p class="eyebrow">First step</p>
        <h2>Who is using the app?</h2>
        <p class="muted">Pick your side. Your side becomes editable. The other side stays visible for comparison and support.</p>
        <div class="identity-grid">
          ${PEOPLE.map((p) => `
            <button class="identity-choice ${p.color}" data-persona="${p.id}" type="button">
              <span>${p.emoji}</span>
              <strong>I’m ${p.display_name}</strong>
              <small>Open ${p.display_name}'s tracker</small>
            </button>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function appView() {
  return `
    ${topBar()}
    ${!hasCloud ? localModeBanner() : ''}
    ${activeMessageStrip()}
    ${navTabs()}
    ${viewContent()}
  `;
}

function topBar() {
  const me = getPerson(currentPersonId());
  return `
    <section class="topbar card glass">
      <div>
        <label>Date</label>
        <input type="date" value="${state.selectedDate}" data-action="date" />
      </div>
      <div>
        <label>You are</label>
        <div class="person-switch">
          <span class="avatar small">${me.display_name.slice(0, 1)}</span>
          <strong>${me.display_name}</strong>
          <button class="link-button" data-action="switch-person" type="button">Switch</button>
        </div>
      </div>
      <div>
        <label>Storage</label>
        <div class="pill ${state.syncStatus === 'connected' ? 'good' : state.syncStatus === 'fallback' ? 'warn' : ''}">${syncLabel()}</div>
      </div>
    </section>
  `;
}

function syncLabel() {
  if (!hasCloud) return 'Local browser';
  if (state.syncStatus === 'connected') return 'Cloud sync on';
  if (state.syncStatus === 'fallback') return 'Local fallback';
  return 'Checking sync';
}

function navTabs() {
  const tabs = [
    ['today', 'Today', '☀️'],
    ['meals', 'Meals', '🍲'],
    ['progress', 'Progress', '📈'],
    ['us', 'Us', '💛'],
    ['settings', 'Settings', '⚙️'],
  ];
  return `
    <nav class="tabs" aria-label="Main navigation">
      ${tabs.map(([key, label, icon]) => `
        <button class="tab ${state.activeView === key ? 'active' : ''}" data-view="${key}" type="button">
          <span>${icon}</span>${label}
        </button>
      `).join('')}
    </nav>
  `;
}

function viewContent() {
  if (state.activeView === 'meals') return mealsView();
  if (state.activeView === 'progress') return progressView();
  if (state.activeView === 'us') return usView();
  if (state.activeView === 'settings') return settingsView();
  return todayView();
}

function todayView() {
  const entry = getEditableEntry();
  const stats = getStats();
  return `
    ${dashboard(stats)}
    <section class="grid main-grid">
      ${dailyForm(entry)}
      ${sidePanel(stats)}
    </section>
  `;
}

function activeMessageStrip() {
  const messages = activeMessages(state.selectedDate);
  if (!messages.length) {
    return `
      <section class="message-strip empty">
        <div class="sticky-note soft">
          <span class="note-label">Tomorrow note</span>
          <strong>No active message yet.</strong>
          <p>Add one during tonight's check-in and it will flash here for the selected number of days.</p>
        </div>
      </section>
    `;
  }
  const ordered = [...messages].sort((a, b) => String(a.author_key || a.author_id).localeCompare(String(b.author_key || b.author_id)));
  return `
    <section class="message-strip">
      ${ordered.slice(0, 4).map((m) => `
        <article class="sticky-note pulse ${m.author_key === 'shreya' || m.author_id === 'shreya' ? 'right-note' : 'left-note'}">
          <span class="note-label">${escapeHtml(m.author_name || personName(m.author_key || m.author_id))} says</span>
          <strong>${escapeHtml(m.message_text)}</strong>
          <p>${formatMessageDates(m)}</p>
        </article>
      `).join('')}
    </section>
  `;
}

function activeMessages(date) {
  const me = currentPersonId();
  return state.messages.filter((m) => {
    const starts = m.start_date || date;
    const ends = m.end_date || starts;
    const author = m.author_key || m.author_id;
    const audience = m.audience || 'both';
    const dateMatch = starts <= date && ends >= date;
    if (!dateMatch) return false;
    if (audience === 'both') return true;
    if (audience === 'me') return author === me;
    if (audience === 'partner') return author !== me;
    return true;
  });
}

function formatMessageDates(message) {
  if (message.start_date === message.end_date) return `For ${friendlyDate(message.start_date)}`;
  return `${friendlyDate(message.start_date)} to ${friendlyDate(message.end_date)}`;
}

function friendlyDate(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function dashboard(stats) {
  const peopleStats = orderedPeople().map((p) => personTodayStats(p.id));
  const coupleScore = peopleStats.reduce((sum, p) => sum + p.score, 0);
  const maxScore = peopleStats.length * GOALS.dailyMaxScore;
  return `
    <section class="score-hero card">
      <div>
        <p class="label">Today's couple score</p>
        <h2>${coupleScore}<span>/${maxScore}</span></h2>
        <p class="muted">Left side is yours. Right side is your partner's. Compare gently, support quickly.</p>
      </div>
      <div class="score-orb">${Math.round((coupleScore / Math.max(1, maxScore)) * 100)}%</div>
    </section>

    <section class="person-grid compare-grid">
      ${peopleStats.map((p, index) => personCard(p, index === 0 ? 'Mine' : 'Partner')).join('')}
    </section>

    <section class="dash-grid">
      ${metricCard('Your score', `${stats.todayScore}/${GOALS.dailyMaxScore}`, (stats.todayScore / GOALS.dailyMaxScore) * 100, 'Daily habit points')}
      ${metricCard('Protein', `${stats.todayProtein}g`, (stats.todayProtein / GOALS.protein) * 100, 'Target 60g+')}
      ${metricCard('Steps', `${stats.todaySteps}`, (stats.todaySteps / GOALS.steps) * 100, 'Target 8k now, 10k later')}
      <div class="card streak-card">
        <p class="label">No cigarette streak</p>
        <h3>${stats.noCigStreak} days</h3>
        <p class="muted">Complete quit from day 1. No “just one” rule.</p>
      </div>
    </section>
  `;
}

function personTodayStats(personId) {
  const entry = findEntry(personId, state.selectedDate);
  const timeline = entry?.habits?.moodTimeline || {};
  return {
    id: personId,
    name: personName(personId),
    protein: totalMealProtein(entry?.meals || {}),
    steps: safeNumber(entry?.habits?.steps),
    workout: entry?.habits?.workoutType || 'Pending',
    cigarettes: safeNumber(entry?.habits?.cigarettes),
    sleep: entry?.habits?.sleepTime || 'Pending',
    score: safeNumber(entry?.score),
    grateful: entry?.reflection?.grateful || '',
    smile: entry?.reflection?.smile || '',
    timeline,
  };
}

function personCard(p, label) {
  return `
    <article class="card person-card ${p.id === currentPersonId() ? 'selected' : ''}">
      <div class="person-head">
        <div class="avatar">${p.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <span class="owner-label">${label}</span>
          <h3>${escapeHtml(p.name)}</h3>
          <p class="muted">Score ${p.score}/${GOALS.dailyMaxScore}</p>
        </div>
      </div>
      <div class="mini-metrics">
        <span>Protein <b>${p.protein}/${GOALS.protein}g</b></span>
        <span>Steps <b>${p.steps}/${GOALS.steps}</b></span>
        <span>Workout <b>${escapeHtml(p.workout)}</b></span>
        <span>Cigs <b>${p.cigarettes}</b></span>
        <span>Sleep <b>${escapeHtml(p.sleep)}</b></span>
      </div>
      <div class="mood-strip-small">
        ${MOOD_SLOTS.map(([key, label]) => `<span title="${label}: ${escapeHtml(p.timeline?.[key]?.mood || 'Not logged')}">${moodEmoji(p.timeline?.[key]?.mood)}</span>`).join('')}
      </div>
    </article>
  `;
}

function moodEmoji(mood) {
  const map = { Great: '🤩', Good: '🙂', Okay: '😐', Low: '😔', Stressed: '😣', Tired: '🥱', Calm: '😌', Irritated: '😤' };
  return map[mood] || '○';
}

function metricCard(label, value, pct, note) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const safePct = Math.max(0, Math.min(100, pct || 0));
  const offset = circumference - (safePct / 100) * circumference;
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
          <h2>${escapeHtml(currentDisplayName())}'s daily check-in</h2>
          <p class="muted">Food, movement, mood, recovery and the small emotional bits that make the habit stick.</p>
        </div>
        <span class="pill">Editable side</span>
      </div>
      <form data-form="entry">
        <h3>1. Meals & protein</h3>
        <div class="meal-grid">
          ${MEALS.map((meal) => mealInput(meal, entry.meals?.[meal.key])).join('')}
        </div>

        <h3>2. Movement, recovery & lifestyle</h3>
        <div class="habit-grid">
          ${numberInput('steps', 'Steps', entry.habits.steps, '8000')}
          ${selectInput('workoutType', 'Workout type', entry.habits.workoutType, ['', 'Strength', 'Cardio', 'Badminton', 'Walk', 'Mobility', 'Rest day'])}
          ${numberInput('workoutMinutes', 'Workout minutes', entry.habits.workoutMinutes, '35')}
          ${numberInput('cigarettes', 'Cigarettes', entry.habits.cigarettes, '0')}
          ${numberInput('cravings', 'Cigarette craving 0-10', entry.habits.cravings, '0')}
          ${numberInput('alcoholDrinks', 'Alcohol drinks', entry.habits.alcoholDrinks, '0')}
          ${numberInput('water', 'Water litres', entry.habits.water, '2.5', '0.1')}
          ${timeInput('sleepTime', 'Sleep time', entry.habits.sleepTime)}
          ${timeInput('wakeTime', 'Wake time', entry.habits.wakeTime)}
          ${selectInput('energy', 'Energy', entry.habits.energy, ['High', 'Good', 'Okay', 'Low'])}
          ${selectInput('soreness', 'Soreness', entry.habits.soreness, ['None', 'Low', 'Medium', 'High'])}
          <label class="field photo-field">
            <span>Workout photo</span>
            <input name="workoutImage" type="file" accept="image/*" />
            ${entry.habits.workoutImage ? `<img class="photo-preview" src="${entry.habits.workoutImage}" alt="Workout upload" />` : '<small class="muted">Optional: upload gym, walk or badminton proof.</small>'}
          </label>
        </div>

        <div class="checks">
          ${checkInput('mobility', '10 min mobility', entry.habits.mobility)}
          ${checkInput('reading', '15 min reading', entry.habits.reading)}
          ${checkInput('cheatMeal', 'Weekly cheat meal used', entry.habits.cheatMeal)}
        </div>

        <h3>3. Mood timeline</h3>
        <p class="muted tight">Instead of one vague mood for the day, log how you felt every three hours from 9 AM to 12 AM.</p>
        <div class="mood-grid">
          ${MOOD_SLOTS.map(([key, label]) => moodInput(key, label, entry.habits.moodTimeline?.[key])).join('')}
        </div>

        <h3>4. Gratitude ritual</h3>
        <div class="reflection-grid">
          <label class="field">
            <span>One thing I’m grateful for today</span>
            <textarea name="grateful" rows="3" placeholder="Example: Grateful that we walked after dinner.">${escapeHtml(entry.reflection.grateful || '')}</textarea>
          </label>
          <label class="field">
            <span>One thing that made me smile</span>
            <textarea name="smile" rows="3" placeholder="Example: She laughed at that stupid joke.">${escapeHtml(entry.reflection.smile || '')}</textarea>
          </label>
          <label class="field full-span">
            <span>Additional comment from today</span>
            <textarea name="comments" rows="3" placeholder="Anything you want to remember about today.">${escapeHtml(entry.reflection.comments || '')}</textarea>
          </label>
        </div>

        <h3>5. Message for tomorrow</h3>
        <div class="tomorrow-box">
          <label class="field full-span">
            <span>Message / challenge</span>
            <textarea name="tomorrowMessage" rows="3" placeholder="Example: No rice for two days. Light dinner and sleep by 11:45."></textarea>
          </label>
          <div class="habit-grid compact">
            ${selectInput('messageAudience', 'Show this to', 'both', ['both', 'me', 'partner'])}
            ${selectInput('messageStart', 'Start showing', 'tomorrow', ['tomorrow', 'today'])}
            ${numberInput('messageDuration', 'Duration in days', 1, '2')}
          </div>
        </div>

        <label class="field full">
          <span>Notes / cravings / wins</span>
          <textarea name="notes" rows="4" placeholder="Example: Craved cigarette after lunch, walked for 7 minutes instead.">${escapeHtml(entry.habits.notes || '')}</textarea>
        </label>

        <button type="submit" class="save">Save ${escapeHtml(currentDisplayName())}'s day</button>
      </form>
    </section>
  `;
}

function mealInput(meal, value = {}) {
  return `
    <div class="meal-card">
      <div class="meal-title">
        <strong>${meal.label}</strong>
        <span>${meal.idea}</span>
      </div>
      <label>
        <span>What did you eat?</span>
        <textarea name="${meal.key}_text" rows="3" placeholder="${meal.idea}">${escapeHtml(value.text || '')}</textarea>
      </label>
      <div class="preset-row">
        ${meal.presets.map(([text, protein]) => `<button type="button" class="preset" data-meal="${meal.key}" data-text="${escapeHtml(text)}" data-protein="${protein}">+ ${escapeHtml(text)}</button>`).join('')}
      </div>
      <label>
        <span>Protein g</span>
        <input name="${meal.key}_protein" type="number" min="0" value="${safeNumber(value.protein, '')}" placeholder="15" />
      </label>
      <label class="photo-upload">
        <span>Meal photo</span>
        <input name="${meal.key}_image" type="file" accept="image/*" />
        ${value.image ? `<img class="photo-preview" src="${value.image}" alt="${meal.label} upload" />` : '<small class="muted">Optional: upload a quick food photo.</small>'}
      </label>
    </div>
  `;
}

function moodInput(key, label, value = {}) {
  return `
    <div class="mood-card">
      <div><strong>${label}</strong><span>${moodEmoji(value.mood)}</span></div>
      <select name="mood_${key}">${MOOD_OPTIONS.map((o) => `<option value="${o}" ${o === value.mood ? 'selected' : ''}>${o || 'Not logged'}</option>`).join('')}</select>
      <input name="mood_${key}_note" value="${escapeHtml(value.note || '')}" placeholder="Tiny note" />
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
  return `<label class="field"><span>${label}</span><select name="${name}">${options.map((o) => `<option value="${o}" ${o === value ? 'selected' : ''}>${labelForOption(o)}</option>`).join('')}</select></label>`;
}

function labelForOption(option) {
  if (!option) return 'Choose';
  if (option === 'both') return 'Both of us';
  if (option === 'me') return 'Only me';
  if (option === 'partner') return 'Partner';
  if (option === 'tomorrow') return 'Tomorrow';
  if (option === 'today') return 'Today';
  return option;
}

function checkInput(name, label, checked) {
  return `<label class="check"><input name="${name}" type="checkbox" ${checked ? 'checked' : ''} /><span>${label}</span></label>`;
}

function sidePanel(stats) {
  return `
    <aside class="side-stack">
      <section class="card">
        <h2>Buddy pact</h2>
        <div class="buddy-list">
          <div><strong>No shame</strong><p>If someone slips, the question is: what can we do in the next 10 minutes?</p></div>
          <div><strong>No hiding</strong><p>Cigarettes, alcohol and missed workouts are logged honestly.</p></div>
          <div><strong>No missing twice</strong><p>One off-day is normal. Two becomes the rescue signal.</p></div>
        </div>
      </section>

      <section class="card">
        <h2>Last 7 days</h2>
        <div class="mini-bars">
          ${stats.week.map((d) => `<div><span>${d.day}</span><i style="height:${Math.max(6, d.score * 10)}px"></i><b>${d.score}</b></div>`).join('')}
        </div>
        <p class="muted">Aim for 45+ points/week individually. Celebrate consistency, not perfection.</p>
      </section>

      <section class="card danger-soft">
        <h2>Cigarette craving protocol</h2>
        <ol>
          <li>Drink water.</li>
          <li>Chew saunf or gum.</li>
          <li>Walk for 5 minutes.</li>
          <li>Delay 10 minutes before acting.</li>
        </ol>
      </section>
    </aside>
  `;
}

function mealsView() {
  const recent = recentMealPhotos();
  return `
    <section class="grid two">
      <div class="card">
        <h2>Simple 60g protein day</h2>
        <p class="muted">No calorie obsession. Just hit protein, greens and fibre consistently.</p>
        <div class="meal-plan-cards">
          <div><strong>Breakfast</strong><span>2 eggs + curd bowl</span><b>~20g</b></div>
          <div><strong>Lunch</strong><span>Chicken/fish + dal + greens</span><b>~30g</b></div>
          <div><strong>Snack</strong><span>Roasted chana / egg / curd</span><b>~10g</b></div>
          <div><strong>Dinner</strong><span>Prawns/fish/chicken + sabzi</span><b>~25g</b></div>
        </div>
      </div>
      <div class="card">
        <h2>Food rules</h2>
        <ul class="clean-list">
          <li>Protein target: 60g minimum per person.</li>
          <li>Green veggies at lunch or dinner daily.</li>
          <li>Fiber source daily: dal, veggies, fruits, sprouts, chana, oats.</li>
          <li>Mutton avoided. Chicken, fish, eggs and prawns included.</li>
          <li>One cheat meal per week. Not a full cheat day.</li>
        </ul>
      </div>
    </section>

    <section class="card">
      <h2>Meal library</h2>
      <div class="library-grid">
        ${MEALS.flatMap((m) => m.presets.map(([text, protein]) => `<div class="library-card"><strong>${escapeHtml(text)}</strong><span>~${protein}g protein</span><small>${m.label}</small></div>`)).join('')}
      </div>
    </section>

    <section class="card">
      <h2>Recent food photos</h2>
      <div class="photo-grid">
        ${recent.length ? recent.map((p) => `<article><img src="${p.src}" alt="Meal"><span>${escapeHtml(p.name)} · ${friendlyDate(p.date)} · ${escapeHtml(p.meal)}</span></article>`).join('') : '<p class="muted">Meal photos will appear here after you upload them in daily check-in.</p>'}
      </div>
    </section>
  `;
}

function progressView() {
  const stats = getStats();
  const monthlyAlcohol = PEOPLE.map((p) => ({ name: p.display_name, count: alcoholThisMonth(p.id) }));
  return `
    <section class="grid two">
      <div class="card">
        <h2>This week</h2>
        <div class="big-bars">
          ${stats.week.map((d) => `<div><span>${d.day}</span><i style="height:${Math.max(8, d.score * 18)}px"></i><b>${d.score}</b></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h2>Monthly alcohol limit</h2>
        <p class="muted">Goal: drink only twice a month.</p>
        <div class="limit-list">
          ${monthlyAlcohol.map((p) => `<div><span>${escapeHtml(p.name)}</span><strong>${p.count}/${GOALS.alcoholMonthlyLimit}</strong></div>`).join('')}
        </div>
      </div>
    </section>

    <section class="person-grid">
      ${PEOPLE.map((p) => {
        const s = personAggregate(p.id);
        return `<article class="card person-card"><h3>${escapeHtml(p.display_name)}</h3><div class="mini-metrics"><span>Protein hit <b>${s.proteinHit}/7</b></span><span>Steps hit <b>${s.stepsHit}/7</b></span><span>Smoke-free <b>${s.smokeFree}/7</b></span><span>Reading <b>${s.reading}/7</b></span><span>Mood slots <b>${s.moodSlots}/42</b></span></div></article>`;
      }).join('')}
    </section>
  `;
}

function usView() {
  const reflections = recentReflections();
  const messages = state.messages.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))).slice(0, 8);
  return `
    <section class="grid two">
      <div class="card">
        <h2>Gratitude wall</h2>
        <div class="reflection-wall">
          ${reflections.length ? reflections.map((r) => `
            <article>
              <span>${escapeHtml(r.name)} · ${friendlyDate(r.date)}</span>
              ${r.grateful ? `<p>🙏 ${escapeHtml(r.grateful)}</p>` : ''}
              ${r.smile ? `<p>😊 ${escapeHtml(r.smile)}</p>` : ''}
            </article>
          `).join('') : '<p class="muted">Your gratitude and smile entries will appear here.</p>'}
        </div>
      </div>
      <div class="card">
        <h2>Sunday review</h2>
        <ul class="clean-list">
          <li>What went well this week?</li>
          <li>Where did we support each other?</li>
          <li>What habit was hardest?</li>
          <li>What is one adjustment for next week?</li>
          <li>One thing I appreciated about you:</li>
        </ul>
      </div>
    </section>

    <section class="card">
      <h2>Message history</h2>
      <div class="message-history">
        ${messages.length ? messages.map((m) => `<div><strong>${escapeHtml(m.message_text)}</strong><span>${escapeHtml(m.author_name || personName(m.author_key || m.author_id))} · ${formatMessageDates(m)}</span></div>`).join('') : '<p class="muted">Tomorrow messages will be saved here.</p>'}
      </div>
    </section>
  `;
}

function settingsView() {
  return `
    <section class="grid two">
      <div class="card">
        <h2>Private two-person setup</h2>
        <p class="muted">This app is fixed for Sammy and Shreya. No invite code, no couple-space creation, no groups.</p>
        <ul class="clean-list">
          <li>Open the app.</li>
          <li>Choose Sammy or Shreya.</li>
          <li>Your side becomes editable.</li>
          <li>Your partner's side stays visible for progress comparison.</li>
        </ul>
        <button class="ghost left" data-action="switch-person" type="button">Switch Sammy / Shreya</button>
      </div>
      <div class="card status-card">
        <h2>App status</h2>
        ${syncStatusCard()}
      </div>
      <div class="card">
        <h2>Data backup</h2>
        <p class="muted">Use this only when you want to keep a manual backup or move local test data.</p>
        <div class="actions-inline left">
          <button class="ghost" data-action="export">Export backup JSON</button>
          <label class="ghost file-label">Import backup <input type="file" accept="application/json" data-action="import" hidden /></label>
        </div>
      </div>
      <div class="card">
        <h2>Private link rule</h2>
        <p class="muted">There is no login in this version. Anyone with the Vercel link can open the app, view data, or edit entries. Keep the link private.</p>
      </div>
    </section>
  `;
}

function syncStatusCard() {
  if (!hasCloud) {
    return `
      <div class="status-row warn-soft"><span>Cloud sync</span><strong>Not connected</strong></div>
      <p class="muted">The app is currently saving only in this browser. Sammy and Shreya will not sync across phones until Supabase environment variables are added in Vercel and the app is redeployed.</p>
    `;
  }

  if (state.syncStatus === 'connected') {
    return `
      <div class="status-row good-soft"><span>Cloud sync</span><strong>Connected</strong></div>
      <p class="muted">Entries are being read from Supabase. Updates should sync across Sammy and Shreya's devices.</p>
      ${state.lastSyncAt ? `<p class="tiny-muted">Last checked: ${new Date(state.lastSyncAt).toLocaleString()}</p>` : ''}
    `;
  }

  if (state.syncStatus === 'fallback') {
    return `
      <div class="status-row warn-soft"><span>Cloud sync</span><strong>Local fallback</strong></div>
      <p class="muted">The app could not load Supabase, so it is quietly saving to this browser for now.</p>
      <p class="sync-error">${escapeHtml(state.lastSyncError || 'Cloud sync failed.')}</p>
      <p class="tiny-muted">Check Vercel environment variables, Supabase URL/key, and whether the schema.sql file has been run.</p>
    `;
  }

  return `
    <div class="status-row"><span>Cloud sync</span><strong>Checking</strong></div>
    <p class="muted">The app is checking Supabase connection.</p>
  `;
}

function getStats() {
  const personId = currentPersonId();
  const entry = findEntry(personId, state.selectedDate);
  const todayProtein = totalMealProtein(entry?.meals || {});
  const todaySteps = safeNumber(entry?.habits?.steps);
  const todayScore = safeNumber(entry?.score);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(state.selectedDate, i - 6));
  const week = weekDates.map((date) => {
    const e = findEntry(personId, date);
    return { day: new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3), score: safeNumber(e?.score) };
  });

  let streak = 0;
  for (let i = 0; i < 90; i++) {
    const date = addDays(state.selectedDate, -i);
    const e = findEntry(personId, date);
    if (!e || safeNumber(e.habits?.cigarettes) !== 0) break;
    streak += 1;
  }

  return { todayProtein, todaySteps, todayScore, week, noCigStreak: streak };
}

function alcoholThisMonth(personId) {
  const month = state.selectedDate.slice(0, 7);
  return state.entries.filter((e) => (e.person_key || e.user_id) === personId && e.entry_date?.startsWith(month) && safeNumber(e.habits?.alcoholDrinks) > 0).length;
}

function personAggregate(personId) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(state.selectedDate, i - 6));
  const entries = dates.map((date) => findEntry(personId, date)).filter(Boolean);
  return {
    proteinHit: entries.filter((e) => totalMealProtein(e.meals) >= GOALS.protein).length,
    stepsHit: entries.filter((e) => safeNumber(e.habits?.steps) >= GOALS.steps).length,
    smokeFree: entries.filter((e) => safeNumber(e.habits?.cigarettes) === 0).length,
    reading: entries.filter((e) => Boolean(e.habits?.reading)).length,
    moodSlots: entries.reduce((sum, e) => sum + Object.values(e.habits?.moodTimeline || {}).filter((slot) => slot?.mood).length, 0),
  };
}

function recentReflections() {
  return state.entries
    .filter((e) => e.reflection && (hasText(e.reflection.grateful) || hasText(e.reflection.smile)))
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .slice(0, 10)
    .map((e) => ({
      name: personName(e.person_key || e.user_id),
      date: e.entry_date,
      grateful: e.reflection.grateful,
      smile: e.reflection.smile,
    }));
}

function recentMealPhotos() {
  const photos = [];
  state.entries
    .slice()
    .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
    .forEach((entry) => {
      MEALS.forEach((meal) => {
        const image = entry.meals?.[meal.key]?.image;
        if (image) photos.push({ src: image, date: entry.entry_date, meal: meal.label, name: personName(entry.person_key || entry.user_id) });
      });
    });
  return photos.slice(0, 12);
}

function bindEvents() {
  document.querySelector('[data-form="entry"]')?.addEventListener('submit', saveEntryFromForm);
  document.querySelector('[data-action="date"]')?.addEventListener('change', (e) => { state.selectedDate = e.target.value; render(); });
  document.querySelectorAll('[data-action="switch-person"]').forEach((node) => node.addEventListener('click', resetIdentity));
  document.querySelectorAll('[data-action="export"]').forEach((node) => node.addEventListener('click', exportData));
  document.querySelectorAll('[data-action="import"]').forEach((node) => node.addEventListener('change', importData));
  document.querySelectorAll('[data-persona]').forEach((node) => node.addEventListener('click', () => chooseIdentity(node.dataset.persona)));
  document.querySelectorAll('[data-view]').forEach((node) => {
    node.addEventListener('click', () => {
      state.activeView = node.dataset.view;
      localStorage.setItem('betterUsActiveView', state.activeView);
      render();
    });
  });
  document.querySelectorAll('.preset').forEach((button) => button.addEventListener('click', () => addMealPreset(button)));
  document.querySelectorAll('input[type="file"][accept="image/*"]').forEach((input) => input.addEventListener('change', previewImageInput));
}

function addMealPreset(button) {
  const meal = button.dataset.meal;
  const text = button.dataset.text;
  const protein = safeNumber(button.dataset.protein);
  const textarea = document.querySelector(`[name="${meal}_text"]`);
  const proteinInput = document.querySelector(`[name="${meal}_protein"]`);
  if (!textarea || !proteinInput) return;
  textarea.value = textarea.value ? `${textarea.value}, ${text}` : text;
  proteinInput.value = safeNumber(proteinInput.value) + protein;
  button.classList.add('clicked');
  setTimeout(() => button.classList.remove('clicked'), 450);
}

function previewImageInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const label = event.target.closest('label');
    const existing = label?.querySelector('.photo-preview');
    if (existing) {
      existing.src = reader.result;
      return;
    }
    label?.querySelector('small')?.remove();
    const img = document.createElement('img');
    img.className = 'photo-preview';
    img.alt = 'Upload preview';
    img.src = reader.result;
    label?.appendChild(img);
  };
  reader.readAsDataURL(file);
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
