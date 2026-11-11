const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');
const posts = require('./postController');

async function sharedItem(message, viewerId) {
  const resourceId = Number(message.shared_id);
  if (!resourceId) return null;

  if (message.shared_type === 'PROFILE') {
    const [rows] = await db.execute(
      `SELECT u.id,u.name,u.role,u.profile_image,u.bio,u.location,
         sp.college,sp.degree,sp.specialization,sp.graduation_year,sp.skills,
         ap.firm_name,ap.experience_years,ap.specializations,ap.website,
         EXISTS(SELECT 1 FROM connections c WHERE c.status='ACCEPTED'
           AND ((c.requester_id=u.id AND c.receiver_id=?) OR (c.receiver_id=u.id AND c.requester_id=?))) is_connection
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id=u.id
       LEFT JOIN architect_profiles ap ON ap.user_id=u.id
       WHERE u.id=? AND u.is_active=1`,
      [viewerId, viewerId, resourceId]
    );
    if (!rows.length) return null;
    const profile = rows[0];
    profile.is_connection = Boolean(profile.is_connection);
    if (!profile.is_connection) {
      for (const field of [
        'college','degree','specialization','graduation_year','skills',
        'firm_name','experience_years','specializations','website'
      ]) delete profile[field];
    }
    return { type: 'PROFILE', profile: await signAssetUrls(profile) };
  }

  if (message.shared_type === 'POST' && await posts.canViewPost(resourceId, viewerId)) {
    const [rows] = await db.execute(
      `SELECT p.id,p.user_id,p.content,p.visibility,p.created_at,u.name,u.role,u.profile_image,
         (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes_count,
         EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked_by_me
       FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`,
      [viewerId, resourceId]
    );
    if (!rows.length) return null;
    const [media] = await db.execute(
      'SELECT id,post_id,media_url,media_type FROM post_media WHERE post_id=?',
      [resourceId]
    );
    return {
      type: 'POST',
      post: await signAssetUrls({ ...rows[0], media })
    };
  }
  return null;
}

async function addSharedItems(rows, viewerId) {
  return Promise.all(rows.map(async message => ({
    ...message,
    shared_item: message.shared_type
      ? await sharedItem(message, viewerId)
      : null
  })));
}

async function validateShare(senderId, conversationId, type, resourceId) {
  const [participants] = await db.execute(
    `SELECT c.conversation_type,cp.user_id FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id=c.id
     WHERE c.id=?`,
    [conversationId]
  );
  const recipient = participants.find(participant => Number(participant.user_id) !== Number(senderId));
  if (participants.length !== 2 || !recipient || participants.some(p => Number(p.user_id) === Number(senderId) && p.conversation_type !== 'CONNECTION')) {
    return { error: 'Sharing is available only in a connection chat' };
  }
  const [connection] = await db.execute(
    `SELECT 1 FROM connections WHERE status='ACCEPTED'
     AND ((requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?))`,
    [senderId, recipient.user_id, recipient.user_id, senderId]
  );
  const [blocked] = await db.execute(
    `SELECT 1 FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)`,
    [senderId, recipient.user_id, recipient.user_id, senderId]
  );
  if (!connection.length || blocked.length) return { error: 'Sharing is available only with an active connection' };

  if (type === 'PROFILE') {
    const [profile] = await db.execute(
      'SELECT id FROM users WHERE id=? AND is_active=1',
      [resourceId]
    );
    if (!profile.length) return { error: 'Profile not found' };
  } else if (type === 'POST') {
    if (!await posts.canViewPost(resourceId, senderId)) return { error: 'Post not found' };
  } else {
    return { error: 'Invalid share type' };
  }
  return {};
}

