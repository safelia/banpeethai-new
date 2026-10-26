# บ้านผีไทย — Thai Spirit Card Game v2.0.0

โปรเจกต์นี้เริ่มระบบหน้าเว็บใหม่ โดยเก็บระบบกติกา ไพ่ และการเล่นออนไลน์เดิมไว้ แล้วสร้าง CSS/layout ใหม่แบบสะอาดเพื่อตัดกฎ CSS เก่าที่ซ้อนทับกันหลายชั้น

## โครงสร้าง
- `server.js` — Express + Socket.IO server และกติกาเกมออนไลน์
- `package.json` — dependencies และคำสั่งเริ่มระบบ
- `public/index.html` — หน้าเว็บและองค์ประกอบที่ระบบเกมใช้งาน
- `public/style.css` — stylesheet ใหม่ (ไม่มี CSS patch history เดิม)
- `public/app.js` — ระบบเกมฝั่งผู้เล่นเดิม เพื่อคงกติกา/การเล่นกับบอท/ออนไลน์
- `public/cards.json` และ `public/assets/` — ข้อมูลไพ่และภาพต้นฉบับ

## รันในเครื่อง
ต้องใช้ Node.js 18 ขึ้นไป
```bash
npm install
npm start
```
จากนั้นเปิด `http://localhost:3000`

## Deploy บน Render
สร้าง Web Service ใหม่ เชื่อม repository นี้ โดยให้ Root Directory ว่าง (ไฟล์ `package.json` อยู่ที่ราก), Build Command `npm install`, Start Command `npm start`, Health Check Path `/health`.

**คำแนะนำ:** ทดสอบ Web Service ใหม่ให้ครบก่อนลบ Service เดิม เพราะการลบ Service เดิมทำให้ URL เดิมหยุดทำงาน และการลบ repository อาจทำให้โค้ดกู้คืนยากขึ้น


## v2.1.0 — Reference-scene interface

- Uses `public/assets/game-layout-reference.png`, the supplied 1672×941 reference scene.
- Fixed 16:9 gameplay stage, no page scrolling while the game is open.
- Transparent hit areas for menu, draw, end turn, escape, exit room and sound toggle.
- Hand cards are dynamically sized to fit the hand panel without negative margins or horizontal overflow.
- Online players can always leave the room; surrender is requested only when allowed by the game rules.

Deploy commands: Build `npm install`; Start `npm start`; Health check `/health`.


## v2.1.1 click-target fix
- Added a direct-child transparent hotspot layer aligned to the reference artwork.
- Hotspots forward to the existing game actions for menu, sound, leave room, draw, escape, and end turn.
- Cache-busted CSS and JS URLs to reduce stale asset loading.


## v2.1.2 interaction and hand layout fix
- Invisible hitboxes now call the underlying game actions directly rather than forwarding clicks through another button.
- Hitboxes are aligned to the centered 16:9 viewport stage and elevated above the game scene.
- Hand cards are constrained to the bottom artwork panel with wrapped text and horizontal scrolling when needed.
- Card reveal dialog is centered instead of clipping against the left edge.
- CSS and JS cache version bumped to v2.1.2.


## v2.1.3 hand/discard layout fix
- Forces hand cards to render visibly inside the lower panel and allows horizontal scrolling without clipping card content.
- Makes the discard/last-drawn card preview visible in the dashed left-side table slot.
- Centers the reveal card dialog in the viewport and cache-busts CSS/JS to v2.1.3.


## v2.1.4 hand panel viewport-position fix
- Positions the hand panel directly in viewport coordinates using the centered 16:9 stage math, avoiding conflicting nested parent positioning.
- Forces cards to render visibly within the bottom hand frame and preserves readable card text.
- Bumps CSS/JS cache versions to v2.1.4.


## v2.1.5 Thai circular player markers
- Replaces square player avatars with circular Thai-inspired gold ornamental markers, including a lotus-like flower accent and a highlighted active-turn ring.
- Bumps CSS/JS cache versions to v2.1.5.


## v2.1.6 end-turn, Thai player tokens, stacked hand
- Enlarges and repositions the invisible end-turn hotspot over the visible button and keeps the game phase validation.
- Replaces rectangular player plates with round Thai-inspired gold tokens around the seats.
- Overlaps hand cards, removes horizontal scrolling, and clips the cards to the hand frame.
- Bumps CSS/JS cache versions to v2.1.6.


## v2.1.7 Thai UI and edge decoration
- Moves player badges onto the five chair locations.
- Reworks hand layout using a measured overlap width and hard clipping at the hand panel.
- Adds a Thai-inspired sound settings panel to the top-left menu, with a music on/off switch.
- Adds the provided gold lotus ornament to the empty left/right screen gutters.
- Adds cache-busting version 2.1.7 for CSS and JavaScript.


## v2.2.2 gameplay fixes
- Active player gets a bright gold pulse and a clear turn marker.
- Holy water automatically restores one heart when drawn while below 3 hearts, and adds a heart card to the hand.
- Holy water can be used as a one-use ward when hearts are already full.
- Fixed Lantern so the extra card is not duplicated into the discard pile.
- Fixed Skip Draw so it can only be used before drawing.
- Extended the protection-card pool to include Holy Water and aligned card descriptions with implemented effects.
- Added subtle Thai-inspired gold edge ornaments.

Syntax checked with Node.js; full live multiplayer gameplay still requires deployment testing.


## v2.2.3 — Card readability and haunted side background
- Increased in-hand card typography and improved card preview modal readability.
- Styled omen-choice card buttons so the revealed card art and descriptions are visible.
- Replaced gold side glyph rails with a faded haunted Thai house background.
- Kept player seat anchors and hand panel tied to the game stage across zoom breakpoints.
