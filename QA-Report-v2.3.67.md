# QA Report — BanPeeThai v2.3.67

## Scope
Validated the delivered project archive, JavaScript syntax, package version, card data, mobile background asset, and presence of the final desktop/mobile CSS overrides. This is static/file QA; no real browser session or live multiplayer play was performed.

## Results
- ZIP integrity: checked after packaging; no corrupt entries.
- Archive item count: expected below 100.
- `server.js`: `node --check` passed.
- `public/app.js`: `node --check` passed.
- `package.json`: version is `2.3.67`.
- `cards.json`: JSON parses; 27 entries and unique IDs (validated separately during packaging).
- Mobile portrait background: `public/assets/haunted-thai-house-mobile-ui-v2.png` exists and decodes as a 928 × 1664 PNG copied from the user's supplied scene reference.
- CSS override: includes desktop anchors for seats 1–5 and portrait mobile background/hotspot coordinates for menu, leave, draw, escape, and end-round.
- Mobile hand area: CSS keeps hand zone/content clipped to the available frame width.

## Important limitation
CSS coordinates are authored from the reference artwork and the user's screenshot. They have not been verified by clicking through a live browser at multiple viewport sizes or zoom levels. Therefore this report does not claim pixel-perfect browser QA, full gameplay QA, or live deployment. The archive must be deployed to the hosting service before the live site changes.
