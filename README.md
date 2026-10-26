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
