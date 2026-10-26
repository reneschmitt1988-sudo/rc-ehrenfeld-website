'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { db, settings, DATA_DIR } = require('../db');
const auth = require('../auth');
const { slugify, toInt, toIntOrNull, lines, WEEKDAYS, POST_TYPES, RESULT_TYPES } = require('../util');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// Bild speichern: auf max. 1600 px verkleinern, als JPEG oder PNG (Logos) ablegen
async function saveImage(file, { maxWidth = 1600, keepPng = false } = {}) {
  if (!file) return null;
  const isPng = keepPng && file.mimetype === 'image/png';
  const name = crypto.randomBytes(8).toString('hex') + (isPng ? '.png' : '.jpg');
  const out = path.join(DATA_DIR, 'uploads', name);
  let img = sharp(file.buffer).rotate().resize({ width: maxWidth, withoutEnlargement: true });
  img = isPng ? img.png({ compressionLevel: 9 }) : img.jpeg({ quality: 82, mozjpeg: true });
  await img.toFile(out);
  return '/uploads/' + name;
}

function flash(req, msg) { req.session.flash = msg; }
router.use((req, res, next) => {
  res.locals.flash = req.session ? req.session.flash : null;
  if (req.session) req.session.flash = null;
  res.locals.util = require('../util');
  res.locals.POST_TYPES = POST_TYPES;
  res.locals.RESULT_TYPES = RESULT_TYPES;
  res.locals.WEEKDAYS = WEEKDAYS;
  res.locals.siteName = settings.get('site_name');
  next();
});

// ---------- Login ----------
router.get('/login', auth.csrf, (req, res) => {
  if (req.session.userId) return res.redirect('/admin');
  const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
  res.render('admin/login', { title: 'Anmelden', error: null, hasUsers, next: req.query.next || '' });
});

router.post('/login', auth.csrf, (req, res) => {
  const ip = req.ip;
  if (auth.tooManyAttempts(ip)) return res.status(429).render('admin/login', { title: 'Anmelden', error: 'Zu viele Fehlversuche. Bitte 15 Minuten warten.', hasUsers: true, next: '' });
  const user = auth.findUser(req.body.email);
  if (!auth.verify(user, req.body.password)) {
    auth.noteFailure(ip);
    return res.status(401).render('admin/login', { title: 'Anmelden', error: 'E-Mail oder Passwort stimmt nicht.', hasUsers: true, next: req.body.next || '' });
  }
  req.session.userId = user.id;
  const next = typeof req.body.next === 'string' && req.body.next.startsWith('/admin') ? req.body.next : '/admin';
  res.redirect(next);
});

router.post('/logout', auth.csrf, (req, res) => { req.session = null; res.redirect('/admin/login'); });

// Ab hier nur angemeldet
router.use(auth.requireLogin, auth.csrf);

router.get('/', (req, res) => {
  const stats = {
    posts: db.prepare('SELECT COUNT(*) AS n FROM posts').get().n,
    drafts: db.prepare('SELECT COUNT(*) AS n FROM posts WHERE published = 0').get().n,
    matches: db.prepare('SELECT COUNT(*) AS n FROM matches').get().n,
    sponsors: db.prepare('SELECT COUNT(*) AS n FROM sponsors WHERE active = 1').get().n,
  };
  const recent = db.prepare('SELECT * FROM posts ORDER BY updated_at DESC LIMIT 5').all();
  res.render('admin/dashboard', { title: 'Übersicht', stats, recent });
});

// ---------- News ----------
router.get('/news', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY date DESC, id DESC').all();
  res.render('admin/news-list', { title: 'Beiträge', posts });
});

router.get('/news/neu', (req, res) => {
  res.render('admin/news-form', { title: 'Neuer Beitrag', post: { type: 'kampfbericht', date: new Date().toISOString().slice(0, 10), published: 0, title: '', teaser: '', body: '', image_alt: '' }, isNew: true });
});

router.get('/news/:id', (req, res, next) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return next();
  res.render('admin/news-form', { title: 'Beitrag bearbeiten', post, isNew: false });
});

