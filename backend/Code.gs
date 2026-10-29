// Emma's homework site: backend for the Google Sheet.
// Lives in the sheet under Extensions > Apps Script. After pasting a new version:
// save, then Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy (same link keeps working).
// The chat box needs an Anthropic API key in Project Settings > Script properties, named ANTHROPIC_API_KEY.

const TZ = 'America/New_York';
const NTFY_TOPIC = 'emma-hw-5e47c8b0dc56';
const DAYS_AHEAD = 7;
const SITE_URL = 'https://soficaggt.github.io/emma-homework/';
const T_COLS = ['id', 'date', 'title', 'note', 'dur', 'cat', 'order', 'done', 'doneAt', 'proofText', 'proofPhoto', 'deleted', 'addedBy', 'updatedAt', 'color', 'due', 'pile', 'coins'];
const TPL_COLS = ['weekday', 'title', 'note', 'dur', 'cat', 'order', 'dueInDays'];
const S_COLS = ['taskId', 'title', 'startedAt'];
const D_COLS = ['date', 'bring'];
const Q_COLS = ['id', 'date', 'kind', 'color', 'name', 'rarity', 'openedAt', 'realWeek', 'itemId', 'texture', 'price', 'cat', 'pos', 'source'];
const L_COLS = ['id', 'date', 'kind', 'amount', 'name', 'used', 'at'];
const CATS = ['test', 'school', 'hunter', 'rsm', 'fixed', 'flex'];
const COLORS = ['purple', 'blue', 'white', 'black', 'lavender', 'sky', 'teal', 'green', 'lime', 'yellow', 'orange', 'pink', 'red', 'brown', 'gray'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const CHAT_MODEL = 'claude-sonnet-5-5';
const CHATS_PER_DAY = 80;

// The collection: real squishies and slimes Emma loves, by brand. Names are the real products so Sofia can order the one she picks.
// Rarity = how hard it is to actually get right now (a NeeDoh Nice Cube is rare because it sells out everywhere).
// Prices are rough real-store prices in dollars, used to keep the weekly real pick near $40.
// [id, real name, how it's drawn, color, rarity, texture, about $, shelf or slime]
const CATALOG = [
  ['five-below-glitter-dumpling', 'Glitter Dumpling Mystery Squishy (Five Below)', 'dumpling', 'white', 'common', 'gel', 5, 'shelf'],
  ['slow-rise-butter', 'Slow-Rising Butter Squishy', 'butter', 'yellow', 'common', 'foam', 9, 'shelf'],
  ['slow-rise-bread', 'Slow-Rising Bread Squishy', 'bread', 'brown', 'common', 'foam', 9, 'shelf'],
  ['glitter-gummee-ball', 'Glittery Gummee Ball', 'ball', 'pink', 'common', 'gel', 8, 'shelf'],
  ['bubble-sugar-cube', 'Bubble Sugar Squisher Cube', 'cube', 'sky', 'common', 'dough', 6, 'shelf'],
  ['axolotl-glitter', 'Axolotl Glitter Squishy', 'axolotl', 'pink', 'common', 'gel', 7, 'shelf'],
  ['kawaii-mochi-cat', 'Kawaii Mochi Cat Squishy', 'cat', 'lavender', 'common', 'foam', 3, 'shelf'],
  ['spiky-smoosh-ball', 'Spiky Smoosh Ball', 'spiky', 'lime', 'common', 'gel', 5, 'shelf'],
  ['smushmart-pickle', 'RMS SmushMart Giant 15" Pickle', 'pickle', 'green', 'uncommon', 'squeeze', 20, 'shelf'],
  ['smushmart-banana', 'RMS SmushMart Giant Banana', 'banana', 'yellow', 'uncommon', 'squeeze', 20, 'shelf'],
  ['crazy-fun-dumpling', 'RMS Crazy Fun Mystery Dumpling', 'dumpling', 'white', 'uncommon', 'gel', 10, 'shelf'],
  ['taba-butter-stick', 'Taba Slow-Rising Butter Stick', 'butter', 'yellow', 'uncommon', 'silicone', 10, 'shelf'],
  ['taba-mochi-cat', 'Taba Handmade Mochi Cat', 'cat', 'pink', 'uncommon', 'silicone', 15, 'shelf'],
  ['taba-cat-paw', 'Taba Cat Paw', 'paw', 'pink', 'uncommon', 'silicone', 12, 'shelf'],
  ['crazy-aarons-shortcake', "Crazy Aaron's Strawberry Shortcake SCENTsory Putty", 'tin', 'pink', 'uncommon', 'putty', 15, 'shelf'],
  ['needoh-nice-cube', 'NeeDoh Nice Cube', 'cube', 'sky', 'rare', 'dough', 6, 'shelf'],
  ['needoh-gumdrop', 'NeeDoh Gumdrop', 'gumdrop', 'pink', 'rare', 'gel', 8, 'shelf'],
  ['needoh-dohnut', 'NeeDoh Dohnut', 'donut', 'pink', 'rare', 'gel', 8, 'shelf'],
  ['needoh-groovy-glob', 'NeeDoh Groovy Glob', 'glob', 'teal', 'rare', 'gel', 6, 'shelf'],
  ['needoh-gummy-bear', 'NeeDoh Gummy Bear', 'gummybear', 'orange', 'rare', 'gel', 8, 'shelf'],
  ['needoh-nice-cream', 'NeeDoh Nice Cream', 'icecream', 'pink', 'rare', 'dough', 8, 'shelf'],
  ['taba-crystal', 'Taba Crystal Clear Squishy', 'ball', 'sky', 'rare', 'silicone', 25, 'shelf'],
  ['taba-flocked-bunny', 'Taba Flocked Bunny', 'bunny', 'lavender', 'rare', 'silicone', 20, 'shelf'],
  ['needoh-ice-baby', 'NeeDoh Nice Ice Baby', 'minicube', 'sky', 'legendary', 'dough', 10, 'shelf'],
  ['needoh-niceberg-glow', 'NeeDoh Glitter & Glow Niceberg', 'cube', 'lavender', 'legendary', 'gel', 15, 'shelf'],
  ['needoh-jelly-squish', 'NeeDoh Jelly Squish', 'jelly', 'pink', 'legendary', 'gel', 10, 'shelf'],
  ['crazy-fun-diamond', 'RMS Crazy Fun Mystery Dumpling, Diamond Edition', 'dumpling', 'sky', 'legendary', 'gel', 29, 'shelf'],
  ['dope-cloud', 'Dope Slimes Cloud Slime', 'jar', 'lavender', 'common', 'slime', 10, 'slime'],
  ['slime-charms', 'Slime Charms Pack', 'kit', 'pink', 'common', 'slime', 8, 'slime'],
  ['slime-kit', 'Slime Supply Kit (glue + activator)', 'kit', 'sky', 'common', 'slime', 12, 'slime'],
  ['peachybbies-butter', 'Peachybbies Butter Slime', 'jar', 'yellow', 'uncommon', 'slime', 14, 'slime'],
  ['snoop-cloud', 'Snoop Slimes Cloud Slime', 'jar', 'sky', 'uncommon', 'slime', 15, 'slime'],
  ['momo-glossy', 'Momo Slimes Glossy Slime', 'jar', 'pink', 'uncommon', 'slime', 15, 'slime'],
  ['rodem-crunchy', 'Rodem Crunchy Slime', 'jar', 'teal', 'rare', 'slime', 16, 'slime'],
  ['glitter-bingsu', 'Glitter Slimes Bingsu Slime', 'jar', 'purple', 'rare', 'slime', 16, 'slime']
];
// Shop prices in coins. Only common and uncommon things are for sale: rare and legendary only come from mystery boxes.
const SHOP_PRICE = { common: 25, uncommon: 45 };
const TICKETS = [
  ['song', 'Song break (one song, dancing allowed)', 8],
  ['call', 'Call a friend for 10 min', 12],
  ['youtube', 'YouTube for 15 min (pick the video first)', 15],
  ['phone', 'Phone for 15 min', 20]
];
const BOX_COINS = 5, EGG_COINS = 3;


// Recurring "possible homework". Edit the Template tab in the sheet to change it.
const SCHOOL_NIGHT = [
  ['Math homework', 'New from class today', '30 min', 'school'],
  ['History homework', 'New from class today', '30 min', 'school'],
  ['Dinner', 'Whenever you want', '30 min', 'flex']
];
const TEMPLATE = [].concat(
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].flatMap(d => SCHOOL_NIGHT.map(r => [d].concat(r))),
  [['Fri', 'Robotics', 'At home', '4 to 6', 'fixed'],
   ['Fri', 'Hunter tutoring', 'All Hunter work done by now', '6:30 to 7:30', 'fixed']]
);

