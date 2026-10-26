'use strict';
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const { DATA_DIR } = require('./src/db');
const util = require('./src/util');

const PORT = parseInt(process.env.PORT || '3004', 10);
const SECRET = process.env.SESSION_SECRET;
if (!SECRET || SECRET.length < 32) {
  console.error('SESSION_SECRET fehlt oder ist zu kurz (mind. 32 Zeichen). Siehe README.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '7d', immutable: false }));
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '30d' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

app.use(cookieSession({
  name: 'rce.sid',
  keys: [SECRET],
  maxAge: 12 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}));

app.locals.util = util;

app.use('/admin', require('./src/routes/admin'));
app.use('/', require('./src/routes/public'));

app.use((req, res) => res.status(404).render('public/404', { title: 'Seite nicht gefunden', s: require('./src/db').settings.all() }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).send('Interner Fehler. Bitte später erneut versuchen.');
});

app.listen(PORT, '127.0.0.1', () => console.log(`RC Ehrenfeld CMS läuft auf http://127.0.0.1:${PORT}`));
