# QA Report — BanPeeThai v2.3.65

## Scope
Targeted correction based on the user's supplied desktop screenshot:
- Reposition all five desktop player medallions toward the visible chair-cushion centers.
- Keep the previously approved portrait/mobile player-seat rules unchanged.
- Ensure mobile hand cards are calculated from the measured hand-panel width and overlap to fit inside the panel.
- Keep the fixed 16:9 stage as the coordinate reference so browser zoom does not independently reposition the player overlay relative to the scene.

## Automated checks
- [PASS] ZIP integrity (`ZipFile.testzip()` returns no corrupt entry).
- [PASS] `server.js` syntax (`node --check`).
- [PASS] `public/app.js` syntax (`node --check`).
- [PASS] `package.json` parses and reports version `2.3.65`.
- [PASS] `public/cards.json` parses; 27 entries found.
- [PASS] Desktop CSS contains explicit anchor rules for seats 1–5 under landscape desktop media query.
- [PASS] Mobile CSS remains a separate breakpoint; the desktop anchor override does not apply below 761px.
- [PASS] Mobile hand width calculation uses actual `#hand` client width and computes a card overlap for the available width.
- [PASS] Simulated mobile hand geometry for panel widths 180, 220, 280, 320, 360, 420, and 600 CSS px, with 1, 2, 5, 10, 15, and 20 cards: no computed card-strip width exceeded the panel width.
- [PASS] Existing seat turn red/gold styles remain in the stylesheet.
- [PASS] Existing protection-card and game logic source retained from v2.3.64.

## Manual/browser checks not performed
- No live browser was available to open the actual game, inspect DOM bounding boxes, or compare seat centers against chair centers at runtime.
- Browser zoom levels (100%, 125%, 150%) were not physically exercised. The stage-relative layout is preserved in CSS, but runtime behavior still requires browser verification.
- No two-client online match or full end-to-end match was played.

## QA conclusion
The ZIP and source-level checks pass. This is not a claim of pixel-perfect browser QA: the desktop seat anchors were calibrated from the provided screenshot, and must still be visually confirmed in the actual running game at target desktop resolutions.