// ---------- one-time setup (only needed on a brand new sheet) ----------
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const tpl = sheet_(ss, 'Template', TPL_COLS);
  ensure_();
  if (tpl.getLastRow() < 2) {
    const counts = {};
    const rows = TEMPLATE.map(r => { counts[r[0]] = (counts[r[0]] || 0) + 1; return [r[0], r[1], r[2], r[3], r[4], String(counts[r[0]])]; });
    tpl.getRange(2, 1, rows.length, TPL_COLS.length).setValues(rows);
  }
  if (!props.getProperty('folderId')) {
    props.setProperty('folderId', DriveApp.createFolder('Emma homework proof').getId());
  }
  materialize_();
  Logger.log('Setup done. Now: Deploy > New deployment > Web app.');
}

function sheet_(ss, name, cols) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.getRange('A:Z').setNumberFormat('@');
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  sh.setFrozenRows(1);
  return sh;
}

// Adds new columns and tabs the first time a newer version of this script runs. Safe to run every time.
function ensure_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('schema') === '3') return;
  const t = ss.getSheetByName('Tasks');
  if (!t || t.getLastColumn() < T_COLS.length) sheet_(ss, 'Tasks', T_COLS);
  if (!ss.getSheetByName('Status')) sheet_(ss, 'Status', S_COLS);
  if (!ss.getSheetByName('Days')) sheet_(ss, 'Days', D_COLS);
  const q = ss.getSheetByName('Squishies');
  if (!q || q.getLastColumn() < Q_COLS.length) sheet_(ss, 'Squishies', Q_COLS);
  if (!ss.getSheetByName('Ledger')) sheet_(ss, 'Ledger', L_COLS);
  if (!props.getProperty('rewardsStart')) props.setProperty('rewardsStart', ymd_(new Date()));
  props.setProperty('schema', '3');
}

