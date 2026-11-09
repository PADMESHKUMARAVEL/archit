const db = require('../config/db');

async function notify(userId, title, message, type, referenceId = null) {
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