router.post('/news/:id', upload.single('image'), auth.verifyCsrf, async (req, res, next) => {
  try {
    const b = req.body;
    const isNew = req.params.id === 'neu';
    const title = String(b.title || '').trim();
    if (!title) { flash(req, 'Überschrift fehlt.'); return res.redirect(isNew ? '/admin/news/neu' : '/admin/news/' + req.params.id); }
    let slug = slugify(b.slug || title);
    const clash = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, isNew ? -1 : req.params.id);
    if (clash) slug += '-' + Date.now().toString(36);
    const type = POST_TYPES[b.type] ? b.type : 'verein';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
    const published = b.published ? 1 : 0;
    let image = isNew ? null : (db.prepare('SELECT image FROM posts WHERE id = ?').get(req.params.id) || {}).image;
    if (b.remove_image) image = null;
    const uploaded = await saveImage(req.file);
    if (uploaded) image = uploaded;
    const vals = [slug, type, title, String(b.teaser || '').trim(), String(b.body || '').trim(), image, String(b.image_alt || '').trim(), date, published];
    if (isNew) {
      const r = db.prepare('INSERT INTO posts (slug, type, title, teaser, body, image, image_alt, date, published) VALUES (?,?,?,?,?,?,?,?,?)').run(...vals);
      flash(req, 'Beitrag angelegt.');
      return res.redirect('/admin/news/' + r.lastInsertRowid);
    }
    db.prepare("UPDATE posts SET slug=?, type=?, title=?, teaser=?, body=?, image=?, image_alt=?, date=?, published=?, updated_at=datetime('now') WHERE id=?").run(...vals, req.params.id);
    flash(req, 'Gespeichert.');
    res.redirect('/admin/news/' + req.params.id);
  } catch (e) { next(e); }
});

router.post('/news/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  flash(req, 'Beitrag gelöscht.');
  res.redirect('/admin/news');
});

// ---------- Kämpfe ----------
router.get('/kaempfe', (req, res) => {
  const matches = db.prepare('SELECT * FROM matches ORDER BY date DESC, id DESC').all();
  res.render('admin/match-list', { title: 'Kämpfe', matches, s: settings.all() });
});

router.post('/kaempfe/stand', (req, res) => {
  settings.set('season_label', String(req.body.season_label || '').trim());
  settings.set('results_stand', String(req.body.results_stand || '').trim());
  flash(req, 'Saison und Stand gespeichert.');
  res.redirect('/admin/kaempfe');
});

router.get('/kaempfe/neu', (req, res) => {
  const own = (db.prepare('SELECT team FROM league_rows WHERE is_own = 1').get() || {}).team || 'RC Ehrenfeld 1976';
  res.render('admin/match-form', { title: 'Neuer Kampf', match: { date: '', time: '', kampftag: '', liga: 'Landesliga', home: own, away: '', home_score: null, away_score: null, location: 'Heim', referee: '', note: '' }, bouts: [], others: [], isNew: true });
});

router.get('/kaempfe/:id', (req, res, next) => {
  const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
  if (!match) return next();
  const bouts = db.prepare('SELECT * FROM bouts WHERE match_id = ? ORDER BY position').all(match.id);
  const others = db.prepare('SELECT * FROM other_results WHERE match_id = ? ORDER BY id').all(match.id);
  res.render('admin/match-form', { title: 'Kampf bearbeiten', match, bouts, others, isNew: false });
});

