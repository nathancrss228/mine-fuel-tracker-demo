MINE FUEL TRACKER — VERSION 1.0 PROTOTYPE

Included files
- index.html, style.css, app.js: mobile-first PWA prototype
- data/machines.json: 96 imported machine/asset records
- sw.js: app-shell offline cache
- manifest.webmanifest: installable web app metadata

IMPORTANT PROTOTYPE LIMITATIONS
1. Fuel transactions are stored in IndexedDB on the device. This prototype does not yet synchronise to a central server. The pending count means locally stored entries, not uploaded entries.
2. QR scanning uses the browser BarcodeDetector API where supported. Camera access generally requires HTTPS and permission. The machine dropdown is available as a fallback.
3. Operator and service truck settings are saved locally on this device. They are not shared between phones.
4. The app is a prototype, not approved mine-site software. Test and review security, backup, audit and operational requirements before real deployment.
5. The service worker caches the app and machine list after the first successful online load.

TO RUN / INSTALL
Host this folder on an HTTPS web host. Open the HTTPS address in Android Chrome, allow camera access when scanning, then use Chrome menu > Add to Home screen / Install app. Open once online so the app shell and machine register are cached.

MACHINE REGISTER
Source workbook: Fuel Sheet.xlsx. Imported 96 records. Excluded 14 pump worksheet labels (Start, Finish, Total Dispensed), which are not assets. Blank descriptions are retained and flagged in the companion Excel workbook. Internal QR IDs are sequential permanent identifiers and are matched to the actual asset number in the app.


DEMO BUILD: This package contains dummy demonstration assets only. Do not use it for operational fuel records. The real machine register has been kept separate.
