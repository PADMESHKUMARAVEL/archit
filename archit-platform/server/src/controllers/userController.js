const db = require('../config/db');
const { upload, signAssetUrls } = require('../utils/objectStorage');

exports.search = async (req, res) => {
  const role = ['STUDENT','ARCHITECT','CLIENT'].includes(req.query.role) ? req.query.role : null;
  const q = `%${String(req.query.q || '').slice(0,80)}%`;
  const [rows] = await db.execute(
    `SELECT id,name,role,profile_image,bio,location
     FROM users
     WHERE is_active=1 AND (? IS NULL OR role=?)
       AND (name LIKE ? OR bio LIKE ? OR location LIKE ?)
     ORDER BY name LIMIT 50`,
    [role, role, q, q, q]
  );
  res.json(await signAssetUrls(rows));
};

exports.getOne = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.id,u.name,u.role,u.profile_image,u.bio,u.location,
       sp.college,sp.degree,sp.specialization,sp.graduation_year,sp.skills,
       ap.firm_name,ap.experience_years,ap.specializations,ap.website,
       EXISTS(
         SELECT 1 FROM connections c
         WHERE c.status='ACCEPTED'
           AND ((c.requester_id=u.id AND c.receiver_id=?) OR (c.receiver_id=u.id AND c.requester_id=?))
       ) is_connection
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     LEFT JOIN architect_profiles ap ON ap.user_id=u.id
     WHERE u.id=? AND u.is_active=1`,
    [req.user.id,req.user.id,req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Profile not found' });
  const profile = rows[0];
  const isConnection = Boolean(profile.is_connection);
  profile.is_connection = isConnection;
  if (!isConnection) {
    for (const field of [
      'college','degree','specialization','graduation_year','skills',
      'firm_name','experience_years','specializations','website'
    ]) {
      delete profile[field];
    }
  }
  res.json(await signAssetUrls(profile));
};

exports.updateMe = async (req, res) => {
  const { name, bio, location } = req.body;
  await db.execute(
    `UPDATE users SET name=COALESCE(?,name), bio=?, location=?
     WHERE id=?`,
    [name || null, bio ?? null, location ?? null, req.user.id]
  );
  res.json({ message: 'Profile updated' });
};

exports.updatePhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'A photo is required' });
  const profileImage = await upload(req.file, 'profiles');
  await db.execute('UPDATE users SET profile_image=? WHERE id=?', [profileImage, req.user.id]);
  res.json(await signAssetUrls({ profile_image: profileImage }));
};
