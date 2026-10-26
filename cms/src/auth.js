'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { db } = require('./db');

// Login-Bremse: max. 10 Fehlversuche pro IP in 15 Minuten
const attempts = new Map();
function tooManyAttempts(ip) {
  const a = attempts.get(ip);
  if (!a) return false;
  if (Date.now() - a.first > 15 * 60 * 1000) { attempts.delete(ip); return false; }
  return a.count >= 10;
}
function noteFailure(ip) {
  const a = attempts.get(ip);
  if (!a || Date.now() - a.first > 15 * 60 * 1000) attempts.set(ip, { first: Date.now(), count: 1 });
  else a.count += 1;
}

function findUser(email) {
  return db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email || '').trim());
}

function verify(user, password) {
  return user && bcrypt.compareSync(String(password || ''), user.password_hash);
}

function createUser(name, email, password) {
  const hash = bcrypt.hashSync(password, 12);
  return db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name.trim(), email.trim().toLowerCase(), hash);
}

function setPassword(id, password) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), id);
}

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) {
    req.user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.session.userId);
    if (req.user) { res.locals.user = req.user; return next(); }
  }
  req.session = null;
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl));
}

// CSRF: Token in der Session, bei jedem POST prüfen.
// Multipart-Formulare (Uploads) sind hier noch nicht eingelesen; die prüft
// verifyCsrf nach multer in der jeweiligen Route.
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST' && !req.is('multipart/form-data')) return verifyCsrf(req, res, next);
  next();
}

function verifyCsrf(req, res, next) {
  const sent = (req.body && req.body._csrf) || req.get('x-csrf-token');
  if (!sent || !req.session.csrf || sent !== req.session.csrf) return res.status(403).send('Formular abgelaufen. Bitte Seite neu laden.');
  next();
}

module.exports = { findUser, verify, createUser, setPassword, requireLogin, csrf, verifyCsrf, tooManyAttempts, noteFailure };