// ---------- helpers ----------
function ymd_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function addDays_(s, n) { const d = new Date(s + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function weekday_(s) { return new Date(s + 'T12:00:00Z').getUTCDay(); }
function monday_(s) { return addDays_(s, -((weekday_(s) + 6) % 7)); }
function newId_() { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function bool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function str_(v) { return v instanceof Date ? ymd_(v) : String(v == null ? '' : v); }
function clip_(v, n) { return String(v == null ? '' : v).slice(0, n); }
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function checkable_(t) { return !t.deleted && t.cat !== 'fixed'; }

function readTasks_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  const vals = sh.getDataRange().getValues();
  const head = vals[0];
  return vals.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    head.forEach((h, j) => { o[h] = r[j]; });
    o.id = str_(o.id); o.date = str_(o.date); o.title = str_(o.title); o.note = str_(o.note);
    o.dur = str_(o.dur); o.cat = CATS.indexOf(str_(o.cat)) >= 0 ? str_(o.cat) : 'school';
    o.order = Number(o.order) || 0; o.done = bool_(o.done); o.deleted = bool_(o.deleted);
    o.doneAt = str_(o.doneAt); o.proofText = str_(o.proofText); o.proofPhoto = str_(o.proofPhoto);
    o.addedBy = str_(o.addedBy); o.updatedAt = str_(o.updatedAt);
    o.color = COLORS.indexOf(str_(o.color)) >= 0 ? str_(o.color) : '';
    o.due = isDate_(str_(o.due)) ? str_(o.due) : ''; o.pile = bool_(o.pile); o.coins = Number(o.coins) || 0;
    return o;
  }).filter(o => o.id && o.date);
}
function writeTask_(t) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
  t.updatedAt = new Date().toISOString();
  const row = T_COLS.map(c => t[c] == null ? '' : t[c]);
  if (t._row) sh.getRange(t._row, 1, 1, T_COLS.length).setValues([row]);
  else { sh.appendRow(row); t._row = sh.getLastRow(); }
}
function readStatus_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Status');
  if (sh.getLastRow() < 2) return null;
  const r = sh.getRange(2, 1, 1, 3).getValues()[0];
  return r[0] ? { taskId: str_(r[0]), title: str_(r[1]), startedAt: str_(r[2]) } : null;
}
function writeStatus_(s) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Status');
  sh.getRange(2, 1, 1, 3).setValues([s ? [s.taskId, s.title, s.startedAt] : ['', '', '']]);
}
function readRows_(name, cols) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).getValues().map((r, i) => {
    const o = { _row: i + 2 }; cols.forEach((c, j) => { o[c] = str_(r[j]); }); return o;
  });
}
function writeRow_(name, cols, o) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  const row = cols.map(c => o[c] == null ? '' : o[c]);
  if (o._row) sh.getRange(o._row, 1, 1, cols.length).setValues([row]);
  else { sh.appendRow(row); o._row = sh.getLastRow(); }
}

// Text alerts: the script emails Sofia's Verizon text address (Settings tab: textTo).
// (ntfy alerts are sent by the website itself; Google's servers can't reach ntfy.sh.)
function notify_(msg) {
  try {
    const to = settings_().textTo;
    if (!/@/.test(to)) return;
    const lines = String(msg).split('\n');
    const first = lines[0], today = lines.filter(l => /^Today:/.test(l))[0], quote = lines.filter(l => /^"/.test(l))[0];
    let text = first + (today ? '. ' + today : '') + (quote ? '. ' + quote : '');
    if (text.length > 155) text = text.slice(0, 152) + '...';
    MailApp.sendEmail(to, 'Emma', text);
  } catch (e) {}
}
// Run this once from the editor to allow sending and get a test text.
function testText() {
  const to = settings_().textTo;
  if (!/@/.test(to)) throw new Error('Put your number in the Settings tab first, like 5551234567@vtext.com');
  MailApp.sendEmail(to, 'Emma', 'Test from Emma homework: texts work!');
  Logger.log('Sent to ' + to);
}
// Run this once from the editor after adding the API key, to check the chat works.
function testChat() {
  Logger.log(JSON.stringify(callClaude_({ system: 'Reply with the word ok.', messages: [{ role: 'user', content: 'hi' }], max_tokens: 20 })));
}
function clock_() { return Utilities.formatDate(new Date(), TZ, 'h:mma').toLowerCase(); }

// Adds the template's tasks for any new days in the 7-day window.
function materialize_() {
  const props = PropertiesService.getScriptProperties();
  const today = ymd_(new Date());
  const end = addDays_(today, DAYS_AHEAD - 1);
  let from = props.getProperty('materializedThrough');
  from = from ? addDays_(from, 1) : today;
  if (from < today) from = today;
  if (from > end) return;
  const tsh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Template');
  const tpl = tsh.getLastRow() < 2 ? [] : tsh.getRange(2, 1, tsh.getLastRow() - 1, TPL_COLS.length).getValues();
  // dueInDays: 0 = due that night, 1 = due the next morning, blank = no due date
  const now = new Date().toISOString(), rows = [];
  for (let d = from; d <= end; d = addDays_(d, 1)) {
    const wd = weekday_(d);
    tpl.forEach(r => {
      if (WEEKDAYS.indexOf(String(r[0]).trim().slice(0, 3).toLowerCase()) !== wd || !String(r[1]).trim()) return;
      const cat = CATS.indexOf(String(r[4]).trim()) >= 0 ? String(r[4]).trim() : 'school';
      const dueIn = String(r[6] == null ? '' : r[6]).trim();
      const due = dueIn === '' || isNaN(Number(dueIn)) ? '' : addDays_(d, Number(dueIn));
      rows.push([newId_(), d, String(r[1]), String(r[2]), String(r[3]), cat, String(Number(r[5]) || 0), false, '', '', '', false, 'template', now, '', due, false, 0]);
    });
  }
  if (rows.length) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
    sh.getRange(sh.getLastRow() + 1, 1, rows.length, T_COLS.length).setValues(rows);
  }
  props.setProperty('materializedThrough', end);
}