exports.conversations = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.id,c.conversation_type,c.created_at,
       (SELECT COALESCE(m.message,CASE m.shared_type WHEN 'PROFILE' THEN 'Shared a profile' WHEN 'POST' THEN 'Shared a post' END)
        FROM messages m WHERE m.conversation_id=c.id AND m.is_deleted=0
         AND NOT EXISTS(SELECT 1 FROM message_hidden_for mh WHERE mh.message_id=m.id AND mh.user_id=?)
         ORDER BY m.created_at DESC LIMIT 1) last_message,
       (SELECT m.created_at FROM messages m WHERE m.conversation_id=c.id AND m.is_deleted=0
         AND NOT EXISTS(SELECT 1 FROM message_hidden_for mh WHERE mh.message_id=m.id AND mh.user_id=?)
         ORDER BY m.created_at DESC LIMIT 1) last_message_at,
       (SELECT u.id FROM conversation_participants cp2 JOIN users u ON u.id=cp2.user_id
        WHERE cp2.conversation_id=c.id AND cp2.user_id<>? LIMIT 1) other_user_id,
       (SELECT u.name FROM conversation_participants cp2 JOIN users u ON u.id=cp2.user_id
        WHERE cp2.conversation_id=c.id AND cp2.user_id<>? LIMIT 1) other_user_name
       ,cp.last_read_at,
       (SELECT COUNT(*) FROM messages unread
        WHERE unread.conversation_id=c.id AND unread.sender_id<>? AND unread.is_deleted=0
          AND (cp.last_read_at IS NULL OR unread.created_at>cp.last_read_at)
          AND NOT EXISTS(SELECT 1 FROM message_hidden_for hidden WHERE hidden.message_id=unread.id AND hidden.user_id=?)
       ) unread_count
     FROM conversations c JOIN conversation_participants cp ON cp.conversation_id=c.id
     WHERE cp.user_id=?
     ORDER BY COALESCE(
       (SELECT m2.created_at FROM messages m2 WHERE m2.conversation_id=c.id AND m2.is_deleted=0
         AND NOT EXISTS(SELECT 1 FROM message_hidden_for mh WHERE mh.message_id=m2.id AND mh.user_id=?)
         ORDER BY m2.created_at DESC LIMIT 1),
       c.created_at
     ) DESC`,
    [req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id,req.user.id]
  );
  res.json(rows);
};

exports.messages = async (req, res) => {
  const [member] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [req.params.conversationId,req.user.id]
  );
  if (!member.length) return res.status(403).json({ message: 'Not a conversation participant' });
  await db.execute(
    'UPDATE conversation_participants SET last_read_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND user_id=?',
    [req.params.conversationId, req.user.id]
  );
  const [rows] = await db.execute(
    `SELECT m.id,m.conversation_id,m.sender_id,m.message,m.attachment_url,m.shared_type,m.shared_id,m.created_at,u.name sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id
     WHERE m.conversation_id=? AND m.is_deleted=0
       AND NOT EXISTS(SELECT 1 FROM message_hidden_for mh WHERE mh.message_id=m.id AND mh.user_id=?)
     ORDER BY m.created_at DESC LIMIT 100`,
    [req.params.conversationId,req.user.id]
  );
  res.json(await addSharedItems(await signAssetUrls(rows.reverse()), req.user.id));
};

exports.deleteMessage = async (req, res) => {
  const conversationId = Number(req.params.conversationId);
  const messageId = Number(req.params.messageId);
  const scope = req.query.for;
  if (!Number.isSafeInteger(conversationId) || conversationId < 1 ||
      !Number.isSafeInteger(messageId) || messageId < 1 ||
      !['me','everyone'].includes(scope)) {
    return res.status(400).json({ message: 'Invalid message deletion request' });
  }

  const [members] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [conversationId,req.user.id]
  );
  if (!members.length) return res.status(403).json({ message: 'Not a conversation participant' });

  const [messages] = await db.execute(
    'SELECT id,sender_id FROM messages WHERE id=? AND conversation_id=? AND is_deleted=0',
    [messageId,conversationId]
  );
  if (!messages.length) return res.status(404).json({ message: 'Message not found' });

  if (scope === 'everyone') {
    if (Number(messages[0].sender_id) !== Number(req.user.id)) {
      return res.status(403).json({ message: 'Only the sender can delete a message for everyone' });
    }
    await db.execute(
      'UPDATE messages SET is_deleted=1 WHERE id=? AND conversation_id=? AND sender_id=?',
      [messageId,conversationId,req.user.id]
    );
    if (global.io) {
      global.io.to(`conversation:${conversationId}`).emit('message:deleted', { conversationId, messageId });
    }
  } else {
    await db.execute(
      'INSERT IGNORE INTO message_hidden_for (message_id,user_id) VALUES (?,?)',
      [messageId,req.user.id]
    );
  }

  res.json({ message: 'Message deleted', scope });
};

exports.clearConversation = async (req, res) => {
  const conversationId = Number(req.params.conversationId);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    return res.status(400).json({ message: 'Invalid conversation' });
  }
  const [members] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [conversationId,req.user.id]
  );
  if (!members.length) return res.status(403).json({ message: 'Not a conversation participant' });

  await db.execute(
    `INSERT IGNORE INTO message_hidden_for (message_id,user_id)
     SELECT id,? FROM messages WHERE conversation_id=? AND is_deleted=0`,
    [req.user.id,conversationId]
  );
  res.json({ message: 'Conversation cleared for you' });
};

exports.send = async (req, res) => {
  const text = String(req.body.message || '').trim();
  const shareType = req.body.shareType ? String(req.body.shareType).toUpperCase() : null;
  const shareId = req.body.shareId ? Number(req.body.shareId) : null;
  if ((!text && !req.file && !shareType) || (shareType && !['PROFILE','POST'].includes(shareType)) ||
      (shareType && (!Number.isSafeInteger(shareId) || shareId < 1)) ||
      (!shareType && req.body.shareId)) {
    return res.status(400).json({ message: 'Enter a message, select a photo, or choose a valid profile or post to share' });
  }
  if (text.length > 5000) return res.status(400).json({ message: 'Message must be at most 5000 characters' });
  const [member] = await db.execute(
    'SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?',
    [req.params.conversationId,req.user.id]
  );
  if (!member.length) return res.status(403).json({ message: 'Not a conversation participant' });
  if (shareType) {
    const validation = await validateShare(req.user.id, Number(req.params.conversationId), shareType, shareId);
    if (validation.error) return res.status(403).json({ message: validation.error });
  }
  const [r] = await db.execute(
    'INSERT INTO messages (conversation_id,sender_id,message,attachment_url,shared_type,shared_id) VALUES (?,?,?,?,?,?)',
    [req.params.conversationId,req.user.id,text || null,req.file ? await upload(req.file, 'chat') : null,shareType,shareId]
  );
  const [rows] = await db.execute(
    `SELECT m.id,m.conversation_id,m.sender_id,m.message,m.attachment_url,m.shared_type,m.shared_id,m.created_at,u.name sender_name
     FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.id=?`, [r.insertId]
  );
  const socketMessage = (await signAssetUrls(rows[0]));
  const msg = (await addSharedItems([socketMessage], req.user.id))[0];
  if (global.io) global.io.to(`conversation:${req.params.conversationId}`).emit('message:new', socketMessage);
  const [participants] = await db.execute(
    'SELECT user_id FROM conversation_participants WHERE conversation_id=? AND user_id<>?',
    [req.params.conversationId,req.user.id]
  );
  for (const participant of participants) {
    const preview = shareType === 'PROFILE' ? 'You received a shared profile.'
      : shareType === 'POST' ? 'You received a shared post.'
      : req.file ? 'You received a photo message.' : 'You received a new message.';
    await notify(participant.user_id, 'New message', preview, 'MESSAGE', Number(req.params.conversationId));
  }
  res.status(201).json(msg);
};
