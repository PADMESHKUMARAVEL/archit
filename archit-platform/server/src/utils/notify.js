const db = require('../config/db');

async function notify(userId, title, message, type, referenceId = null) {
  const [recipients] = await db.execute('SELECT role FROM users WHERE id=?', [userId]);
  const recipient = recipients[0];
  if (!recipient) throw new Error('Notification recipient not found');
  if (recipient.role === 'CLIENT') {
    const [rows] = await db.execute(
      'SELECT notification_preferences FROM client_profiles WHERE user_id=?',
      [userId]
    );
    const storedPreferences = rows[0]?.notification_preferences;
    if (storedPreferences) {
      const preferences = typeof storedPreferences === 'string'
        ? JSON.parse(storedPreferences)
        : storedPreferences;
      const preferenceKey = type === 'MESSAGE' ? 'messages'
        : ['ENQUIRY', 'PROJECT_PROPOSAL'].includes(type) ? 'enquiries'
          : ['PROJECT_UPDATE', 'PROJECT_STATUS'].includes(type) ? 'projects' : 'activity';
      if (preferences && preferences[preferenceKey] === false) return;
    }
  }
  const [result] = await db.execute(
    `INSERT INTO notifications (user_id,title,message,notification_type,reference_id)
     VALUES (?,?,?,?,?)`,
    [userId, title, message, type, referenceId]
  );
  const io = global.io;
  if (io) io.to(`user:${userId}`).emit('notification:new', {
    id: result.insertId, title, message, notification_type: type, reference_id: referenceId
  });
}
module.exports = notify;