// ---------- rewards ----------
// A day is cleared when it has something to check off and every item is done or in the "not today" pile.
function cleared_(all, d) {
  const list = all.filter(t => checkable_(t) && t.date === d);
  return list.length > 0 && list.every(t => t.done || t.pile);
}
// The day's mystery box is earned the moment every item for that day is handled, and only on that day.
function earned_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('earned') || '[]'); } catch (e) { return []; } }
function checkEarn_(all) {
  const today = ymd_(new Date()), start = PropertiesService.getScriptProperties().getProperty('rewardsStart') || today;
  const list = earned_();
  if (today < start || list.indexOf(today) >= 0 || !cleared_(all || readTasks_(), today)) return false;
  list.push(today);
  PropertiesService.getScriptProperties().setProperty('earned', JSON.stringify(list.slice(-120)));
  return true;
}
function boxDates_(all, squishies) {
  const opened = {}; squishies.forEach(s => { opened[s.date] = true; });
  return earned_().filter(d => !opened[d]);
}
// Weeks (Monday to Sunday) where every day that had homework earned a box.
function tokens_(all, squishies) {
  const today = ymd_(new Date()), start = PropertiesService.getScriptProperties().getProperty('rewardsStart') || today;
  const have = {}, used = {};
  earned_().forEach(d => { have[d] = true; });
  squishies.forEach(s => { if (s.realWeek) used[s.realWeek] = true; });
  const out = [];
  for (let w = monday_(start); w <= monday_(today); w = addDays_(w, 7)) {
    const sun = addDays_(w, 6);
    if (today < sun || used[w]) continue;
    let any = false, ok = true;
    for (let d = w; d <= sun; d = addDays_(d, 1)) {
      if (d < start) continue;
      if (have[d]) { any = true; continue; }
      if (all.some(t => checkable_(t) && t.date === d)) ok = false;
    }
    if (any && ok) out.push(w);
  }
  return out;
}
function pick_(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function catalogItem_(c) { return { itemId: c[0], name: c[1], kind: c[2], color: c[3], rarity: c[4], texture: c[5], price: c[6], cat: c[7] }; }
function rollSquishy_(squishies, sparkle, mini) {
  const owned = {}; squishies.forEach(q => { owned[q.itemId || q.name] = true; owned[q.name] = true; });
  const left = CATALOG.filter(c => !owned[c[0]] && !owned[c[1]]);
  if (!left.length) return null;
  const r = Math.random() * 100;
  // a sparkle box (3 days in a row) has much better odds
  const want = mini ? 'common' : sparkle ? (r < 15 ? 'legendary' : r < 50 ? 'rare' : r < 80 ? 'uncommon' : 'common')
    : (r < 2 ? 'legendary' : r < 12 ? 'rare' : r < 40 ? 'uncommon' : 'common');
  const order = ['legendary', 'rare', 'uncommon', 'common'];
  const tries = [want].concat(order.filter(x => x !== want).sort((a, b) => Math.abs(order.indexOf(a) - order.indexOf(want)) - Math.abs(order.indexOf(b) - order.indexOf(want))));
  const pool = tries.map(x => left.filter(c => c[4] === x)).find(list => list.length);
  return catalogItem_(pick_(pool));
}
// Anything moved off today still counts against today, the same as Not today (no dodging work by dragging it away).
function movedList_(d) { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('moved-' + d) || '[]'); } catch (e) { return []; } }
function noteMove_(t, newDate) {
  const today = ymd_(new Date());
  if (t.date !== today || newDate === today || t.done || !checkable_(t)) return;
  const list = movedList_(today); if (list.indexOf(t.id) >= 0) return;
  list.push(t.id); PropertiesService.getScriptProperties().setProperty('moved-' + today, JSON.stringify(list));
}
// Full box = she really checked off at least half of the day. Otherwise it's a mini box (common only, fewer coins).
function quality_(all, d) {
  const day = all.filter(t => checkable_(t) && t.cat !== 'flex' && t.date === d);   // dinner doesn't count as work
  const movedOff = movedList_(d).filter(id => !day.some(t => t.id === id));
  const total = day.length + movedOff.length, done = day.filter(t => t.done).length;
  return { done: done, total: total, need: Math.max(0, Math.ceil(total / 2) - done), full: total > 0 && done * 2 >= total };
}
function fullDays_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('fullDays') || '[]'); } catch (e) { return []; } }
// Sparkle box: this is a full box and the two days before were full boxes too.
function sparkle_(date, all) { const f = fullDays_(); return quality_(all, date).full && f.indexOf(addDays_(date, -1)) >= 0 && f.indexOf(addDays_(date, -2)) >= 0; }
function coins_(all, ledger) {
  return all.filter(t => t.done && !t.deleted).reduce((n, t) => n + (Number(t.coins) || 0), 0) + ledger.reduce((n, l) => n + (Number(l.amount) || 0), 0);
}
function taskCoins_(t, given) { const g = Number(given); return Math.max(0, Math.min(6, isNaN(g) ? 3 : Math.round(g))); }

