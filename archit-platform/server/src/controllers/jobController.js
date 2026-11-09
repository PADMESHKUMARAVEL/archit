const db = require('../config/db');
const notify = require('../utils/notify');
const { required } = require('../config/env');

let forwardEmailColumn;
async function hasForwardEmailColumn() {
  if (forwardEmailColumn !== undefined) return forwardEmailColumn;
  const [rows] = await db.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='job_applications' AND COLUMN_NAME='forward_email'`
  );
  forwardEmailColumn = rows.length > 0;
  return forwardEmailColumn;
}

exports.list = async (req, res) => {
  const q = `%${String(req.query.q || '').slice(0,80)}%`;
  const [rows] = await db.execute(
    `SELECT j.*,u.name architect_name,u.profile_image architect_image
     FROM job_posts j JOIN users u ON u.id=j.architect_id
     WHERE j.status='OPEN' AND (j.deadline IS NULL OR j.deadline>=CURDATE())
       AND (j.title LIKE ? OR j.description LIKE ? OR j.location LIKE ?)
     ORDER BY j.created_at DESC LIMIT 50`, [q,q,q]
  );
  res.json(rows);
};

exports.create = async (req, res) => {
  const { title,description,job_type,location,requirements,deadline,salary_min,salary_max } = req.body;
  if (!title?.trim() || !description?.trim() || !['JOB','INTERNSHIP'].includes(job_type)) {
    return res.status(400).json({ message: 'Title, description and valid job type are required' });
  }
  const [r] = await db.execute(
    `INSERT INTO job_posts (architect_id,title,description,job_type,location,requirements,deadline,salary_min,salary_max)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [req.user.id,title.trim(),description.trim(),job_type,location || null,requirements || null,deadline || null,salary_min || null,salary_max || null]
  );
  res.status(201).json({ id: r.insertId, message: 'Opportunity published' });
};

exports.apply = async (req, res) => {
  if (req.user.role !== 'STUDENT') return res.status(403).json({ message: 'Only students can apply' });
  const [jobs] = await db.execute(
    `SELECT id,architect_id FROM job_posts WHERE id=? AND status='OPEN' AND (deadline IS NULL OR deadline>=CURDATE())`,
    [req.params.id]
  );
  if (!jobs.length) return res.status(404).json({ message: 'Opportunity is closed or unavailable' });
  if (!req.file) return res.status(400).json({ message: 'Please attach your resume or portfolio file' });
  const resumeUrl = `${required('BACKEND_URL')}/uploads/${encodeURIComponent(req.file.filename)}`;
  try {
    const [r] = await db.execute(
      'INSERT INTO job_applications (job_id,student_id,resume_url,cover_letter) VALUES (?,?,?,?)',
      [req.params.id,req.user.id,resumeUrl,req.body.cover_letter || null]
    );
    await notify(jobs[0].architect_id,'New application','A student applied for your opportunity.','APPLICATION',r.insertId);
    res.status(201).json({ id: r.insertId, message: 'Application submitted' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'You have already applied' });
    throw e;
  }
};

exports.mine = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT j.*,COUNT(a.id) applications_count FROM job_posts j
     LEFT JOIN job_applications a ON a.job_id=j.id
     WHERE j.architect_id=? GROUP BY j.id ORDER BY j.created_at DESC`, [req.user.id]
  );
  res.json(rows);
};

exports.applications = async (req, res) => {
  const [owned] = await db.execute('SELECT id FROM job_posts WHERE id=? AND architect_id=?', [req.params.id,req.user.id]);
  if (!owned.length) return res.status(404).json({ message: 'Opportunity not found' });
  const supportsForwardingEmail = await hasForwardEmailColumn();
  const [rows] = await db.execute(
    `SELECT a.id,a.status,a.cover_letter,a.resume_url,${supportsForwardingEmail ? 'a.forward_email' : 'NULL'} AS forward_email,a.applied_at,
      u.id student_id,u.name,u.email,u.location,u.profile_image
     FROM job_applications a JOIN users u ON u.id=a.student_id
     WHERE a.job_id=? ORDER BY a.applied_at DESC`, [req.params.id]
  );
  res.json(rows);
};

exports.updateApplication = async (req, res) => {
  const allowed = ['UNDER_REVIEW','SHORTLISTED','INTERVIEW','SELECTED','REJECTED'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid application status' });
  const forwardEmail = String(req.body.forward_email || '').trim();
  if (forwardEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardEmail)) return res.status(400).json({ message: 'Enter a valid forwarding email' });
  const supportsForwardingEmail = await hasForwardEmailColumn();
  const [r] = await db.execute(
    `UPDATE job_applications a JOIN job_posts j ON j.id=a.job_id
     SET a.status=?${supportsForwardingEmail ? ', a.forward_email=?' : ''} WHERE a.id=? AND j.architect_id=?`,
    supportsForwardingEmail
      ? [req.body.status, forwardEmail || null, req.params.applicationId, req.user.id]
      : [req.body.status, req.params.applicationId, req.user.id]
  );
  if (!r.affectedRows) return res.status(404).json({ message: 'Application not found' });
  const [application] = await db.execute('SELECT student_id FROM job_applications WHERE id=?', [req.params.applicationId]);
  if (application.length) await notify(application[0].student_id, 'Application updated', `Your application was ${req.body.status.toLowerCase().replace('_', ' ')}.`, 'APPLICATION', Number(req.params.applicationId));
  res.json({ message: 'Application status updated' });
};
