const db = require('../config/db');
const notify = require('../utils/notify');
const { signAssetUrls } = require('../utils/objectStorage');

exports.send = async (req, res) => {
  const from = req.user.id, to = Number(req.params.userId);
  if (!to || from === to) return res.status(400).json({ message: 'Invalid user' });
  const [target] = await db.execute('SELECT id,role FROM users WHERE id=? AND is_active=1', [to]);
  if (!target.length) return res.status(404).json({ message: 'User not found' });
  const [blocked] = await db.execute(
    `SELECT 1 FROM user_blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)`,
    [from,to,to,from]
  );
  if (blocked.length) return res.status(403).json({ message: 'Connection is unavailable' });
  const [existing] = await db.execute(
    `SELECT * FROM connections WHERE (requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)`,
    [from,to,to,from]
  );
  if (existing.length) {
    const c = existing[0];
    if (c.status === 'REJECTED') {
      await db.execute("UPDATE connections SET requester_id=?, receiver_id=?, status='PENDING' WHERE id=?", [from, to, c.id]);
      await notify(to, 'Connection request', 'You received a connection request.', 'CONNECTION', c.id);
      return res.status(201).json({ message: 'Request sent' });
    }
    if (c.status === 'PENDING' && Number(c.receiver_id) === Number(from)) {
      return res.status(409).json({ message: 'This person has already sent you a request. Accept it from Received requests.' });
    }
    return res.status(409).json({ message: c.status === 'ACCEPTED' ? 'Already connected' : 'A request already exists' });
  }
  const [r] = await db.execute('INSERT INTO connections (requester_id,receiver_id) VALUES (?,?)', [from,to]);
  await notify(to, 'Connection request', 'You received a connection request.', 'CONNECTION', r.insertId);
  res.status(201).json({ message: 'Connection request sent' });
};

exports.sentRequests = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.id request_id,u.id user_id,u.name,u.role,u.profile_image,u.bio,c.created_at
     FROM connections c JOIN users u ON u.id=c.receiver_id
     WHERE c.requester_id=? AND c.status='PENDING' ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.requests = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.id request_id,u.id user_id,u.name,u.role,u.profile_image,u.bio,c.created_at
     FROM connections c JOIN users u ON u.id=c.requester_id
     WHERE c.receiver_id=? AND c.status='PENDING' ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.respond = async (req, res) => {
  const status = req.body.status;
  if (!['ACCEPTED','REJECTED'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  const conn = await db.getConnection();
  let requesterId;
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT id,requester_id,receiver_id FROM connections
       WHERE id=? AND receiver_id=? AND status='PENDING' FOR UPDATE`,
      [req.params.id,req.user.id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Request not found' });
    }
    requesterId = rows[0].requester_id;
    await conn.execute('UPDATE connections SET status=? WHERE id=?', [status,req.params.id]);
    if (status === 'ACCEPTED') {
      const [existing] = await conn.execute(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants a ON a.conversation_id=c.id AND a.user_id=?
         JOIN conversation_participants b ON b.conversation_id=c.id AND b.user_id=?
         WHERE c.conversation_type='CONNECTION' LIMIT 1`,
        [requesterId,req.user.id]
      );
      if (!existing.length) {
        const [conv] = await conn.execute("INSERT INTO conversations (conversation_type,reference_id) VALUES ('CONNECTION',?)", [rows[0].id]);
        await conn.execute(
          'INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?),(?,?)',
          [conv.insertId,requesterId,conv.insertId,req.user.id]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
  if (status === 'ACCEPTED') await notify(requesterId, 'Connection accepted', 'Your connection request was accepted. You can now message this person.', 'CONNECTION', Number(req.params.id));
  res.json({ message: `Request ${status.toLowerCase()}` });
};

exports.connections = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.id,u.name,u.role,u.profile_image,u.bio,u.location
     FROM connections c JOIN users u ON u.id=IF(c.requester_id=?,c.receiver_id,c.requester_id)
     WHERE (c.requester_id=? OR c.receiver_id=?) AND c.status='ACCEPTED'
     ORDER BY u.name`,
    [req.user.id,req.user.id,req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.status = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT id,requester_id,receiver_id,status FROM connections
     WHERE (requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)`,
    [req.user.id,req.params.userId,req.params.userId,req.user.id]
  );
  res.json(rows[0] || { status: 'NONE' });
};