function snapshot_() {
  const today = ymd_(new Date());
  const since = addDays_(today, -14);
  const all = readTasks_();
  const squishies = readRows_('Squishies', Q_COLS);
  const ledger = readRows_('Ledger', L_COLS);
  const tasks = all.filter(t => !t.deleted && (t.date >= since || t.pile || (t.due && t.due >= since)))
    .map(t => { const c = Object.assign({}, t); delete c._row; return c; });
  const bring = {};
  readRows_('Days', D_COLS).forEach(r => { if (r.date >= since && r.bring) bring[r.date] = r.bring; });
  return { ok: true, today: today, days: DAYS_AHEAD, tasks: tasks, status: readStatus_(), bring: bring,
    squishies: squishies.filter(s => s.kind !== 'none').map(s => { const c = Object.assign({}, s); delete c._row; return c; }),
    boxes: boxDates_(all, squishies), tokens: tokens_(all, squishies), catalogSize: CATALOG.length,
    catalog: CATALOG.map(catalogItem_), shopPrice: SHOP_PRICE, ticketTypes: TICKETS.map(x => ({ id: x[0], name: x[1], price: x[2] })),
    coins: coins_(all, ledger), tickets: ledger.filter(l => l.kind === 'ticket' && l.used !== 'yes').map(l => ({ id: l.id, name: l.name, at: l.at })),
    sparkle: boxDates_(all, squishies).map(d => sparkle_(d, all)),
    boxInfo: boxDates_(all, squishies).map(d => Object.assign({ date: d, sparkle: sparkle_(d, all) }, quality_(all, d))),
    chat: !!PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY') };
}

// ---------- Settings tab (Claude can change these in the sheet) ----------
function settings_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Settings');
  if (!sh) {
    sh = ss.insertSheet('Settings');
    sh.getRange('A:B').setNumberFormat('@');
    sh.getRange(1, 1, 5, 2).setValues([
      ['setting', 'value'],
      ['noProofTypes', 'flex, fixed'],
      ['noAlertTypes', 'flex'],
      ['sofiaKey', Utilities.getUuid().replace(/-/g, '').slice(0, 20)],
      ['note', 'Types: test, school, hunter, rsm, fixed (Plans), flex (Dinner/Breaks). sofiaKey unlocks the photo page; keep it private.']
    ]);
    sh.getRange(1, 1, 1, 2).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const out = {};
  sh.getDataRange().getValues().slice(1).forEach(r => { out[String(r[0]).trim()] = String(r[1]).trim(); });
  const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  return { noProof: list(out.noProofTypes), noAlert: list(out.noAlertTypes), sofiaKey: out.sofiaKey || '', textTo: out.textTo || '', bringRules: out.bringRules || '' };
}
function photoId_(url) { const m = String(url).match(/[-\w]{25,}/); return m ? m[0] : ''; }

// ---------- web app ----------
function doGet(e) {
  const p = (e && e.parameter) || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    ensure_();
    const cfg = settings_();
    if (p.review || p.photo) {
      if (!cfg.sofiaKey || p.key !== cfg.sofiaKey) return json_({ ok: false, error: 'not allowed' });
      const tasks = readTasks_().filter(t => !t.deleted);
      if (p.photo) {
        if (!tasks.some(t => photoId_(t.proofPhoto) === p.photo)) return json_({ ok: false, error: 'not found' });
        const blob = DriveApp.getFileById(p.photo).getBlob();
        return json_({ ok: true, type: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
      }
      const since = addDays_(ymd_(new Date()), -60);
      const done = tasks.filter(t => t.date >= since && t.date <= ymd_(new Date())).map(t => {
        delete t._row; t.photoId = photoId_(t.proofPhoto); return t;
      });
      return json_({ ok: true, today: ymd_(new Date()), tasks: done, noProof: cfg.noProof });
    }
    materialize_();
    const snap = snapshot_();
    snap.noProof = cfg.noProof;
    snap.noAlert = cfg.noAlert;
    snap.bringRules = cfg.bringRules;
    return json_(snap);
  }
  catch (err) { return json_({ ok: false, error: String(err) }); }
  finally { lock.releaseLock(); }
}

// Changes one task's fields. Used by the site and by the chat box.
function applyFields_(t, f) {
  if ('title' in f) t.title = clip_(f.title, 120).trim() || 'Untitled';
  if ('note' in f) t.note = clip_(f.note, 300);
  if ('dur' in f) t.dur = clip_(f.dur, 40);
  if ('cat' in f && CATS.indexOf(f.cat) >= 0) t.cat = f.cat;
  if ('color' in f && (f.color === '' || COLORS.indexOf(f.color) >= 0)) t.color = f.color;
  if ('due' in f && (f.due === '' || isDate_(f.due))) t.due = f.due;
  if ('date' in f && isDate_(f.date)) { noteMove_(t, f.date); t.date = f.date; }
  if ('order' in f) t.order = String(Number(f.order) || 0);
  if ('pile' in f) t.pile = !!f.pile;
  if ('deleted' in f) t.deleted = !!f.deleted;
}
function addTask_(f, by) {
  const date = clip_(f.date, 10);
  if (!isDate_(date)) throw new Error('bad date');
  const t = { id: newId_(), date: date, title: 'New homework', note: '', dur: '30 min', cat: 'school', order: '999', done: false, doneAt: '',
    proofText: '', proofPhoto: '', deleted: false, addedBy: by || 'emma', color: '', due: '', pile: false };
  applyFields_(t, { title: f.title || 'New homework', note: f.note || '', dur: f.dur || '30 min', cat: f.cat || 'school', color: f.color || '', due: f.due || '', order: f.order == null ? 999 : f.order });
  writeTask_(t);
  return t;
}
function todayLine_() {
  const today = ymd_(new Date());
  const todays = readTasks_().filter(x => checkable_(x) && x.date === today);
  return '\nToday: ' + todays.filter(x => x.done).length + ' of ' + todays.length + ' done';
}
function setBring_(date, text) {
  if (!isDate_(date)) throw new Error('bad date');
  const rows = readRows_('Days', D_COLS);
  const r = rows.find(x => x.date === date) || { date: date };
  r.bring = clip_(text, 300);
  writeRow_('Days', D_COLS, r);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let req;
  try {
    req = JSON.parse(e.postData.contents);
    ensure_();
    if (req.action === 'chat') { lock.releaseLock(); return json_(chat_(req)); }
    const all = readTasks_();
    const find = id => all.find(t => t.id === String(id));
    const a = req.action;
    const extra = {};

    if (a === 'add') {
      extra.added = addTask_(req, 'emma').id;
    } else if (a === 'edit') {
      const t = find(req.id); if (!t) throw new Error('not found');
      const f = req.fields || {};
      const wasPile = t.pile;
      applyFields_(t, f);
      writeTask_(t);
      if (f.pile && !wasPile && settings_().noAlert.indexOf(t.cat) < 0) notify_('Emma put "' + t.title + '" in Not today, ' + clock_());
    } else if (a === 'arrange') {
      // drag and drop: new day, order and pile for a group of tasks
      (req.items || []).slice(0, 80).forEach(it => {
        const t = find(it.id); if (!t) return;
        const f = { order: it.order };
        if (isDate_(it.date)) f.date = it.date;
        if ('pile' in it) f.pile = !!it.pile;
        if (t.date !== f.date || t.pile !== !!f.pile || Number(t.order) !== Number(f.order)) { applyFields_(t, f); writeTask_(t); }
      });
    } else if (a === 'bring') {
      setBring_(req.date, req.text);
    } else if (a === 'complete') {
      const t = find(req.id); if (!t) throw new Error('not found');
      const cfg = settings_();
      const needsProof = cfg.noProof.indexOf(t.cat) < 0;
      const text = clip_(req.proofText, 2000).trim();
      let photoUrl = '';
      if (req.photo && req.photo.data) {
        const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('folderId'));
        const name = t.date + ' ' + t.title.replace(/[\\/:*?"<>|]/g, '') + '.jpg';
        photoUrl = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.photo.data), 'image/jpeg', name)).getUrl();
      }
      if (needsProof && !photoUrl && text.length < 3) throw new Error('proof needed');
      const st = readStatus_();
      const hatched = !!(st && st.taskId === t.id);   // she pressed Start on this one: the egg hatches
      t.done = true; t.doneAt = new Date().toISOString(); t.proofText = text; t.proofPhoto = photoUrl; t.pile = false;
      t.coins = taskCoins_(t, req.coins) + (hatched ? EGG_COINS : 0);
      writeTask_(t);
      if (hatched) writeStatus_(null);
      extra.coinsGained = t.coins; extra.hatched = hatched;
      if (cfg.noAlert.indexOf(t.cat) < 0) {
        const proof = !needsProof ? '' : photoUrl && text ? ' (photo + note)' : photoUrl ? ' (photo)' : ' (note only)';
        notify_('Emma finished: ' + t.title + ', ' + clock_() + proof + (text ? '\n"' + text.slice(0, 200) + '"' : '') + todayLine_());
      }
    } else if (a === 'uncomplete') {
      const t = find(req.id); if (!t) throw new Error('not found');
      const wasDone = t.done;
      t.done = false; t.doneAt = ''; t.coins = 0;
      writeTask_(t);
      if (wasDone && settings_().noAlert.indexOf(t.cat) < 0) notify_('Heads up: Emma UNCHECKED ' + t.title + ', ' + clock_() + '. It was marked done before.');
    } else if (a === 'start') {
      const t = find(req.id); if (!t) throw new Error('not found');
      writeStatus_({ taskId: t.id, title: t.title, startedAt: new Date().toISOString() });
      notify_('Emma started: ' + t.title + ', ' + clock_());
    } else if (a === 'stop') {
      const st = readStatus_();
      writeStatus_(null);
      if (st) notify_('Emma stopped working on ' + st.title + ' (not checked off), ' + clock_());
    } else if (a === 'openBox') {
      const squishies = readRows_('Squishies', Q_COLS);
      if (boxDates_(all, squishies).indexOf(req.date) < 0) throw new Error('no box');
      const q = quality_(all, req.date), sparkle = sparkle_(req.date, all);
      const s = rollSquishy_(squishies, sparkle, !q.full);
      const boxCoins = q.full ? BOX_COINS : 2;
      if (q.full) { const f = fullDays_(); if (f.indexOf(req.date) < 0) { f.push(req.date); PropertiesService.getScriptProperties().setProperty('fullDays', JSON.stringify(f.slice(-60))); } }
      extra.fullBox = q.full;
      const now = new Date().toISOString();
      writeRow_('Ledger', L_COLS, { id: 'l' + newId_(), date: req.date, kind: 'box', amount: boxCoins, name: q.full ? 'Mystery box' : 'Mini box', used: '', at: now });
      extra.coinsGained = boxCoins; extra.sparkle = sparkle;
      if (s) {
        Object.assign(s, { id: 'q' + newId_(), date: req.date, openedAt: now, realWeek: '', pos: '', source: sparkle ? 'sparkle box' : 'box' });
        writeRow_('Squishies', Q_COLS, s);
        extra.opened = s.id;
      } else {
        // collected everything: still mark the box opened so it doesn't stay
        writeRow_('Squishies', Q_COLS, { id: 'q' + newId_(), date: req.date, kind: 'none', name: '', rarity: '', openedAt: now, source: 'box' });
        extra.allCollected = true;
      }
    } else if (a === 'pickReal') {
      const squishies = readRows_('Squishies', Q_COLS);
      if (tokens_(all, squishies).indexOf(req.week) < 0) throw new Error('no token');
      const s = squishies.find(x => x.id === req.id); if (!s) throw new Error('not found');
      s.realWeek = req.week;
      writeRow_('Squishies', Q_COLS, s);
      notify_('Emma earned a real squishy for the week of ' + req.week + '! She picked: ' + s.name + '. Time to order it.');
    } else if (a === 'buy') {
      const ledger = readRows_('Ledger', L_COLS);
      const squishies = readRows_('Squishies', Q_COLS);
      const balance = coins_(all, ledger);
      const now = new Date().toISOString(), today = ymd_(new Date());
      if (req.ticket) {
        const tk = TICKETS.find(x => x[0] === req.ticket); if (!tk) throw new Error('not found');
        if (balance < tk[2]) throw new Error('not enough coins');
        writeRow_('Ledger', L_COLS, { id: 'l' + newId_(), date: today, kind: 'ticket', amount: -tk[2], name: tk[1], used: '', at: now });
      } else {
        const c = CATALOG.find(x => x[0] === req.itemId); if (!c) throw new Error('not found');
        const price = SHOP_PRICE[c[4]]; if (!price) throw new Error('boxes only');
        if (squishies.some(q => q.itemId === c[0] || q.name === c[1])) throw new Error('already have it');
        if (balance < price) throw new Error('not enough coins');
        writeRow_('Ledger', L_COLS, { id: 'l' + newId_(), date: today, kind: 'shop', amount: -price, name: c[1], used: '', at: now });
        const it = catalogItem_(c);
        writeRow_('Squishies', Q_COLS, Object.assign(it, { id: 'q' + newId_(), date: today, openedAt: now, realWeek: '', pos: '', source: 'shop' }));
        extra.bought = c[0];
      }
    } else if (a === 'useTicket') {
      const ledger = readRows_('Ledger', L_COLS);
      const l = ledger.find(x => x.id === req.id && x.kind === 'ticket'); if (!l) throw new Error('not found');
      if (l.used === 'yes') throw new Error('already used');
      l.used = 'yes'; writeRow_('Ledger', L_COLS, l);
      notify_('Emma is using a ticket: ' + l.name + ', ' + clock_());
    } else if (a === 'shelf') {
      const squishies = readRows_('Squishies', Q_COLS);
      (req.order || []).slice(0, 200).forEach((id, n) => { const q = squishies.find(x => x.id === id); if (q && String(q.pos) !== String(n + 1)) { q.pos = String(n + 1); writeRow_('Squishies', Q_COLS, q); } });
    } else {
      throw new Error('unknown action');
    }
    if (['complete', 'edit', 'arrange', 'add'].indexOf(a) >= 0 && checkEarn_()) extra.justEarned = ymd_(new Date());
    return json_(Object.assign(snapshot_(), extra));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ---------- chat box ----------
function callClaude_(body) {
  const key = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('no key');
  // keys that aren't tied to a workspace need the workspace ID too (Script property ANTHROPIC_WORKSPACE_ID)
  const ws = (PropertiesService.getScriptProperties().getProperty('ANTHROPIC_WORKSPACE_ID') || '').trim();
  body.model = CHAT_MODEL;
  const r = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: Object.assign({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }, ws ? { 'anthropic-workspace-id': ws } : {}), payload: JSON.stringify(body)
  });
  const j = JSON.parse(r.getContentText());
  if (r.getResponseCode() !== 200) throw new Error('chat error: ' + (j.error && j.error.message || r.getResponseCode()));
  return j;
}

