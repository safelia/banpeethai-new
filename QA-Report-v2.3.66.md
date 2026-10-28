# QA Report — BanPeeThai v2.3.66

## Scope
This report covers the exact ZIP source tree, static validation, and deterministic layout calculations. It does not claim browser end-to-end testing.

## Results
- ZIP archive integrity: PASS (will be rechecked after packaging).
- `node --check public/app.js`: PASS.
- `node --check server.js`: PASS.
- `package.json` version: `2.3.66`.
- `public/cards.json`: parses successfully; 27 card entries.
- Card IDs: checked for duplicates.
- Player avatar assets: 9 files present.
- Desktop CSS: explicit anchors for seats 1–5 are present in v2.3.66 desktop-landscape rule.
- Mobile CSS: portrait/mobile seat rules were not changed by this patch.
- Mobile hand calculation: tested 240 combinations (frame widths 180, 220, 280, 320, 375, 430, 600, 900 px; hand sizes 1–30). Occupied card width did not exceed available frame width in any case.
- ZIP file count: checked after packaging; must remain below 100.

## Changes
1. Desktop seat anchors retargeted from the latest screenshot: seat 1 27.5%/52.5%, seat 2 27.5%/37%, seat 3 53.8%/27%, seat 4 78%/37%, seat 5 82%/52.5%.
2. Desktop scene and player-ring positioning are explicitly tied to the same scene plane with no independent zoom/transform.
3. Mobile hand width is measured from `.hand-content-layout` and its padding is accounted for. Cards overlap progressively and shrink on narrow frames to avoid exceeding the panel.

## Not tested / limitations
- No live browser interaction or screenshot comparison was available in this run.
- Pixel-perfect alignment of player badges to the illustrated chair cushions is not certified; the CSS anchors are based on the supplied screenshot and need a real-browser visual confirmation.
- Real multiplayer play, complete gameplay, audio timing, and browser zoom at 100%, 125%, and 150% were not exercised.
- This ZIP does not automatically deploy to the hosted website; it must be uploaded/deployed separately.
