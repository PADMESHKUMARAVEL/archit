const db = require('../config/db');

exports.list = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT id,title,message,notification_type,reference_id,is_read,created_at
     FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(rows);
};

exports.read = async (req, res) => {
  await db.execute(
    'UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?',
    [req.params.id,req.user.id]
  );
  res.json({ message: 'Notification marked as read' });
};

exports.readAll = async (req, res) => {
  await db.execute('UPDATE notifications SET is_read=TRUE WHERE user_id=?', [req.user.id]);
  res.json({ message: 'All notifications marked as read' });
};
