# QA Report — BanPeeThai v2.3.64

## Summary
- Automated package/code checks: 12/12 passed.
- Archive integrity: passed.
- Real browser end-to-end play: not completed in this environment; do not treat as full release sign-off.

## Changes
1. Recalibrated desktop/landscape chair anchors to match the visible chair cushions in the scene.
2. Kept portrait-mobile seat positions unchanged.
3. Anchored the player ring to the same full-stage coordinate system as the background.
4. Applied stage-relative sizing/transform guards so changing browser zoom scales the game scene as a unit rather than switching desktop seat positions at a width breakpoint.
5. Kept existing player-count seat map: 2 players `[1,5]`, 3 players `[1,2,5]`, 4 players `[1,2,4,5]`, 5 players `[1,2,3,4,5]`.
6. Retained mobile hand-card overlap/clipping and the removal of the left dashed discard-slot frame.

## Desktop / landscape seat anchors
| Seat | Position | Left | Top |
|---|---|---:|---:|
| 1 | Near-left chair | 20.5% | 46% |
| 2 | Far-left chair | 29% | 33% |
| 3 | Head chair | 52% | 15% |
| 4 | Far-right chair | 77% | 33% |
| 5 | Near-right chair | 86% | 46% |

The CSS uses `#playersList` as a full-stage overlay and each player badge uses `translate(-50%, -50%)`, so the supplied coordinates represent badge centers. Portrait mobile has its own rules and was intentionally left unchanged.

## Automated checks performed
- ZIP archive opens and passes `ZipFile.testzip()`.
- Archive has fewer than 100 entries.
- `package.json` version is `2.3.64`.
- `node --check server.js`: passed.
- `node --check public/app.js`: passed.
- `public/cards.json` parses and contains 27 cards with unique IDs.
- Nine player-avatar assets are present.
- Final landscape CSS anchors exist for all five seats.
- Landscape stage and player-ring zoom-lock rules are present.
- Portrait mobile seat rules are still present.
- Existing hand overlap rules are still present.
- Dashed frame removal rule for `#discardTop` is still present.

## Limitations / release gate
A controllable browser was not available for visual end-to-end testing here. These checks confirm package integrity, syntax, assets, and the intended CSS rules; they do **not** prove pixel-perfect chair alignment across every display size, or verify multiplayer/gameplay in a live browser. Browser zoom naturally changes the physical rendered size, but the stage-relative layout is intended to prevent elements from drifting independently of the background. Before considering the build fully QA-approved, visually check 2, 3, 4, and 5 players at 100%, 125%, and 150% zoom after deployment.
