# บ้านผีไทย — Thai Spirit Card Game v1.4.46

## ปรับปรุงในเวอร์ชันนี้
- ขยายหน้าจอเกมให้เต็มพื้นที่หน้าจอ โดยรักษาสัดส่วนภาพกระดานหลักไว้ ไม่บีบภาพให้ผิดรูป
- เติมพื้นหลังด้านข้างแบบเบลอและมืดเพื่อไม่ให้มีแถบว่าง และให้ภาพกระดานหลักคมชัดอยู่ตรงกลาง
- ปรับกรอบแสดงไพ่ล่าสุดให้ใช้ภาพไพ่เต็มใบพอดีกับกรอบเส้นประสีทอง
- ปรับขนาดการ์ดในมือให้ใหญ่ขึ้น อ่านง่ายขึ้น และซ้อนทับกันเมื่อมีไพ่เกิน 5 ใบ เพื่อใช้พื้นที่ให้คุ้มค่า
- เพิ่ม `package.json` ให้ติดตั้งและเปิดเซิร์ฟเวอร์ได้ตามขั้นตอนปกติ

## วิธีเปิดเล่นในเครื่อง
1. ติดตั้ง Node.js 18 ขึ้นไป
2. แตกไฟล์ ZIP
3. เปิด Terminal/Command Prompt ในโฟลเดอร์ที่แตกไฟล์
4. รัน `npm install`
5. รัน `npm start`
6. เปิด `http://localhost:3000`

เกมออนไลน์กับเพื่อนต้องให้เซิร์ฟเวอร์นี้เข้าถึงได้จากอินเทอร์เน็ต และควร deploy บนโฮสต์ Node.js เช่น Render


## v1.4.46 — Reference scene refresh
- Updated the in-game background to the latest user-provided 1672×941 scene.
- Kept the scene at its original aspect ratio and locked page scrolling during gameplay.
- Repositioned transparent draw, exit, end-turn, and latest-draw card targets to the artwork.
- Added a visible in-game music toggle and made exit-room behavior available regardless of player count.
- Aligned player markers with the five chairs and constrained the hand panel to the reference frame.


## v1.4.47 — Fix gameplay canvas sizing
- Centered the gameplay canvas and locked it to the original artwork aspect ratio.
- Kept the blurred backdrop full-screen and prevented the game scene from shrinking into the upper-left corner.
- Shared one coordinate frame between artwork, player positions, hand panel, and transparent button hit areas.
- Added cache-busting for updated background art and JavaScript.


## v1.4.48 — Root viewport fix
- Fixed the actual root cause: the HTML `#gameScreen` element does not carry the `.game-overlay` class used by previous viewport patches.
- All visible-screen rules now target `#gameScreen:not(.hidden)` directly.
- The blurred backdrop fills the viewport, while the sharp artwork and its transparent controls share one centered 16:9 coordinate canvas.
- Updated CSS/JS cache-busting to `1.4.48`.


## v1.4.49 deployment note

This archive includes the current app under `public/` (for the Node/Express service) and mirrored `index.html`, `style.css`, `app.js`, and `cards.json` at repository root to replace stale root-level web files if the host serves those. The viewport override is appended at the end of both CSS copies and the stylesheet cache key is `v=1.4.49`.
