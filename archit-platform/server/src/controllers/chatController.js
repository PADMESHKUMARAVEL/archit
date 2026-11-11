const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');

exports.conversations = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.id,c.conversation_type,c.created_at,
       (SELECT m.message FROM messages m WHERE m.conversation_id=c.id AND m.is_deleted=0 ORDER BY m.created_at DESC LIMIT 1) last_message,
       (SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id AND m.is_deleted=0 ORDER BY m.created_at DESC LIMIT 1) last_message_at,
       (SELECT u.id FROM conversation_participants cp2 JOIN users u ON u.id=cp2.user_id
        WHERE cp2.conversation_id=c.id AND cp2.user_id<>? LIMIT 1) other_user_id,
       (SELECT u.name FROM conversation_participants cp2 JOIN users u ON u.id=cp2.user_id
        WHERE cp2.conversation_id=c.id AND cp2.user_id<>? LIMIT 1) other_user_name
     FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id
     WHERE cp.user_id=?
     ORDER BY COALESCE(
       (SELECT m2.created_at FROM messages m2 WHERE m2.conversation_id=c.id AND m2.is_deleted=0 ORDER BY m2.created_at DESC LIMIT 1),
       c.created_at
     ) DESC`,
    [req.user.id,req.user.id,req.user.id]
  );
  res.json(rows);
};

exports.messages = async (req, res) => {
  const [member] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [req.params.conversationId,req.user.id]
  );
  if (!member.length) return res.status(403).json({ message: 'Not a conversation participant' });
  const [rows] = await db.execute(
    `SELECT m.id,m.conversation_id,m.sender_id,m.message,m.attachment_url,m.created_at,u.name sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.is_deleted=0 ORDER BY m.created_at DESC LIMIT 100`,
    [req.params.conversationId]
  );
  res.json(await signAssetUrls(rows.reverse()));
};

exports.send = async (req, res) => {
  const text = String(req.body.message || '').trim();
  if (!text && !req.file) return res.status(400).json({ message: 'Enter a message or select a photo' });
  if (text.length > 5000) return res.status(400).json({ message: 'Message must be at most 5000 characters' });
  const [member] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [req.params.conversationId,req.user.id]
  );
  if (!member.length) return res.status(403).json({ message: 'Not a conversation participant' });
  const [r] = await db.execute(
    'INSERT INTO messages (conversation_id,sender_id,message,attachment_url) VALUES (?,?,?,?)',
    [req.params.conversationId,req.user.id,text || null,req.file ? await upload(req.file, 'chat') : null]
  );
  const [rows] = await db.execute(
    `SELECT m.id,m.conversation_id,m.sender_id,m.message,m.attachment_url,m.created_at,u.name sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`, [r.insertId]
  );
  const msg = await signAssetUrls(rows[0]);
  if (global.io) global.io.to(`conversation:${req.params.conversationId}`).emit('message:new', msg);
  const [participants] = await db.execute(
    'SELECT user_id FROM conversation_participants WHERE conversation_id=? AND user_id<>?',
    [req.params.conversationId,req.user.id]
  );
  for (const participant of participants) {
    await notify(participant.user_id, 'New message', req.file ? 'You received a photo message.' : 'You received a new message.', 'MESSAGE', Number(req.params.conversationId));
  }
  res.status(201).json(msg);
};
