'use strict';

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const POST_TYPES = { vorbericht: 'Vorbericht', kampfbericht: 'Kampfbericht', verein: 'Verein' };
const RESULT_TYPES = { SS: 'Schultersieg', 'TÜ': 'technische Überlegenheit', PS: 'Punktsieg', AS: 'Aufgabesieg', KL: 'kampflos', DQ: 'Disqualifikation', '': '' };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Kleiner, sicherer Textformatierer: Absätze, Zeilenumbrüche, **fett**, Links.
function formatText(text) {
  const esc = escapeHtml(text).replace(/\r\n/g, '\n');
  return esc.split(/\n{2,}/).map((p) => {
    let h = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(https?:\/\/[^\s<]+)/g, (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
    return `<p>${h.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function formatDateWd(iso) {
  if (!iso) return '';
  const dt = new Date(iso + 'T00:00:00');
  return `${WD_SHORT[dt.getDay()]}, ${formatDate(iso)}`;
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'beitrag';
}

function lines(s) { return String(s ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean); }

function toInt(v, d = 0) { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; }
function toIntOrNull(v) { if (v === '' || v == null) return null; const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }

module.exports = { WEEKDAYS, POST_TYPES, RESULT_TYPES, escapeHtml, formatText, formatDate, formatDateWd, slugify, lines, toInt, toIntOrNull };
