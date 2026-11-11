const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { required } = require('../config/env');
const { signAssetUrls, upload } = require('../utils/objectStorage');
const JWT_SECRET = required('JWT_SECRET');

exports.register = async (req, res) => {
  const { name, email, password, role, phone, client_type, organization, location, firm_name, experience_years, specializations } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.length > 150 ||
      typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || !password ||
      !['STUDENT','ARCHITECT','CLIENT'].includes(role)) {
    return res.status(400).json({ message: 'Name, email, password and a valid role are required' });
  }
  if (password.length < 8 || password.length > 200) return res.status(400).json({ message: 'Password must be between 8 and 200 characters' });
  for (const [label, value, max] of [
    ['Phone', phone, 50], ['Organization', organization, 255], ['Location', location, 255],
    ['Firm name', firm_name, 255]
  ]) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > max)) {
      return res.status(400).json({ message: `${label} must be no more than ${max} characters` });
    }
  }
  if (role === 'CLIENT' && client_type && !['INDIVIDUAL','COMPANY','ORGANIZATION'].includes(client_type)) {
    return res.status(400).json({ message: 'Choose a valid client type' });
  }
  const years = experience_years === '' || experience_years === undefined ? 0 : Number(experience_years);
  if (role === 'ARCHITECT' && (!Number.isInteger(years) || years < 0 || years > 80)) {
    return res.status(400).json({ message: 'Experience must be a whole number between 0 and 80 years' });
  }
  const specialties = typeof specializations === 'string'
    ? [...new Set(specializations.split(',').map(value => value.trim()).filter(Boolean))].slice(0, 20)
    : [];
  if (specialties.some(value => value.length > 100)) {
    return res.status(400).json({ message: 'Each specialization must be no more than 100 characters' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email=?', [email.trim().toLowerCase()]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email is already registered' });
    }
    const hash = await bcrypt.hash(password, 12);
    const [u] = await conn.execute(
      `INSERT INTO users
       (name,email,password_hash,role,location,phone,client_type,organization)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        name.trim(), email.trim().toLowerCase(), hash, role,
        ['CLIENT','ARCHITECT'].includes(role) ? (location?.trim() || null) : null,
        role === 'CLIENT' ? phone?.trim() || null : null,
        role === 'CLIENT' ? client_type || 'INDIVIDUAL' : null,
        role === 'CLIENT' && client_type !== 'INDIVIDUAL' ? organization?.trim() || null : null
      ]
    );
    if (role === 'STUDENT') {
      await conn.execute('INSERT INTO student_profiles (user_id) VALUES (?)', [u.insertId]);
    } else if (role === 'ARCHITECT') {
      await conn.execute(
        'INSERT INTO architect_profiles (user_id,firm_name,experience_years,specializations) VALUES (?,?,?,?)',
        [u.insertId, firm_name?.trim() || null, years, JSON.stringify(specialties)]
      );
    }
    if (req.file) {
      const profileImage = await upload(req.file, 'profiles');
      await conn.execute('UPDATE users SET profile_image=? WHERE id=?', [profileImage, u.insertId]);
    }
    await conn.commit();
    res.status(201).json({ message: 'Account created. Please sign in.' });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.execute(
    'SELECT id,name,email,password_hash,role,profile_image,bio,location FROM users WHERE email=? AND is_active=1',
    [(email || '').toLowerCase()]
  );
  if (!rows.length || !(await bcrypt.compare(password || '', rows[0].password_hash))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const u = rows[0];
  const token = jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '12h' });
  delete u.password_hash;
  res.json(await signAssetUrls({ token, user: u }));
};

exports.me = async (req, res) => {
  const [rows] = await db.execute(
    'SELECT id,name,email,role,profile_image,bio,location FROM users WHERE id=? AND is_active=1',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(await signAssetUrls(rows[0]));
};

exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  if (typeof current_password !== 'string' ||
      typeof new_password !== 'string' || new_password.length < 8 || new_password.length > 200) {
    return res.status(400).json({ message: 'New password must be between 8 and 200 characters' });
  }
  const [rows] = await db.execute('SELECT password_hash FROM users WHERE id=? AND is_active=1', [req.user.id]);
  if (!rows.length || !(await bcrypt.compare(current_password || '', rows[0].password_hash))) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }
  const passwordHash = await bcrypt.hash(new_password, 12);
  await db.execute('UPDATE users SET password_hash=? WHERE id=?', [passwordHash, req.user.id]);
  res.json({ message: 'Password changed successfully' });
};
