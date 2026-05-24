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
    const events = parsed.events || [];
    for (const event of events) {
          try { await handleEvent(event); } catch (err) { console.error('[event error]', err?.response?.data || err.message); }
    }
});

async function handleEvent(event) {
    const userId = event.source?.userId;

  if (event.type === 'follow') {
        await replyText(event.replyToken,
                              '👋 ยินดีต้อนรับสู่ Space bar · Stock!\n\n' +
                              'ส่งข้อความว่า "UID" เพื่อรับ LINE User ID\n' +
                              'สำหรับผูกบัญชีกับระบบนับสต็อคครับ'
                            );
        return;
  }

  if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text.trim().toLowerCase();

      if (['uid', 'user id', 'userid', 'ยูไอดี'].includes(text)) {
              await replyText(event.replyToken,
                                      `🆔 LINE User ID ของคุณ:\n\n${userId}\n\nCopy ข้อความด้านบนแล้วนำไปวางในหน้า "พนักงาน" ของระบบ N Stock ครับ`
                                    );
              return;
      }

      if (['groupid', 'group id', 'กลุ่ม', '/groupid'].includes(text)) {
              const groupId = event.source?.groupId;
              if (groupId) {
                        await replyText(event.replyToken,
                                                  `🏷️ LINE Group ID ของกลุ่มนี้:\n\n${groupId}\n\nCopy ข้อความด้านบนแล้วนำไปวางในระบบ N Stock ครับ`
                                                );
              } else {
                        await replyText(event.replyToken,
                                                  '⚠️ คำสั่งนี้ใช้ได้เฉพาะในกลุ่มเท่านั้นครับ\nกรุณาพิมพ์ "groupid" ในกลุ่มที่ต้องการ'
                                                );
              }
              return;
      }

      if (['help', 'ช่วย', 'วิธีใช้', '?'].includes(text)) {
              await replyText(event.replyToken,
                                      '📋 คำสั่งที่ใช้ได้:\n\n' +
                                      '• UID — ดู LINE User ID ของคุณ\n' +
                                      '• GROUPID — ดู Group ID ของกลุ่มนี้\n' +
                                      '• HELP — แสดงวิธีใช้\n\n' +
                                      'ระบบ N Stock · Space bar 🍸'
                                    );
              return;
      }

      await replyText(event.replyToken,
                            'ส่ง "UID" เพื่อรับ LINE User ID สำหรับผูกกับระบบนับสต็อคครับ 😊'
                          );
  }
}

app.listen(PORT, () => {
    console.log(`🚀 N Stock LINE Bot running on port ${PORT}`);
    if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) {
          console.warn('⚠️  LINE_CHANNEL_SECRET หรือ LINE_CHANNEL_ACCESS_TOKEN ยังไม่ได้ตั้งค่า');
    }
});
