'use strict';
const express = require('express');
const { db, settings } = require('../db');

const router = express.Router();

function siteData() {
  const s = settings.all();
  const today = new Date().toISOString().slice(0, 10);
  const posts = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY date DESC, id DESC LIMIT 3').all();
  const nextMatch = db.prepare('SELECT * FROM matches WHERE home_score IS NULL AND date >= ? ORDER BY date ASC, time ASC LIMIT 1').get(today)
    || db.prepare('SELECT * FROM matches WHERE home_score IS NULL ORDER BY date ASC LIMIT 1').get();
  const lastMatch = db.prepare('SELECT * FROM matches WHERE home_score IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1').get();
  const bouts = lastMatch ? db.prepare('SELECT * FROM bouts WHERE match_id = ? ORDER BY position').all(lastMatch.id) : [];
  const others = lastMatch ? db.prepare('SELECT * FROM other_results WHERE match_id = ? ORDER BY id').all(lastMatch.id) : [];
  const league = db.prepare('SELECT * FROM league_rows ORDER BY position').all();
  const groups = db.prepare('SELECT * FROM training_groups ORDER BY position').all().map((g) => ({
    ...g, times: db.prepare('SELECT * FROM training_times WHERE group_id = ? ORDER BY position').all(g.id),
  }));
  const trainers = db.prepare('SELECT * FROM trainers ORDER BY position').all();
  const trainerRoles = [];
  for (const t of trainers) {
    let r = trainerRoles.find((x) => x.role === t.role);
    if (!r) { r = { role: t.role, names: [] }; trainerRoles.push(r); }
    r.names.push(t.name);
  }
  const sponsors = db.prepare('SELECT * FROM sponsors WHERE active = 1 ORDER BY position').all();
  const board = db.prepare('SELECT * FROM board ORDER BY position').all();
  const ownTeam = (league.find((r) => r.is_own) || {}).team || 'RC Ehrenfeld 1976';
  return { s, posts, nextMatch, lastMatch, bouts, others, league, groups, trainerRoles, sponsors, board, ownTeam };
}

router.get('/', (req, res) => {
  res.render('public/index', { ...siteData(), title: null, path: '/' });
});

router.get('/aktuelles', (req, res) => {
  const s = settings.all();
  const posts = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY date DESC, id DESC').all();
  const board = db.prepare('SELECT * FROM board ORDER BY position').all();
  res.render('public/archive', { s, posts, board, title: 'Aktuelles', path: '/aktuelles' });
});

router.get('/aktuelles/:slug', (req, res, next) => {
  const post = db.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1').get(req.params.slug);
  if (!post) return next();
  const s = settings.all();
  const board = db.prepare('SELECT * FROM board ORDER BY position').all();
  const more = db.prepare('SELECT * FROM posts WHERE published = 1 AND id != ? ORDER BY date DESC, id DESC LIMIT 3').all(post.id);
  res.render('public/post', { s, post, more, board, title: post.title, path: '/aktuelles/' + post.slug });
});

router.get('/impressum', (req, res) => {
  const s = settings.all();
  const board = db.prepare('SELECT * FROM board ORDER BY position').all();
  res.render('public/impressum', { s, board, title: 'Impressum', path: '/impressum', noindex: true });
});

router.get('/datenschutz', (req, res) => {
  const s = settings.all();
  res.render('public/datenschutz', { s, board: [], title: 'Datenschutzerklärung', path: '/datenschutz', noindex: true });
});

router.get('/robots.txt', (req, res) => {
  const s = settings.all();
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${s.base_url}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const s = settings.all();
  const posts = db.prepare('SELECT slug, date, updated_at FROM posts WHERE published = 1 ORDER BY date DESC').all();
  const urls = [
    { loc: `${s.base_url}/`, freq: 'weekly', prio: '1.0' },
    { loc: `${s.base_url}/aktuelles`, freq: 'weekly', prio: '0.8' },
    ...posts.map((p) => ({ loc: `${s.base_url}/aktuelles/${p.slug}`, lastmod: p.date, freq: 'monthly', prio: '0.6' })),
    { loc: `${s.base_url}/impressum`, freq: 'yearly', prio: '0.2' },
    { loc: `${s.base_url}/datenschutz`, freq: 'yearly', prio: '0.2' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n') +
    `\n</urlset>\n`;
  res.type('application/xml').send(xml);
});

module.exports = router;
