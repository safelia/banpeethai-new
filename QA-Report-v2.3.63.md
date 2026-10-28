# QA Report — BanPeeThai v2.3.63

## Summary
- Automated static/source checks: **15/15 passed**.
- ZIP integrity: **passed**.
- ZIP entry count: **76** (below the 100-file upload limit).
- This is source/file QA only; it is **not** a live browser or end-to-end gameplay certification.

## Automated checks

| Check | Result | Notes |
|---|---|---|
| package.json version is 2.3.63 | PASS | 2.3.63 |
| desktop positions define seats 1–5 | PASS | all 5 selectors |
| desktop position override scoped to min-width 761px | PASS | desktop only |
| mobile seat coordinates unchanged | PASS | existing portrait map retained |
| dashed discard border removed by final override | PASS | final CSS override |
| own turn full red frame glow exists | PASS | frame + ornaments |
| opponent gold glow rule retained | PASS | gold selector remains |
| mobile hand is clipped within panel | PASS | overflow clipped |
| mobile hand card overlap uses JS variable | PASS | stacking behavior |
| seat mapping supports 2–5 players | PASS | 2,3,4,5 players |
| dependencies express/socket.io declared | PASS | package dependencies |
| cards JSON parses | PASS | JSON valid |
| 9 player avatar files present | PASS | 9 assets |
| server.js syntax | PASS | node --check passed |
| app.js syntax | PASS | node --check passed |

## Changes in this build
1. Desktop-only player positions reset to the chair anchors visible in the supplied wide screenshot: left outer, left inner, top chair, right inner, right outer.
2. Portrait/mobile player positions were deliberately left unchanged, because the user said those positions were already correct.
3. Removed the dashed border around the table-side card preview slot.
4. Strengthened the local player's active-turn styling to red around the full medallion and its ornaments; opponent active-turn gold styling is preserved.
5. Mobile hand cards use progressive overlap and are clipped to the hand panel, preventing cards from extending beyond its frame.
6. Updated `package.json` version to `2.3.63`.

## Not tested in this environment
- Live browser rendering and pixel-by-pixel alignment at desktop/mobile viewport sizes.
- Actual multiplayer sessions across two or more clients.
- End-to-end card actions, damage/protection, key collection, win/loss, timers, and sound playback.

## Manual browser QA still required
- Desktop: 1513×568 and 1366×768, with 2, 3, 4, and 5 players; confirm each player medallion center sits on the correct chair cushion.
- Mobile: 390×844 and 430×932; test 1, 3, 6, and 10 hand cards, verify overlap and no clipping outside the frame.
- Switch turns: own player full red glow, active opponent gold glow, other players unchanged.
- Confirm dashed table-side frame is gone and discard preview still displays.
