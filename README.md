# RC Ehrenfeld 1976 e.V. – Website

Statische Website des Ringer Club Ehrenfeld 1976 e.V. (Stufe 1).
Reines HTML/CSS, keine Abhängigkeiten, keine Cookies, Schriften lokal.

## Aufbau

```
index.html            Startseite
impressum.html        Impressum
datenschutz.html      Datenschutzerklärung
robots.txt, sitemap.xml
assets/css/style.css  Gesamtes Stylesheet
assets/js/main.js     Nur das mobile Menü
assets/fonts/         Anton, Barlow, Barlow Condensed (OFL-Lizenz, siehe LICENSE-OFL.txt)
assets/img/           Wappen, Sponsorenlogos, Fotos
deploy/               nginx-Config und logrotate
```

## Lokal ansehen

Ordner entpacken und `index.html` im Browser öffnen. Alles funktioniert ohne Server.

## Auf den Hetzner-Server bringen

Voraussetzung: DNS-A-Einträge für `rc-ehrenfeld.de` und `www.rc-ehrenfeld.de`
zeigen auf `46.225.11.128` (beim Domain-Anbieter des Vereins eintragen,
MX-Einträge für E-Mail unverändert lassen).

### Variante A: Git (empfohlen)

```bash
# einmalig auf dem Server
sudo mkdir -p /var/www
cd /var/www
sudo git clone <REPO-URL> rc-ehrenfeld
sudo chown -R www-data:www-data /var/www/rc-ehrenfeld

# nginx einrichten
sudo cp /var/www/rc-ehrenfeld/deploy/nginx-rc-ehrenfeld.conf /etc/nginx/sites-available/rc-ehrenfeld.de
sudo ln -s /etc/nginx/sites-available/rc-ehrenfeld.de /etc/nginx/sites-enabled/
sudo cp /var/www/rc-ehrenfeld/deploy/logrotate-rc-ehrenfeld /etc/logrotate.d/rc-ehrenfeld
sudo nginx -t && sudo systemctl reload nginx

# HTTPS (sobald DNS zeigt)
sudo certbot --nginx -d rc-ehrenfeld.de -d www.rc-ehrenfeld.de --redirect
```

Spätere Updates:

```bash
cd /var/www/rc-ehrenfeld && sudo git pull
```

### Variante B: Hochladen per SCP

```bash
scp -r rc-ehrenfeld/* user@46.225.11.128:/var/www/rc-ehrenfeld/
```

Danach wie oben nginx und certbot einrichten.

## Nach dem Livegang

1. `https://www.rc-ehrenfeld.de/` im Browser prüfen, auch am Handy.
2. Google Search Console: Domain anlegen, `sitemap.xml` einreichen.
3. Google-Unternehmensprofil für den Verein anlegen (beide Hallen, Trainingszeiten, Link zur Seite).
4. Strukturierte Daten testen: https://search.google.com/test/rich-results
5. Datenschutzerklärung: Hoster-Angaben (Hetzner) sind eingetragen; wenn das Hosting
   später wechselt, Abschnitt 3 anpassen.

## Inhalte pflegen (bis das CMS kommt)

Alle Texte stehen direkt in `index.html`. Suchen nach:

- `[FOTO` – Bildplatzhalter in den News-Karten
- `[LOGO SPONSOR` – freie Sponsorenkacheln
- `[MITGLIEDSBEITRAG` – Hinweis im Abschnitt „Mach mit“
- `Stand:` – Datum bei Kämpfen und Tabelle

Ein neuer Kampf: Abschnitt `<section class="kaempfe-sektion">` und
`<section class="tabelle">` aktualisieren, dazu das `SportsEvent` im
JSON-LD-Block im `<head>`.

## Stufe 2 (geplant)

CMS mit Admin-Bereich für News, Termine, Ergebnisse, Trainingszeiten und Sponsoren.
Automatische Übernahme der Landesliga-Tabelle vom Ringerverband NRW nach Freigabe.
