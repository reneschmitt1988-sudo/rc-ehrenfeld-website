# CMS – Website des RC Ehrenfeld 1976 e.V.

Node.js + Express + SQLite. Rendert die komplette Website und bietet unter
`/admin` einen passwortgeschützten Verwaltungsbereich.

## Was gepflegt werden kann

| Bereich | Admin-Seite |
|---|---|
| Beiträge (Vorbericht, Kampfbericht, Verein) mit Foto, Entwurf/Veröffentlicht | /admin/news |
| Kämpfe mit Einzelkämpfen und weiteren Ergebnissen, Saison und Stand | /admin/kaempfe |
| Ligatabelle | /admin/tabelle |
| Trainingsgruppen und Zeiten | /admin/training |
| Trainerteam | /admin/trainer |
| Sponsoren mit Logo und Link | /admin/sponsoren |
| Vorstand | /admin/vorstand |
| Texte, Kontakt, Startfoto, Impressumsangaben | /admin/einstellungen |
| Benutzer | /admin/benutzer |

Öffentliche Seiten: `/`, `/aktuelles`, `/aktuelles/<slug>`, `/impressum`,
`/datenschutz`, `/sitemap.xml`, `/robots.txt`.

## Lokal starten

```bash
cd cms
npm install
export SESSION_SECRET=$(openssl rand -hex 32)
npm run create-admin -- "Dein Name" du@rc-ehrenfeld.de einSicheresPasswort
npm start
# http://127.0.0.1:3004  und  http://127.0.0.1:3004/admin
```

Datenbank und Uploads landen in `cms/data/` (nicht im Git).

## Auf dem Server einrichten (einmalig)

Voraussetzung: Node.js 18 oder neuer (`node -v`). Falls nicht vorhanden:
`curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs`.
sharp und better-sqlite3 bringen fertige Binärdateien mit, es braucht keinen Compiler.

```bash
cd /var/www/rc-ehrenfeld && git pull
cd cms && npm ci --omit=dev
mkdir -p data/uploads && chown -R www-data:www-data /var/www/rc-ehrenfeld/cms

# Geheimnis für die Sitzungs-Cookies
echo "SESSION_SECRET=$(openssl rand -hex 32)" > /etc/rc-ehrenfeld-cms.env
chmod 600 /etc/rc-ehrenfeld-cms.env

# Ersten Admin anlegen (als www-data, damit die Datenbank die richtigen Rechte hat)
sudo -u www-data env DATA_DIR=/var/www/rc-ehrenfeld/cms/data npm run create-admin -- "Robin Pelzer" info@rc-ehrenfeld.de EinLangesPasswort

# Dienst
cp ../deploy/rc-ehrenfeld-cms.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now rc-ehrenfeld-cms
systemctl status rc-ehrenfeld-cms --no-pager

# nginx auf das CMS umstellen
cp ../deploy/nginx-rc-ehrenfeld-cms.conf /etc/nginx/sites-available/rc-ehrenfeld.de
nginx -t && systemctl reload nginx
curl -s -H "Host: www.rc-ehrenfeld.de" http://127.0.0.1/ | grep -o "<title>.*</title>"
```

Wenn Certbot schon lief, steht der HTTPS-Block in der alten Datei. Dann entweder
`certbot --nginx -d rc-ehrenfeld.de -d www.rc-ehrenfeld.de --redirect` erneut
ausführen (ergänzt den Block wieder) oder die `ssl_*`-Zeilen von Hand übernehmen.

## Updates einspielen

```bash
cd /var/www/rc-ehrenfeld && git pull
cd cms && npm ci --omit=dev
systemctl restart rc-ehrenfeld-cms
```

Die Datenbank bleibt erhalten; neue Tabellen legt die App beim Start selbst an.

## Backup

Zwei Dinge sichern: `cms/data/cms.sqlite` und `cms/data/uploads/`.
Beispiel als Cronjob, täglich 3 Uhr, 30 Tage aufbewahren:

```
0 3 * * * tar czf /var/backups/rc-ehrenfeld-$(date +\%F).tgz -C /var/www/rc-ehrenfeld/cms data && find /var/backups -name 'rc-ehrenfeld-*.tgz' -mtime +30 -delete
```

## Sicherheit

- Passwörter mit bcrypt, Sitzungen als signierte Cookies (12 h), CSRF-Schutz,
  Login-Bremse (10 Fehlversuche je IP in 15 Minuten).
- Uploads werden mit sharp neu kodiert (keine fremden Dateien auf dem Server),
  max. 12 MB, Bilder auf 1600 px verkleinert.
- Die App lauscht nur auf 127.0.0.1, nginx steht davor.
- Alle Benutzer haben volle Rechte: nur Vorstand und aktive Pfleger anlegen.