router.post('/kaempfe/:id', (req, res) => {
  const b = req.body;
  const isNew = req.params.id === 'neu';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : null;
  if (!date || !b.home || !b.away) { flash(req, 'Datum, Heim und Gast sind Pflicht.'); return res.redirect(isNew ? '/admin/kaempfe/neu' : '/admin/kaempfe/' + req.params.id); }
  const vals = [date, String(b.time || '').trim(), String(b.kampftag || '').trim(), String(b.liga || '').trim(), String(b.home).trim(), String(b.away).trim(), toIntOrNull(b.home_score), toIntOrNull(b.away_score), String(b.location || '').trim(), String(b.referee || '').trim(), String(b.note || '').trim()];
  const tx = db.transaction(() => {
    let id = req.params.id;
    if (isNew) id = db.prepare('INSERT INTO matches (date, time, kampftag, liga, home, away, home_score, away_score, location, referee, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(...vals).lastInsertRowid;
    else db.prepare('UPDATE matches SET date=?, time=?, kampftag=?, liga=?, home=?, away=?, home_score=?, away_score=?, location=?, referee=?, note=? WHERE id=?').run(...vals, id);
    // Einzelkämpfe
    db.prepare('DELETE FROM bouts WHERE match_id = ?').run(id);
    const wc = [].concat(b.wc || []), hw = [].concat(b.hw || []), aw = [].concat(b.aw || []), rt = [].concat(b.rt || []), hp = [].concat(b.hp || []), ap = [].concat(b.ap || []);
    const ins = db.prepare('INSERT INTO bouts (match_id, position, weight_class, home_wrestler, away_wrestler, result_type, home_points, away_points) VALUES (?,?,?,?,?,?,?,?)');
    let pos = 0;
    for (let i = 0; i < wc.length; i++) {
      if (!String(wc[i]).trim()) continue;
      ins.run(id, ++pos, String(wc[i]).trim(), String(hw[i] || '').trim(), String(aw[i] || '').trim(), String(rt[i] || '').trim(), toInt(hp[i]), toInt(ap[i]));
    }
    // Weitere Ergebnisse
    db.prepare('DELETE FROM other_results WHERE match_id = ?').run(id);
    const oh = [].concat(b.oh || []), oa = [].concat(b.oa || []), ohs = [].concat(b.ohs || []), oas = [].concat(b.oas || []);
    const ins2 = db.prepare('INSERT INTO other_results (match_id, home, away, home_score, away_score) VALUES (?,?,?,?,?)');
    for (let i = 0; i < oh.length; i++) {
      if (!String(oh[i]).trim() || !String(oa[i] || '').trim()) continue;
      ins2.run(id, String(oh[i]).trim(), String(oa[i]).trim(), toInt(ohs[i]), toInt(oas[i]));
    }
    return id;
  });
  const id = tx();
  flash(req, 'Kampf gespeichert.');
  res.redirect('/admin/kaempfe/' + id);
});

router.post('/kaempfe/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM matches WHERE id = ?').run(req.params.id);
  flash(req, 'Kampf gelöscht.');
  res.redirect('/admin/kaempfe');
});

// ---------- Tabelle ----------
router.get('/tabelle', (req, res) => {
  const rows = db.prepare('SELECT * FROM league_rows ORDER BY position').all();
  res.render('admin/table-form', { title: 'Tabelle', rows, s: settings.all() });
});

router.post('/tabelle', (req, res) => {
  const b = req.body;
  settings.set('table_stand', String(b.table_stand || '').trim());
  settings.set('league_url', String(b.league_url || '').trim());
  const team = [].concat(b.team || []), k = [].concat(b.k || []), s = [].concat(b.s || []), u = [].concat(b.u || []), n = [].concat(b.n || []), pf = [].concat(b.pf || []), pa = [].concat(b.pa || []), tp = [].concat(b.tp || []);
  const own = toInt(b.own, -1);
  db.transaction(() => {
    db.prepare('DELETE FROM league_rows').run();
    const ins = db.prepare('INSERT INTO league_rows (position, team, played, won, drawn, lost, points_for, points_against, table_points, is_own) VALUES (?,?,?,?,?,?,?,?,?,?)');
    let pos = 0;
    for (let i = 0; i < team.length; i++) {
      if (!String(team[i]).trim()) continue;
      ins.run(++pos, String(team[i]).trim(), toInt(k[i]), toInt(s[i]), toInt(u[i]), toInt(n[i]), toInt(pf[i]), toInt(pa[i]), String(tp[i] || '0 : 0').trim(), i === own ? 1 : 0);
    }
  })();
  flash(req, 'Tabelle gespeichert.');
  res.redirect('/admin/tabelle');
});

// ---------- Training ----------
router.get('/training', (req, res) => {
  const groups = db.prepare('SELECT * FROM training_groups ORDER BY position').all().map((g) => ({ ...g, times: db.prepare('SELECT * FROM training_times WHERE group_id = ? ORDER BY position').all(g.id) }));
  res.render('admin/training', { title: 'Training', groups, s: settings.all() });
});

router.post('/training/intro', (req, res) => {
  settings.set('training_intro', String(req.body.training_intro || '').trim());
  flash(req, 'Einleitung gespeichert.');
  res.redirect('/admin/training');
});

