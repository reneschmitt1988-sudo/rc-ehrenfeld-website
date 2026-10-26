# RC Ehrenfeld 1976 e.V. – Vereinswebsite

Projektkontext für jede Claude-Sitzung. Bitte zuerst lesen.

## Was das ist

Website des Ringer Club Ehrenfeld 1976 e.V. (Köln). Betreut von René Schmitt
(reneschmitt1988-sudo), der nicht im Vorstand ist, aber die Seite für den Verein baut.
Ansprechperson im Verein: Robin Pelzer (Geschäftsführer), info@rc-ehrenfeld.de.

Sprache: Deutsch. Mit René informell (du), Texte auf der Website informell (du),
Impressum/Datenschutz formell (Sie). Keine Fakten erfinden, fehlende Angaben als
[PLATZHALTER] markieren.

## Stand

**Stufe 1 (fertig): statische Website.** Reines HTML/CSS, kein Build-Schritt, keine
Abhängigkeiten. Schriften lokal (Anton, Barlow, Barlow Condensed), keine Cookies,
kein Tracking. SEO: Meta, Open Graph, JSON-LD (SportsClub, SportsEvent, FAQPage),
sitemap.xml, robots.txt. Mobil geprüft (390 px), kein horizontales Scrollen.

Der Design-Entwurf, aus dem die Seite entstand, liegt als Claude-Design-Artifact bei
René. Die HTML-Version hier ist die Wahrheit, nicht der Entwurf.

**Hosting:** Hetzner Cloud (Ubuntu 24.04, 46.225.11.128), derselbe Server wie die
RASCH-Tools (nginx, Let's Encrypt). Ablage: /var/www/rc-ehrenfeld, Deploy per
`git pull`. nginx-Config und logrotate in deploy/. Anleitung in README.md.

**Domain:** rc-ehrenfeld.de, liegt beim Verein (Anbieter unbekannt). A-Einträge
müssen auf 46.225.11.128 gesetzt werden, MX unangetastet lassen. Danach
`certbot --nginx -d rc-ehrenfeld.de -d www.rc-ehrenfeld.de --redirect`.

## Design

Farben aus dem Vereinswappen: Blau #1B3FA0 (Akzent), Navy #0B1B4A (Text, Flächen),
Gelb #F5D90A (Zahnrad im Wappen, sparsam), Grund #F3F6FC, Hell #DCE5F7.
Schrift: Anton für Überschriften (Versalien), Barlow Condensed für Labels/Buttons,
Barlow für Fließtext. Stil: Ringerplakat, kräftig, keine Verläufe, keine Emojis,
keine abgerundeten Karten mit Farbbalken links. Alle Styles in assets/css/style.css,
Inline-Styles nur für die zwei Trennlinien der Sektionen.

## Inhalte, die feststehen

- Training: Ringerwiesel 5–7 J. Mo 17:15–18:15 (Wasseramselweg); Jugend 10–15 J.
  Mi 18–19 (Wasseramselweg), Fr 18–19 (Kolkrabenweg 65); Erwachsene Mo 18:30–20,
  Mi 19:30–21 (Wasseramselweg), Fr 19:30–21 (Kolkrabenweg 65). Alle 50829 Köln.
  Mädchen und Frauen trainieren in allen Gruppen mit; keine eigene Frauengruppe.
- Trainer: Senioren Melvin + Robin Pelzer; Jugend Yilmaz Kosar + Janine Hannes;
  Ringerwiesel Janine Hannes.
- Vorstand (Vereinsregister Amtsgericht Köln VR 7287, Stand 18.06.2025):
  Melvin Pelzer (1. Vors.), Kevin van Rienen (2. Vors.), Robin Pelzer (GF),
  Enes Özcan (Kassenwart). Jedes Mitglied vertritt einzeln.
- Eingetragener Name: "Ringer Club Ehrenfeld 1976 e.V." (im Impressum), auf der
  Seite "RC Ehrenfeld 1976 e.V.".
- Sponsoren: Willms Bau GmbH & Co. KG (willms-gruppe.de/willms-bau/), ZADEM (zadem.org).
- Instagram: @rcehrenfeld. Landesliga-Tabelle: ringen-nrw.de (Link im Abschnitt Tabelle).
- Vereinsgeschichte stammt von der alten Website (vor Corona), gekürzt; René
  aktualisiert Stück für Stück.

## Offene Punkte (Stand 26.10.2026)

- Fotos: Startbereich, Vorbericht-Karte (Platzhalter `[FOTO`)
- Sponsoren 3 und 4 oder Kacheln entfernen (`[LOGO SPONSOR`)
- Mitgliedsbeitrag (`[MITGLIEDSBEITRAG`)
- Vorstandsfeedback zum Entwurf abwarten
- Anfrage an Ringerverband NRW wegen Tabellenübernahme: Text in
  deploy/anfrage-ringerverband-nrw.md, Versand durch den Vorstand. ringen-nrw.de
  blockiert Bots per robots.txt, ohne Zustimmung NICHT scrapen.
- Datenschutz rechtlich prüfen lassen vor Livegang

## Stufe 2 (gebaut, noch nicht deployed): eigenes CMS in cms/

Node.js (Express) + better-sqlite3 + EJS, Port 3050 hinter nginx, systemd-Dienst.
Alle Benutzer sind Admins (Entscheidung René, 26.10.2026). Module: Beiträge mit
Foto (Entwurf/Veröffentlicht), Kämpfe mit Einzelkämpfen, Tabelle, Training,
Trainer, Sponsoren, Vorstand, Einstellungen, Benutzer. Öffentliche Seiten werden
aus der DB gerendert, Design identisch zu Stufe 1 (gleiches style.css in
cms/public/assets). Seed-Daten = Inhalte von Stufe 1. Anleitung: cms/README.md,
Deploy-Dateien: deploy/rc-ehrenfeld-cms.service, deploy/nginx-rc-ehrenfeld-cms.conf.

Die statischen Dateien im Repo-Root (index.html usw.) bleiben, bis das CMS auf
dem Server läuft; danach können sie entfernt werden. Tabellenabruf vom Verband
weiterhin nur nach Freigabe (offen).

Entwicklung: `cd cms && SESSION_SECRET=$(openssl rand -hex 32) npm start`,
Admin anlegen mit `npm run create-admin`. End-to-End-Test vor dem Push mit
Playwright gegen http://127.0.0.1:3050 (Login, Beitrag mit Upload, Kampf,
Tabelle, Einstellungen, CSRF, Logout).

## Arbeitsregeln

- Vor dem Push: Seite lokal rendern (python3 -m http.server) und mobil prüfen.
- Keine externen Skripte, Fonts oder Tracker einbinden (Datenschutzerklärung
  verspricht das).
- Commits auf Deutsch, kurz, mit Co-Authored-By-Zeile.
- Der Server wird nicht aus Claude-Sitzungen heraus angefasst; Deploy macht René
  per SSH mit `git pull`.