const CHAT_TOOL = {
  name: 'update_plan',
  description: 'Change Emma\'s homework plan. Send every change in one call. Only use ids from the plan.',
  input_schema: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            op: { type: 'string', enum: ['add', 'edit', 'move', 'not_today', 'back_from_pile', 'done', 'undone', 'delete', 'bring'],
              description: 'add: new task (needs date, title). edit: change fields of id. move: change id to date. not_today: put id in the Not today pile. back_from_pile: put id on date. done: check off id. undone: uncheck id. delete: remove id. bring: set the bring-home list for date to text.' },
            id: { type: 'string' },
            date: { type: 'string', description: 'yyyy-mm-dd' },
            title: { type: 'string' },
            note: { type: 'string' },
            dur: { type: 'string', description: 'like 30 min or 1.5 hrs' },
            tag: { type: 'string', enum: CATS, description: 'test = test or quiz prep, school = school homework, hunter, rsm, fixed = a plan or class that just happens, flex = dinner or breaks' },
            color: { type: 'string', enum: COLORS },
            due: { type: 'string', description: 'yyyy-mm-dd or empty to clear' },
            text: { type: 'string' }
          },
          required: ['op']
        }
      }
    },
    required: ['ops']
  }
};

function planText_(all) {
  const today = ymd_(new Date()), from = addDays_(today, -7), to = addDays_(today, 30);
  const bring = {}; readRows_('Days', D_COLS).forEach(r => { bring[r.date] = r.bring; });
  const dn = d => Utilities.formatDate(new Date(d + 'T12:00:00Z'), 'UTC', 'EEE MMM d');
  const lines = [];
  const live = all.filter(t => !t.deleted && ((t.date >= from && t.date <= to) || t.pile || (t.due && t.due >= today)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  const days = {};
  live.forEach(t => { (days[t.pile ? 'pile' : t.date] = days[t.pile ? 'pile' : t.date] || []).push(t); });
  const fmt = t => '  ' + t.id + ' | ' + t.title + (t.note ? ' (' + t.note + ')' : '') + ' | ' + t.dur + ' | tag ' + t.cat +
    (t.color ? ' | color ' + t.color : '') + (t.due ? ' | due ' + t.due : '') + (t.done ? ' | DONE' : '') + (t.pile ? ' | from ' + t.date : '');
  Object.keys(days).filter(k => k !== 'pile').sort().forEach(d => {
    lines.push(d + ' (' + dn(d) + ')' + (d === today ? ' TODAY' : '') + (bring[d] ? ' | bring home: ' + bring[d] : ''));
    days[d].forEach(t => lines.push(fmt(t)));
  });
  if (days.pile) { lines.push('Not today pile:'); days.pile.forEach(t => lines.push(fmt(t))); }
  return lines.join('\n');
}

function applyOps_(ops) {
  const all = readTasks_();
  const find = id => all.find(t => t.id === String(id) && !t.deleted);
  const done = [], notes = [], cfg = settings_();
  (ops || []).slice(0, 40).forEach(o => {
    try {
      const t = o.id ? find(o.id) : null;
      const f = {};
      ['title', 'note', 'dur', 'color', 'due'].forEach(k => { if (o[k] != null) f[k] = o[k]; });
      if (o.tag) f.cat = o.tag;
      if (o.op === 'add') { addTask_(Object.assign({ date: o.date }, f), 'chat'); notes.push('added ' + (o.title || 'task')); return; }
      if (o.op === 'bring') { setBring_(o.date, o.text || ''); notes.push('bring list ' + o.date); return; }
      if (!t) { notes.push('could not find ' + o.id); return; }
      if (o.op === 'edit') applyFields_(t, f);
      else if (o.op === 'move' || o.op === 'back_from_pile') applyFields_(t, { date: o.date || t.date, pile: false, order: 999 });
      else if (o.op === 'not_today') applyFields_(t, { pile: true });
      else if (o.op === 'delete') applyFields_(t, { deleted: true });
      else if (o.op === 'done') {
        if (t.cat === 'fixed') { notes.push(t.title + ' is a plan, nothing to check'); return; }
        t.done = true; t.doneAt = new Date().toISOString(); t.pile = false; t.proofText = 'Checked off in the chat box'; t.coins = 3; done.push(t.id);
        if (cfg.noAlert.indexOf(t.cat) < 0) notify_('Emma finished (chat box): ' + t.title + ', ' + clock_());
      } else if (o.op === 'undone') { t.done = false; t.doneAt = ''; }
      writeTask_(t);
      notes.push(o.op + ' ' + t.title);
    } catch (err) { notes.push('error: ' + err.message); }
  });
  return { done: done, notes: notes };
}

function chat_(req) {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ANTHROPIC_API_KEY')) return Object.assign(snapshot_(), { reply: 'The chat box isn\'t turned on yet. Sofia needs to add the key.' });
  const dayKey = 'chats-' + ymd_(new Date());
  const used = Number(props.getProperty(dayKey) || 0);
  if (used >= CHATS_PER_DAY) return Object.assign(snapshot_(), { reply: 'That\'s enough chatting for today. You can still drag and edit things yourself.' });
  props.setProperty(dayKey, String(used + 1));

  const today = ymd_(new Date());
  const system = 'You are the little helper inside Emma\'s homework checklist. Emma is 10 and her babysitter Sofia helps her plan. Plan her time across days based on everything due and how much time she has, putting work on days before it is due. ' +
    'Today is ' + Utilities.formatDate(new Date(), TZ, 'EEEE, MMMM d, yyyy') + ' (' + today + '). ' +
    'When they tell you what is done, not done, wanted or not wanted, change the plan with update_plan. ' +
    '"Not doing it today" or "skip" means not_today, which still counts as handled for the day. ' +
    'Due dates always go in the due field, never in the note or title. History homework is due at night (due that same date); school homework like math, Latin and English is due the next morning in class. ' +
    'Look at the Not today pile every time: when she says what she has done and how much time is left, suggest moving pile items back onto a day where they fit before their due date (use back_from_pile). ' +
    'Only check something off (done) when they say it is actually finished. Plans (tag fixed) cannot be checked off. ' +
    'If a request is unclear (which task, which day), ask one short question instead of guessing. ' +
    'After changing things, reply in one or two short, friendly sentences saying what changed. No emojis. ' +
    'Always give a due date when you know one. ' +
    'Every task gets a color for how necessary it is to get done that day, most necessary first: purple (must do today, no way around it: due tomorrow, a test tomorrow, already late), blue, white, red, orange, yellow, green, and gray last. Never use black. ' +
    'Gray is only for things that are truly optional and fine to skip or delete; almost nothing should be gray, because almost all of her work really matters. Use the whole ladder to show small differences. ' +
    'Set color on every task you add, and re-color tasks when things change (a due date moves, a test gets closer). If they pick a color themselves, keep it. ' +
    'Durations look like "30 min" or "1.5 hrs". Dates are yyyy-mm-dd.\n\nThe plan right now:\n' + planText_(readTasks_());

  const msgs = (req.history || []).slice(-10).filter(m => m && m.text).map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: clip_(m.text, 1000) }));
  msgs.push({ role: 'user', content: clip_(req.message, 1500) });
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();

  let reply = '', completed = [], changed = false;
  for (let i = 0; i < 3; i++) {
    const res = callClaude_({ system: system, messages: msgs, tools: [CHAT_TOOL], max_tokens: 1500 });
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join(' ').trim();
    if (text) reply = text;
    const uses = res.content.filter(b => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || !uses.length) break;
    msgs.push({ role: 'assistant', content: res.content });
    const results = uses.map(u => {
      const lock = LockService.getScriptLock(); lock.waitLock(20000);
      try { const r = applyOps_(u.input && u.input.ops); completed = completed.concat(r.done); changed = true; return { type: 'tool_result', tool_use_id: u.id, content: r.notes.join('; ') || 'nothing changed' }; }
      finally { lock.releaseLock(); }
    });
    msgs.push({ role: 'user', content: results });
  }
  const earnedNow = changed && checkEarn_() ? ymd_(new Date()) : '';
  return Object.assign(snapshot_(), { reply: reply || (changed ? 'Done!' : 'Hmm, can you say that another way?'), completed: completed, justEarned: earnedNow });
}
