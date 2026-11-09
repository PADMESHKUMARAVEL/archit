const db = require('../config/db');
const notify = require('../utils/notify');

exports.create = async (req, res) => {
  const architectId = Number(req.params.architectId);
  const { title,description,budget,location } = req.body;
  if (!title?.trim() || !description?.trim()) return res.status(400).json({ message: 'Title and description are required' });
  const [architect] = await db.execute("SELECT id FROM users WHERE id=? AND role='ARCHITECT' AND is_active=1", [architectId]);
  if (!architect.length) return res.status(404).json({ message: 'Architect not found' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [inq] = await conn.execute(
      `INSERT INTO project_inquiries (client_id,architect_id,title,description,budget,location)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id,architectId,title.trim(),description.trim(),budget || null,location || null]
    );
    const [conv] = await conn.execute(
      "INSERT INTO conversations (conversation_type,reference_id) VALUES ('CLIENT_ENQUIRY',?)",
      [inq.insertId]
    );
    await conn.execute(
      'INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?),(?,?)',
      [conv.insertId,req.user.id,conv.insertId,architectId]
    );
    await conn.execute('UPDATE project_inquiries SET conversation_id=? WHERE id=?', [conv.insertId,inq.insertId]);
    await conn.commit();
    await notify(architectId,'New client enquiry','A client sent you a project enquiry.','ENQUIRY',inq.insertId);
    res.status(201).json({ id: inq.insertId, conversationId: conv.insertId, message: 'Enquiry sent' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
};

exports.list = async (req, res) => {
  const isArchitect = req.user.role === 'ARCHITECT';
  const where = isArchitect ? 'i.architect_id=?' : 'i.client_id=?';
  const [rows] = await db.execute(
    `SELECT i.*,u.name other_party_name,u.profile_image other_party_image
     FROM project_inquiries i
     JOIN users u ON u.id=${isArchitect ? 'i.client_id' : 'i.architect_id'}
     WHERE ${where} ORDER BY i.created_at DESC`, [req.user.id]
  );
  res.json(rows);
};
