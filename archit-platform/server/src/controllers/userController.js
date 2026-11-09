const db = require('../config/db');
const { required } = require('../config/env');

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
  res.json(rows);
};

exports.getOne = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.id,u.name,u.role,u.profile_image,u.bio,u.location,
       sp.college,sp.degree,sp.specialization,sp.graduation_year,sp.skills,
       ap.firm_name,ap.experience_years,ap.specializations,ap.website
     FROM users u
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     LEFT JOIN architect_profiles ap ON ap.user_id=u.id
     WHERE u.id=? AND u.is_active=1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Profile not found' });
  res.json(rows[0]);
};

exports.updateMe = async (req, res) => {
  const { name, bio, location, profile_image } = req.body;
  await db.execute(
    `UPDATE users SET name=COALESCE(?,name), bio=?, location=?, profile_image=?
     WHERE id=?`,
    [name || null, bio ?? null, location ?? null, profile_image ?? null, req.user.id]
  );
  res.json({ message: 'Profile updated' });
};

exports.updatePhoto = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'A photo is required' });
  const profileImage = `${required('BACKEND_URL')}/uploads/${encodeURIComponent(req.file.filename)}`;
  await db.execute('UPDATE users SET profile_image=? WHERE id=?', [profileImage, req.user.id]);
  res.json({ profile_image: profileImage });
};
