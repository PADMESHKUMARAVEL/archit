const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');

async function canViewPost(postId, viewerId) {
  const [rows] = await db.execute(
    `SELECT 1 FROM posts p WHERE p.id=? AND (
       p.visibility='PUBLIC' OR p.user_id=? OR (p.visibility='CONNECTIONS' AND EXISTS(
         SELECT 1 FROM connections c WHERE c.status='ACCEPTED' AND
         ((c.requester_id=p.user_id AND c.receiver_id=?) OR (c.receiver_id=p.user_id AND c.requester_id=?))
       ))
     )`, [postId, viewerId, viewerId, viewerId]
  );
  return rows.length > 0;
}

async function attachMedia(posts) {
  if (!posts.length) return posts;
  const placeholders = posts.map(() => '?').join(',');
  const [media] = await db.execute(
    `SELECT id,post_id,media_url,media_type FROM post_media WHERE post_id IN (${placeholders})`,
    posts.map(post => post.id)
  );
  const mediaByPost = media.reduce((result, item) => {
    (result[item.post_id] ||= []).push(item);
    return result;
  }, {});
  posts.forEach(post => { post.media = mediaByPost[post.id] || []; });
  return signAssetUrls(posts);
}

exports.list = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT p.id,p.user_id,p.content,p.visibility,p.created_at,
       u.name,u.role,u.profile_image,
       (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes_count,
       EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked_by_me
     FROM posts p JOIN users u ON u.id=p.user_id
     WHERE p.visibility='PUBLIC'
       OR p.user_id=?
       OR (p.visibility='CONNECTIONS' AND EXISTS(
          SELECT 1 FROM connections c WHERE c.status='ACCEPTED'
          AND ((c.requester_id=p.user_id AND c.receiver_id=?)
            OR (c.receiver_id=p.user_id AND c.requester_id=?))
       ))
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id,req.user.id,req.user.id,req.user.id]
  );
  res.json(await attachMedia(rows));
};

exports.byUser = async (req, res) => {
  const profileId = Number(req.params.id);
  if (!profileId) return res.status(400).json({ message: 'Invalid user' });
  const [rows] = await db.execute(
    `SELECT p.id,p.user_id,p.content,p.visibility,p.created_at,u.name,u.role,u.profile_image,
       (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes_count,
       EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked_by_me
     FROM posts p JOIN users u ON u.id=p.user_id
     WHERE p.user_id=? AND (p.visibility='PUBLIC' OR p.user_id=? OR
       (p.visibility='CONNECTIONS' AND EXISTS(SELECT 1 FROM connections c WHERE c.status='ACCEPTED' AND
        ((c.requester_id=p.user_id AND c.receiver_id=?) OR (c.receiver_id=p.user_id AND c.requester_id=?)))))
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id, profileId, req.user.id, req.user.id, req.user.id]
  );
  res.json(await attachMedia(rows));
};

exports.getOne = async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({ message: 'Invalid post' });
  }
  if (!await canViewPost(postId, req.user.id)) {
    return res.status(404).json({ message: 'Post not found' });
  }
  const [rows] = await db.execute(
    `SELECT p.id,p.user_id,p.content,p.visibility,p.created_at,u.name,u.role,u.profile_image,
       (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes_count,
       EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) liked_by_me
     FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`,
    [req.user.id, postId]
  );
  if (!rows.length) return res.status(404).json({ message: 'Post not found' });
  res.json((await attachMedia(rows))[0]);
};

exports.create = async (req, res) => {
  const content = String(req.body.content || '').trim();
  const visibility = req.body.visibility === 'CONNECTIONS' ? 'CONNECTIONS' : 'PUBLIC';
  const attachment = req.files?.attachment?.[0] || req.files?.photo?.[0];
  if (!content && !attachment) return res.status(400).json({ message: 'Post content or an attachment is required' });
  if (content.length > 5000) return res.status(400).json({ message: 'Post is too long (maximum 5000 characters)' });
  const [r] = await db.execute('INSERT INTO posts (user_id,content,visibility) VALUES (?,?,?)', [req.user.id,content,visibility]);
  if (attachment) {
    const mediaUrl = await upload(attachment, 'posts');
    const mediaType = attachment.mimetype.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
    await db.execute('INSERT INTO post_media (post_id,media_url,media_type) VALUES (?,?,?)', [r.insertId,mediaUrl,mediaType]);
  }
  const [connections] = await db.execute(
    `SELECT CASE WHEN requester_id=? THEN receiver_id ELSE requester_id END user_id
     FROM connections WHERE (requester_id=? OR receiver_id=?) AND status='ACCEPTED'`,
    [req.user.id,req.user.id,req.user.id]
  );
  for (const connection of connections) {
    await notify(connection.user_id, 'New post from a connection', `${req.user.name || 'A connection'} published a new post.`, 'POST', r.insertId);
  }
  res.status(201).json({ id: r.insertId, message: 'Post published' });
};

exports.remove = async (req, res) => {
  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({ message: 'Invalid post' });
  }
  const [result] = await db.execute(
    'DELETE FROM posts WHERE id=? AND user_id=?',
    [postId, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Post not found' });
  res.json({ message: 'Post deleted' });
};

exports.toggleLike = async (req, res) => {
  const postId = Number(req.params.id);
  if (!await canViewPost(postId, req.user.id)) return res.status(404).json({ message: 'Post not found' });
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id=?', [postId]);
  if (!post.length) return res.status(404).json({ message: 'Post not found' });
  const [liked] = await db.execute('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?', [postId,req.user.id]);
  if (liked.length) {
    await db.execute('DELETE FROM post_likes WHERE post_id=? AND user_id=?', [postId,req.user.id]);
    return res.json({ liked: false });
  }
  await db.execute('INSERT INTO post_likes (post_id,user_id) VALUES (?,?)', [postId,req.user.id]);
  if (post[0].user_id !== req.user.id) await notify(post[0].user_id,'New like','Someone liked your post.','POST',postId);
  res.json({ liked: true });
};

exports.comments = async (req, res) => {
  if (!await canViewPost(Number(req.params.id), req.user.id)) return res.status(404).json({ message: 'Post not found' });
  const [rows] = await db.execute(
    `SELECT c.id,c.comment,c.created_at,u.id user_id,u.name,u.role,u.profile_image
     FROM post_comments c JOIN users u ON u.id=c.user_id
     WHERE c.post_id=? ORDER BY c.created_at ASC LIMIT 100`,
    [req.params.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.addComment = async (req, res) => {
  const comment = String(req.body.comment || '').trim();
  if (!comment || comment.length > 2000) return res.status(400).json({ message: 'Comment must be 1–2000 characters' });
  if (!await canViewPost(Number(req.params.id), req.user.id)) return res.status(404).json({ message: 'Post not found' });
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id=?', [req.params.id]);
  if (!post.length) return res.status(404).json({ message: 'Post not found' });
  const [r] = await db.execute('INSERT INTO post_comments (post_id,user_id,comment) VALUES (?,?,?)', [req.params.id,req.user.id,comment]);
  if (post[0].user_id !== req.user.id) await notify(post[0].user_id,'New comment','Someone commented on your post.','POST',Number(req.params.id));
  res.status(201).json({ id: r.insertId, message: 'Comment added' });
};

exports.canViewPost = canViewPost;
