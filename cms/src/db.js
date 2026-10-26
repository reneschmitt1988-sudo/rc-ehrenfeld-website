'use strict';
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'cms.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'verein',       -- vorbericht | kampfbericht | verein
  title TEXT NOT NULL,
  teaser TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image TEXT,
  image_alt TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,                          -- YYYY-MM-DD
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,                          -- YYYY-MM-DD
  time TEXT NOT NULL DEFAULT '',               -- HH:MM
  kampftag TEXT NOT NULL DEFAULT '',
  liga TEXT NOT NULL DEFAULT 'Landesliga',
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  location TEXT NOT NULL DEFAULT '',
  referee TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bouts (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  weight_class TEXT NOT NULL,                  -- z. B. "G 57"
  home_wrestler TEXT NOT NULL DEFAULT '',
  away_wrestler TEXT NOT NULL DEFAULT '',
  result_type TEXT NOT NULL DEFAULT '',        -- SS, TÜ, PS, AS, KL, DQ
  home_points INTEGER NOT NULL DEFAULT 0,
  away_points INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS other_results (
  id INTEGER PRIMARY KEY,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS league_rows (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL,
  team TEXT NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  table_points TEXT NOT NULL DEFAULT '0 : 0',
  is_own INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS training_groups (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS training_times (
  id INTEGER PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES training_groups(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL DEFAULT '',              -- z. B. "Ringerwiesel, 5 bis 7 Jahre"
  weekday TEXT NOT NULL,                       -- Montag …
  time_from TEXT NOT NULL,
  time_to TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trainers (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  logo TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS board (
  id INTEGER PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL,
  name TEXT NOT NULL
);
`);

// ---------- Seed (nur wenn leer) ----------
const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

if (count('settings') === 0) {
  const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const defaults = {
    site_name: 'RC Ehrenfeld 1976 e.V.',
    legal_name: 'Ringer Club Ehrenfeld 1976 e.V.',
    base_url: 'https://www.rc-ehrenfeld.de',
    eyebrow: 'Ringer-Club in Köln-Ehrenfeld',
    hero_title: 'Ringen in\nEhrenfeld.',
    hero_accent: 'Seit 1976.',
    hero_text: 'Der RC Ehrenfeld 1976 e.V. ist dein Ringerverein im Kölner Westen. Hier lernst du Kraft, Technik und Fairness auf der Matte – vom ersten Probetraining bis zum Mannschaftskampf.',
    hero_image: '',
    meta_description: 'Der Ringer Club Ehrenfeld 1976 e.V. ist dein Ringerverein im Kölner Westen. Training für Ringerwiesel ab 5 Jahren, Jugend und Erwachsene in Köln-Ossendorf. Probetraining jederzeit möglich.',
    training_intro: 'Komm einfach vorbei und mach mit. Zum Schnuppern genügen bequeme Sportkleidung und etwas zu trinken. Mädchen und Frauen trainieren bei uns in allen Gruppen mit.',
    history_lead: '1976 wurde der Ringerclub Ehrenfeld von einer Handvoll Mitgliedern gegründet. Zum größten Teil waren das Eltern der Ringer, ältere Ringkampffreunde und ehemalige Ringer. Daran hat sich bis heute nichts geändert.',
    history_text: 'Mit durchschnittlich rund 50 Mitgliedern haben wir viel erreicht: Viele über die Grenzen NRWs hinaus bekannte Ringer begannen ihre Sportkarriere in Ehrenfeld. Einige wechselten in die Oberliga oder sogar die Bundesliga, spätere Deutsche Meister machten hier ihre ersten Schritte auf der Ringermatte.\n\nGeführt wird der RCE von den Familien van Rienen, Pelzer und Hemmerich. Alle Trainer und Vorstandsmitglieder erfüllen ihre Posten seit der Gründung unentgeltlich.',
    successes: '2005|Aufstieg der Mannschaft in die Verbandsliga\n2007|Deutscher Meister: Melvin Pelzer\n2009|Deutscher Meister: Robin Pelzer',
    alumni: 'Thorsten van Berkum\nHans Broich\nPatrick Zimmermann\nKevin van Rienen',
    alumni_note: 'Melvin und Robin Pelzer wechselten später in die Bundesliga.',
    trainer_note: 'In den ersten Jahren trainierte Gründungsmitglied Gerd Buschenheuer alle Altersklassen. Heute stehen mit Melvin und Robin Pelzer zwei ehemalige Deutsche Meister am Mattenrand.',
    season_label: 'Landesliga 2026',
    results_stand: '24.10.2026',
    table_stand: 'Nach dem 8. Kampftag · Stand: 24.10.2026',
    league_url: 'https://ringen-nrw.de/index.php?option=com_rdb&Itemid=134&tk=cs&sid=2026&lid=Landesliga',
    membership_note: '[MITGLIEDSBEITRAG ODER HINWEIS ERGÄNZEN]',
    sponsor_intro: 'Alle Trainer und Vorstandsmitglieder arbeiten bei uns ehrenamtlich. Unsere Sponsoren machen den Trainingsbetrieb möglich. Dafür sagen wir Danke.',
    halls: 'Sporthalle Wasseramselweg\n50829 Köln\n\nSporthalle Kolkrabenweg 65\n50829 Köln',
    contact_name: 'Robin Pelzer, Geschäftsführer',
    address: 'Bussardweg 24\n50829 Köln',
    phone: '0176 70285171',
    phone_link: '+4917670285171',
    email: 'info@rc-ehrenfeld.de',
    instagram: 'rcehrenfeld',
    register: 'Amtsgericht Köln, VR 7287',
    responsible: 'Robin Pelzer',
    hoster: 'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland',
    privacy_date: 'Oktober 2026',
  };
  const tx = db.transaction(() => { for (const [k, v] of Object.entries(defaults)) ins.run(k, v); });
  tx();
}

if (count('training_groups') === 0) {
  const g = db.prepare('INSERT INTO training_groups (position, name, subtitle) VALUES (?, ?, ?)');
  const t = db.prepare('INSERT INTO training_times (group_id, position, label, weekday, time_from, time_to, location) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const W = 'Sporthalle Wasseramselweg, 50829 Köln';
  const K = 'Sporthalle Kolkrabenweg 65, 50829 Köln';
  db.transaction(() => {
    const kinder = g.run(1, 'Kinder', '').lastInsertRowid;
    t.run(kinder, 1, 'Ringerwiesel, 5 bis 7 Jahre', 'Montag', '17:15', '18:15', W);
    const jugend = g.run(2, 'Jugend', '10 bis 15 Jahre').lastInsertRowid;
    t.run(jugend, 1, '', 'Mittwoch', '18:00', '19:00', W);
    t.run(jugend, 2, '', 'Freitag', '18:00', '19:00', K);
    const erw = g.run(3, 'Erwachsene', '').lastInsertRowid;
    t.run(erw, 1, '', 'Montag', '18:30', '20:00', W);
    t.run(erw, 2, '', 'Mittwoch', '19:30', '21:00', W);
    t.run(erw, 3, '', 'Freitag', '19:30', '21:00', K);
  })();
}

if (count('trainers') === 0) {
  const i = db.prepare('INSERT INTO trainers (position, role, name) VALUES (?, ?, ?)');
  db.transaction(() => {
    i.run(1, 'Seniorentrainer', 'Melvin Pelzer'); i.run(2, 'Seniorentrainer', 'Robin Pelzer');
    i.run(3, 'Jugendtrainer', 'Yilmaz Kosar'); i.run(4, 'Jugendtrainer', 'Janine Hannes');
    i.run(5, 'Ringerwiesel', 'Janine Hannes');
  })();
}

if (count('board') === 0) {
  const i = db.prepare('INSERT INTO board (position, role, name) VALUES (?, ?, ?)');
  db.transaction(() => {
    i.run(1, '1. Vorsitzender', 'Melvin Pelzer'); i.run(2, '2. Vorsitzender', 'Kevin van Rienen');
    i.run(3, 'Geschäftsführer', 'Robin Pelzer'); i.run(4, 'Kassenwart', 'Enes Özcan');
  })();
}

if (count('sponsors') === 0) {
  const i = db.prepare('INSERT INTO sponsors (position, name, url, logo) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    i.run(1, 'Willms Bau GmbH & Co. KG', 'https://www.willms-gruppe.de/willms-bau/', '/assets/img/sponsor-willms-bau.png');
    i.run(2, 'ZADEM', 'https://zadem.org/', '/assets/img/sponsor-zadem.jpg');
  })();
}

if (count('league_rows') === 0) {
  const i = db.prepare('INSERT INTO league_rows (position, team, played, won, drawn, lost, points_for, points_against, table_points, is_own) VALUES (?,?,?,?,?,?,?,?,?,?)');
  db.transaction(() => {
    i.run(1, 'KSV Simson Landgraaf', 8, 7, 0, 1, 211, 69, '14 : 2', 0);
    i.run(2, 'ASV Atlas Bielefeld', 8, 7, 0, 1, 180, 91, '14 : 2', 0);
    i.run(3, 'TV Essen-Dellwig II', 8, 4, 1, 3, 140, 143, '9 : 7', 0);
    i.run(4, 'KSV Witten 07 II', 8, 4, 0, 4, 139, 122, '8 : 8', 0);
    i.run(5, 'TuS Aldenhoven', 8, 3, 1, 4, 116, 152, '7 : 9', 0);
    i.run(6, 'Sport-Union Annen II', 8, 2, 2, 4, 124, 163, '6 : 10', 0);
    i.run(7, 'RC Ehrenfeld 1976', 8, 3, 0, 5, 93, 185, '6 : 10', 1);
    i.run(8, 'TKSV 1906 Duisdorf', 8, 0, 0, 8, 102, 180, '0 : 16', 0);
  })();
}

if (count('matches') === 0) {
  const m = db.prepare('INSERT INTO matches (date, time, kampftag, liga, home, away, home_score, away_score, location, referee) VALUES (?,?,?,?,?,?,?,?,?,?)');
  const b = db.prepare('INSERT INTO bouts (match_id, position, weight_class, home_wrestler, away_wrestler, result_type, home_points, away_points) VALUES (?,?,?,?,?,?,?,?)');
  const o = db.prepare('INSERT INTO other_results (match_id, home, away, home_score, away_score) VALUES (?,?,?,?,?)');
  db.transaction(() => {
    const id = m.run('2026-10-24', '', '8. Kampftag', 'Landesliga', 'RC Ehrenfeld 1976', 'TKSV 1906 Duisdorf', 19, 16, 'Heim', 'Alexander Geck').lastInsertRowid;
    const bouts = [
      ['G 57', 'Amir Sarcan', 'Lukas Czechanowski', 'SS', 0, 4],
      ['F 61', 'Kaan Efe Kosar', 'Murtaza Hassani', 'PS', 2, 0],
      ['G 66', 'Zeljko Lakatus', 'Daniel Persch', 'SS', 0, 4],
      ['F 71', 'Mustafa Faqiri', 'Muharrem Cakir', 'TÜ', 4, 0],
      ['G 75 A', 'Enes Özcan', 'Luca Jerome Steinbrücker', 'SS', 4, 0],
      ['F 75 B', 'Emil Bruno Renner', 'Ahmed Homad', 'PS', 2, 0],
      ['G 80', 'Egon Renner', '', 'KL', 4, 0],
      ['F 86', 'Semih Isikkan', 'Hugo Luther', 'AS', 0, 4],
      ['G 98', 'Markus Kurle', 'Morteza Najar', 'PS', 3, 0],
      ['F 130', 'Goran Majkic', 'Artur Ortmann', 'AS', 0, 4],
    ];
    bouts.forEach((x, i) => b.run(id, i + 1, ...x));
    o.run(id, 'KSV Simson Landgraaf', 'KSV Witten 07 II', 36, 0);
    o.run(id, 'TV Essen-Dellwig II', 'ASV Atlas Bielefeld', 0, 40);
    o.run(id, 'Sport-Union Annen II', 'TuS Aldenhoven', 19, 19);
    m.run('2026-10-31', '19:00', '9. Kampftag', 'Landesliga', 'ASV Atlas Bielefeld', 'RC Ehrenfeld 1976', null, null, 'Auswärts', '');
  })();
}

if (count('posts') === 0) {
  const p = db.prepare('INSERT INTO posts (slug, type, title, teaser, body, image, image_alt, date, published) VALUES (?,?,?,?,?,?,?,?,?)');
  db.transaction(() => {
    p.run('auswaerts-beim-tabellenzweiten', 'vorbericht', 'Samstag auswärts beim Tabellenzweiten',
      'Am 9. Kampftag geht es am Samstag, 31.10.2026, um 19:00 Uhr zum ASV Atlas Bielefeld.',
      'Am 9. Kampftag geht es für unsere Mannschaft am Samstag, 31.10.2026, um 19:00 Uhr zum ASV Atlas Bielefeld. Die Bielefelder stehen mit 14:2 Punkten auf Platz 2 der Landesliga und haben zuletzt 40:0 in Essen gewonnen. Wir reisen mit dem Rückenwind aus dem 19:16-Heimsieg gegen Duisdorf an.',
      null, '', '2026-10-28', 1);
    p.run('heimsieg-gegen-duisdorf', 'kampfbericht', '19:16 – Heimsieg gegen Duisdorf',
      'Enger Kampf in der Halle: Am Ende stand ein 19:16 gegen den TKSV 1906 Duisdorf.',
      'Enger Kampf in der Halle: Nach den Schultersiegen von Mustafa Faqiri und Enes Özcan sowie den Punktsiegen von Kaan Efe Kosar, Emil Bruno Renner und Markus Kurle stand am Ende ein 19:16 gegen den TKSV 1906 Duisdorf. Damit holt die Mannschaft den dritten Saisonsieg.',
      '/assets/img/mannschaft-duisdorf-2026.jpg', 'Die Mannschaft des RC Ehrenfeld 1976 nach dem Heimsieg gegen Duisdorf auf der Matte', '2026-10-25', 1);
  })();
}

// ---------- Helfer ----------
const settings = {
  all() {
    const o = {};
    for (const r of db.prepare('SELECT key, value FROM settings').all()) o[r.key] = r.value;
    return o;
  },
  get(key) { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key); return r ? r.value : ''; },
  set(key, value) { db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value ?? ''); },
};

module.exports = { db, settings, DATA_DIR };
