// ─── N Stock · LINE OA Webhook Server ──────────────────────────────────────────
// Node.js + Express — deploy ได้เลยบน Render / Railway (free tier)
//
// คำสั่งรันในเครื่อง:
//   npm install
//   cp .env.example .env   (แล้วใส่ค่า)
//   node server.js

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
require('dotenv').config();

const app = express();

// ── ดึง raw body ก่อน parse JSON (จำเป็นสำหรับ verify signature) ─────────
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── ENV VARS ──────────────────────────────────────────────────────
const {
  LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  PORT = 3000,
} = process.env;

// ── ตรวจ signature จาก LINE ──────────────────────────────────────
function verifySignature(rawBody, signature) {
  if (!LINE_CHANNEL_SECRET) return false;
  const hash = crypto
    .createHmac('sha256', LINE_CHANNEL_SECRET)
    .update(rawBody)
    .digest('base64');
  return hash === signature;
}

// ── ส่ง reply กลับไปใน LINE ────────────────────────────────────
async function replyText(replyToken, text) {
  await axios.post(
    'https://api.line.me/v2/bot/message/reply',
    { replyToken, messages: [{ type: 'text', text }] },
    {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ── ส่ง push message (ไม่ต้องมี replyToken) ──────────────────────────────────
async function pushText(userId, text) {
  await axios.post(
    'https://api.line.me/v2/bot/message/push',
    { to: userId, messages: [{ type: 'text', text }] },
    {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

// ── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.send('N Stock LINE Bot ✅ running'));

// ── Webhook endpoint ────────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  // LINE ต้องการ 200 เร็ว — ตอบก่อน แล้วค่อย process
  res.json({ status: 'ok' });

  // Verify signature
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.body, signature)) {
    console.warn('[webhook] invalid signature — ข้ามไป');
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(req.body);
  } catch {
    return;
  }

  const events = parsed.events || [];

  for (const event of events) {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error('[event error]', err?.response?.data || err.message);
    }
  }
});

// ── จัดการแต่ละ event ─────────────────────────────────────────────────
async function handleEvent(event) {
  const userId = event.source?.userId;

  // ─ follow: เพิ่มเพื่อน ───────────────────────────────────────────────────────────────────
  if (event.type === 'follow') {
    await replyText(
      event.replyToken,
      '👋 ยินดีต้อนรับสู่ Space bar · Stock!\n\n' +
      'ส่งข้อความว่า "UID" เพื่อรับ LINE User ID\n' +
      'สำหรับผูกบัญชีกับระบบนับสต็อคครับ'
    );
    return;
  }

  // ─ message ──────────────────────────────────────────────────────────────────────────────
  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim().toLowerCase();

    // ── คำสั่ง: UID ──────────────────────────────────────────────────────────────────────────
    if (['uid', 'user id', 'userid', 'ยูไอดี'].includes(text)) {
      await replyText(
        event.replyToken,
        `🆔 LINE User ID ของคุณ:\n\n${userId}\n\n` +
        `Copy ข้อความด้านบนแล้วนำไปวางในหน้า "พนักงาน" ของระบบ N Stock ครับ`
      );
      return;
    }

    // ── คำสั่ง: GROUPID ──────────────────────────────────────────────────────────────────────
    if (['groupid', 'group id', 'กลุ่ม', '/groupid'].includes(text)) {
      const groupId = event.source?.groupId;
      if (groupId) {
        await replyText(
          event.replyToken,
          `🏷️ LINE Group ID ของกลุ่มนี้:\n\n${groupId}\n\n` +
          `Copy ข้อความด้านบนแล้วนำไปวางในระบบ N Stock ครับ`
        );
      } else {
        await replyText(
          event.replyToken,
          '⚠️ คำสั่งนี้ใช้ได้เฉพาะในกลุ่มเท่านั้นครับ\nกรุณาพิมพ์ "groupid" ในกลุ่มที่ต้องการ'
        );
      }
      return;
    }

    // ── คำสั่ง: help ─────────────────────────────────────────────────────────────────────────
    if (['help', 'ช่วย', 'วิธีใช้', '?'].includes(text)) {
      await replyText(
        event.replyToken,
        '📋 คำสั่งที่ใช้ได้:\n\n' +
        '• UID — ดู LINE User ID ของคุณ\n' +
        '• GROUPID — ดู Group ID ของกลุ่มนี้\n' +
        '• HELP — แสดงวิธีใช้\n\n' +
        'ระบบ N Stock · Space bar 🍸'
      );
      return;
    }

    // ── default: ไม่ตอบข้อความทั่วไป (กันสแปมในกลุ่ม) ─────────────────────
    // บอตตอบเฉพาะคำสั่งที่รู้จักเท่านั้น
  }
}

// ── Start ────────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 N Stock LINE Bot running on port ${PORT}`);
  if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn('⚠️  LINE_CHANNEL_SECRET หรือ LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
  }
});
