#!/usr/bin/env node
'use strict';
// Legt einen Admin-Benutzer an oder setzt das Passwort neu.
// Aufruf: npm run create-admin -- "Name" mail@verein.de geheimesPasswort
const { createUser, findUser, setPassword } = require('../src/auth');

const [name, email, password] = process.argv.slice(2);
if (!name || !email || !password) {
  console.error('Aufruf: npm run create-admin -- "Name" mail@adresse.de Passwort');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Passwort bitte mindestens 10 Zeichen.');
  process.exit(1);
}
const existing = findUser(email);
if (existing) {
  setPassword(existing.id, password);
  console.log(`Passwort für ${email} neu gesetzt.`);
} else {
  createUser(name, email, password);
  console.log(`Benutzer ${email} angelegt.`);
}
