// ─── N Stock · LINE OA Webhook Server ────────────────────────────────────────
const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
require('dotenv').config();

const app = express();
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, PORT = 3000 } = process.env;

function verifySignature(rawBody, signature) {
  if (!LINE_CHANNEL_SECRET) return false;
  const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(rawBody).digest('base64');
  return hash === signature;
}

async function replyText(replyToken, text) {
  await axios.post('https://api.line.me/v2/bot/message/reply',
    { replyToken, messages: [{ type: 'text', text }] },
    { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

async function pushText(userId, text) {
  await axios.post('https://api.line.me/v2/bot/message/push',
    { to: userId, messages: [{ type: 'text', text }] },
    { headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`, 'Content-Type': 'application/json' } }
  );
}

app.get('/', (_req, res) => res.send('N Stock LINE Bot running'));

app.post('/webhook', async (req, res) => {
  res.json({ status: 'ok' });
  const signature = req.headers['x-line-signature'];
  if (!verifySignature(req.body, signature)) return;
  let parsed;
  try { parsed = JSON.parse(req.body); } catch { return; }
  for (const event of (parsed.events || [])) {
    try { await handleEvent(event); } catch (err) { console.error(err?.response?.data || err.message); }
  }
});

async function handleEvent(event) {
  const userId = event.source?.userId;
  if (event.type === 'follow') {
    await replyText(event.replyToken,
      '👋 ยินดีต้อนรับสู่ Space bar · Stock!\n\nส่ง "UID" เพื่อรับ LINE User ID สำหรับผูกบัญชีครับ');
    return;
  }
  if (event.type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim().toLowerCase();
    if (['uid','user id','userid','ยูไอดี'].includes(text)) {
      await replyText(event.replyToken,
        `🆔 LINE User ID ของคุณ:\n\n${userId}\n\nCopy ไปวางในหน้า "พนักงาน" ของ N Stock ครับ`);
      return;
    }
    if (['help','ช่วย','วิธีใช้','?'].includes(text)) {
      await replyText(event.replyToken,
        '📋 คำสั่ง:\n• UID — ดู LINE User ID\n• HELP — วิธีใช้\n\nN Stock · Space bar 🍸');
      return;
    }
    await replyText(event.replyToken, 'ส่ง "UID" เพื่อรับ LINE User ID ครับ 😊');
  }
}

app.listen(PORT, () => {
  console.log(`🚀 N Stock LINE Bot running on port ${PORT}`);
  if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN)
    console.warn('⚠️  กรุณาตั้งค่า LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN');
});