router.post('/training/gruppe/:id', (req, res) => {
  const b = req.body;
  const isNew = req.params.id === 'neu';
  const name = String(b.name || '').trim();
  if (!name) { flash(req, 'Gruppenname fehlt.'); return res.redirect('/admin/training'); }
  db.transaction(() => {
    let id = req.params.id;
    if (isNew) {
      const pos = (db.prepare('SELECT MAX(position) AS m FROM training_groups').get().m || 0) + 1;
      id = db.prepare('INSERT INTO training_groups (position, name, subtitle, note) VALUES (?,?,?,?)').run(pos, name, String(b.subtitle || '').trim(), String(b.note || '').trim()).lastInsertRowid;
    } else {
      db.prepare('UPDATE training_groups SET name=?, subtitle=?, note=? WHERE id=?').run(name, String(b.subtitle || '').trim(), String(b.note || '').trim(), id);
    }
    db.prepare('DELETE FROM training_times WHERE group_id = ?').run(id);
    const label = [].concat(b.label || []), wd = [].concat(b.weekday || []), from = [].concat(b.time_from || []), to = [].concat(b.time_to || []), loc = [].concat(b.location || []);
    const ins = db.prepare('INSERT INTO training_times (group_id, position, label, weekday, time_from, time_to, location) VALUES (?,?,?,?,?,?,?)');
    let pos = 0;
    for (let i = 0; i < wd.length; i++) {
      if (!WEEKDAYS.includes(wd[i]) || !String(from[i] || '').trim()) continue;
      ins.run(id, ++pos, String(label[i] || '').trim(), wd[i], String(from[i]).trim(), String(to[i] || '').trim(), String(loc[i] || '').trim());
    }
  })();
  flash(req, 'Gruppe gespeichert.');
  res.redirect('/admin/training');
});

router.post('/training/gruppe/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM training_groups WHERE id = ?').run(req.params.id);
  flash(req, 'Gruppe gelöscht.');
  res.redirect('/admin/training');
});

router.post('/training/gruppe/:id/verschieben', (req, res) => {
  const dir = req.body.dir === 'up' ? -1 : 1;
  const all = db.prepare('SELECT id FROM training_groups ORDER BY position').all().map((r) => r.id);
  const i = all.indexOf(toInt(req.params.id));
  if (i >= 0 && i + dir >= 0 && i + dir < all.length) {
    [all[i], all[i + dir]] = [all[i + dir], all[i]];
    const upd = db.prepare('UPDATE training_groups SET position = ? WHERE id = ?');
    db.transaction(() => all.forEach((id, idx) => upd.run(idx + 1, id)))();
  }
  res.redirect('/admin/training');
});

