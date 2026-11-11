const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { required } = require('../config/env');
const { signAssetUrls } = require('../utils/objectStorage');
const JWT_SECRET = required('JWT_SECRET');

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name?.trim() || !email?.trim() || !password ||
      !['STUDENT','ARCHITECT','CLIENT'].includes(role)) {
    return res.status(400).json({ message: 'Name, email, password and a valid role are required' });
  }
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute('SELECT id FROM users WHERE email=?', [email.toLowerCase()]);
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email is already registered' });
    }
    const hash = await bcrypt.hash(password, 12);
    const [u] = await conn.execute(
      'INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      [name.trim(), email.toLowerCase(), hash, role]
    );
    const table = role === 'STUDENT' ? 'student_profiles' :
      role === 'ARCHITECT' ? 'architect_profiles' : 'client_profiles';
    await conn.execute(`INSERT INTO ${table} (user_id) VALUES (?)`, [u.insertId]);
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
