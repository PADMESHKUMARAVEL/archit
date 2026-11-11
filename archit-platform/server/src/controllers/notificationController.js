const db = require('../config/db');

exports.list = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT n.id,n.title,
       CASE
         WHEN n.notification_type='ENQUIRY' AND n.title='New client enquiry' AND i.id IS NOT NULL
         THEN CONCAT(
           c.name, ' sent "', i.title, '". ',
           LEFT(i.description, 240),
           IF(CHAR_LENGTH(i.description)>240, '…', '')
         )
         ELSE n.message
       END AS message,
       n.notification_type,n.reference_id,n.is_read,n.created_at
     FROM notifications n
     LEFT JOIN project_inquiries i
       ON n.notification_type='ENQUIRY'
       AND i.id=n.reference_id
       AND (i.architect_id=n.user_id OR i.client_id=n.user_id)
     LEFT JOIN users c ON c.id=i.client_id
     WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 50`,
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