// ---------- Trainer, Vorstand (gleiche Form: Rolle + Name) ----------
function simpleList(table, pathName, titleName) {
  router.get('/' + pathName, (req, res) => {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY position`).all();
    res.render('admin/role-list', { title: titleName, rows, pathName, s: settings.all(), table });
  });
  router.post('/' + pathName, (req, res) => {
    const role = [].concat(req.body.role || []), name = [].concat(req.body.name || []);
    db.transaction(() => {
      db.prepare(`DELETE FROM ${table}`).run();
      const ins = db.prepare(`INSERT INTO ${table} (position, role, name) VALUES (?,?,?)`);
      let pos = 0;
      for (let i = 0; i < role.length; i++) {
        if (!String(name[i] || '').trim()) continue;
        ins.run(++pos, String(role[i] || '').trim(), String(name[i]).trim());
      }
    })();
    if (table === 'trainers') settings.set('trainer_note', String(req.body.trainer_note || '').trim());
    flash(req, 'Gespeichert.');
    res.redirect('/admin/' + pathName);
  });
}
simpleList('trainers', 'trainer', 'Trainerteam');
simpleList('board', 'vorstand', 'Vorstand');

// ---------- Sponsoren ----------
router.get('/sponsoren', (req, res) => {
  const sponsors = db.prepare('SELECT * FROM sponsors ORDER BY position').all();
  res.render('admin/sponsors', { title: 'Sponsoren', sponsors, s: settings.all() });
});

router.post('/sponsoren/intro', (req, res) => {
  settings.set('sponsor_intro', String(req.body.sponsor_intro || '').trim());
  flash(req, 'Text gespeichert.');
  res.redirect('/admin/sponsoren');
});

router.post('/sponsoren/:id', upload.single('logo'), auth.verifyCsrf, async (req, res, next) => {
  try {
    const b = req.body;
    const isNew = req.params.id === 'neu';
    const name = String(b.name || '').trim();
    if (!name) { flash(req, 'Name fehlt.'); return res.redirect('/admin/sponsoren'); }
    let logo = isNew ? null : (db.prepare('SELECT logo FROM sponsors WHERE id = ?').get(req.params.id) || {}).logo;
    const uploaded = await saveImage(req.file, { maxWidth: 800, keepPng: true });
    if (uploaded) logo = uploaded;
    const active = b.active ? 1 : 0;
    if (isNew) {
      const pos = (db.prepare('SELECT MAX(position) AS m FROM sponsors').get().m || 0) + 1;
      db.prepare('INSERT INTO sponsors (position, name, url, logo, active) VALUES (?,?,?,?,?)').run(pos, name, String(b.url || '').trim(), logo, 1);
    } else {
      db.prepare('UPDATE sponsors SET name=?, url=?, logo=?, active=? WHERE id=?').run(name, String(b.url || '').trim(), logo, active, req.params.id);
    }
    flash(req, 'Sponsor gespeichert.');
    res.redirect('/admin/sponsoren');
  } catch (e) { next(e); }
});

router.post('/sponsoren/:id/loeschen', (req, res) => {
  db.prepare('DELETE FROM sponsors WHERE id = ?').run(req.params.id);
  flash(req, 'Sponsor gelöscht.');
  res.redirect('/admin/sponsoren');
});

router.post('/sponsoren/:id/verschieben', (req, res) => {
  const dir = req.body.dir === 'up' ? -1 : 1;
  const all = db.prepare('SELECT id FROM sponsors ORDER BY position').all().map((r) => r.id);
  const i = all.indexOf(toInt(req.params.id));
  if (i >= 0 && i + dir >= 0 && i + dir < all.length) {
    [all[i], all[i + dir]] = [all[i + dir], all[i]];
    const upd = db.prepare('UPDATE sponsors SET position = ? WHERE id = ?');
    db.transaction(() => all.forEach((id, idx) => upd.run(idx + 1, id)))();
  }
  res.redirect('/admin/sponsoren');
});

// ---------- Einstellungen ----------
const SETTING_FIELDS = ['site_name', 'legal_name', 'base_url', 'eyebrow', 'hero_title', 'hero_accent', 'hero_text', 'meta_description', 'history_lead', 'history_text', 'successes', 'alumni', 'alumni_note', 'membership_note', 'halls', 'contact_name', 'address', 'phone', 'phone_link', 'email', 'instagram', 'register', 'responsible', 'hoster', 'privacy_date'];

router.get('/einstellungen', (req, res) => {
  res.render('admin/settings', { title: 'Einstellungen', s: settings.all() });
});

router.post('/einstellungen', upload.single('hero_image'), auth.verifyCsrf, async (req, res, next) => {
  try {
    for (const k of SETTING_FIELDS) if (k in req.body) settings.set(k, String(req.body[k]).trim());
    if (req.body.remove_hero_image) settings.set('hero_image', '');
    const uploaded = await saveImage(req.file, { maxWidth: 1200 });
    if (uploaded) settings.set('hero_image', uploaded);
    flash(req, 'Einstellungen gespeichert.');
    res.redirect('/admin/einstellungen');
  } catch (e) { next(e); }
});

// ---------- Benutzer ----------
router.get('/benutzer', (req, res) => {
  const users = db.prepare('SELECT id, name, email, created_at FROM users ORDER BY name').all();
  res.render('admin/users', { title: 'Benutzer', users });
});

router.post('/benutzer', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 10) { flash(req, 'Name, E-Mail und ein Passwort mit mindestens 10 Zeichen sind nötig.'); return res.redirect('/admin/benutzer'); }
  if (auth.findUser(email)) { flash(req, 'Diese E-Mail gibt es schon.'); return res.redirect('/admin/benutzer'); }
  auth.createUser(name, email, password);
  flash(req, 'Benutzer angelegt.');
  res.redirect('/admin/benutzer');
});

router.post('/benutzer/:id/passwort', (req, res) => {
  if (!req.body.password || req.body.password.length < 10) { flash(req, 'Passwort mindestens 10 Zeichen.'); return res.redirect('/admin/benutzer'); }
  auth.setPassword(req.params.id, req.body.password);
  flash(req, 'Passwort geändert.');
  res.redirect('/admin/benutzer');
});

router.post('/benutzer/:id/loeschen', (req, res) => {
  if (toInt(req.params.id) === req.user.id) { flash(req, 'Du kannst dich nicht selbst löschen.'); return res.redirect('/admin/benutzer'); }
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n <= 1) { flash(req, 'Der letzte Benutzer bleibt.'); return res.redirect('/admin/benutzer'); }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  flash(req, 'Benutzer gelöscht.');
  res.redirect('/admin/benutzer');
});

module.exports = router;
