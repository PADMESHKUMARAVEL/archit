const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const architectSelect = `
  SELECT u.id,u.name,u.profile_image,u.bio,u.location,
    ap.firm_name,ap.experience_years,ap.specializations,ap.website,
    (SELECT pp.title FROM portfolio_projects pp WHERE pp.user_id=u.id ORDER BY pp.created_at DESC LIMIT 1) portfolio_title,
    (SELECT pp.cover_image FROM portfolio_projects pp WHERE pp.user_id=u.id ORDER BY pp.created_at DESC LIMIT 1) cover_image,
    (SELECT COUNT(*) FROM portfolio_projects pp WHERE pp.user_id=u.id) portfolio_count
  FROM users u JOIN architect_profiles ap ON ap.user_id=u.id`;

exports.profile = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT u.id,u.name,u.email,u.profile_image,u.bio,u.location,
      cp.phone,cp.client_type,cp.organization,cp.notification_preferences
     FROM users u JOIN client_profiles cp ON cp.user_id=u.id
     WHERE u.id=? AND u.is_active=1`,
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Client profile not found' });
  const profile = rows[0];
  if (typeof profile.notification_preferences === 'string') {
    profile.notification_preferences = JSON.parse(profile.notification_preferences);
  }
  res.json(await signAssetUrls(profile));
};

exports.updateProfile = async (req, res) => {
  const { name, bio, location, phone, client_type, organization, notification_preferences } = req.body;
  const validTypes = ['INDIVIDUAL', 'COMPANY', 'ORGANIZATION'];
  if (client_type !== undefined && !validTypes.includes(client_type)) {
    return res.status(400).json({ message: 'Choose a valid client type' });
  }
  for (const [label, value, max] of [
    ['Name', name, 150], ['Bio', bio, 5000], ['Location', location, 255],
    ['Phone', phone, 50], ['Organization', organization, 255]
  ]) {
    if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > max)) {
      return res.status(400).json({ message: `${label} must be no more than ${max} characters` });
    }
    if (notification_preferences !== undefined &&
        (!notification_preferences || typeof notification_preferences !== 'object' ||
         Array.isArray(notification_preferences) ||
         Object.values(notification_preferences).some(value => typeof value !== 'boolean'))) {
      return res.status(400).json({ message: 'Notification preferences must contain boolean values' });
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'UPDATE users SET name=COALESCE(?,name),bio=?,location=? WHERE id=?',
      [name?.trim() || null, bio ?? null, location ?? null, req.user.id]
    );
    await conn.execute(
      `UPDATE client_profiles SET phone=?,client_type=COALESCE(?,client_type),organization=?,
       notification_preferences=COALESCE(?,notification_preferences)
       WHERE user_id=?`,
      [phone ?? null, client_type || null, client_type === 'INDIVIDUAL' ? null : organization ?? null,
        notification_preferences === undefined ? null : JSON.stringify(notification_preferences), req.user.id]
    );
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.json({ message: 'Client profile updated' });
};

exports.architects = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;
  const search = String(req.query.q || '').trim().slice(0, 100);
  const location = String(req.query.location || '').trim().slice(0, 100);
  const specialization = String(req.query.specialization || '').trim().slice(0, 100);
  const projectType = String(req.query.project_type || '').trim().slice(0, 100);
  const minExperience = Number.parseInt(req.query.min_experience, 10);
  const conditions = ["u.role='ARCHITECT'", 'u.is_active=1'];
  const values = [];
  if (search) {
    conditions.push('(u.name LIKE ? OR u.bio LIKE ? OR ap.firm_name LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (location) {
    conditions.push('u.location LIKE ?');
    values.push(`%${location}%`);
  }
  if (specialization) {
    conditions.push('CAST(ap.specializations AS CHAR) LIKE ?');
    values.push(`%${specialization}%`);
  }
  if (projectType) {
    conditions.push('EXISTS (SELECT 1 FROM portfolio_projects pp WHERE pp.user_id=u.id AND pp.category LIKE ?)');
    values.push(`%${projectType}%`);
  }
  if (Number.isInteger(minExperience) && minExperience > 0) {
    conditions.push('ap.experience_years >= ?');
    values.push(Math.min(minExperience, 80));
  }

  const where = conditions.join(' AND ');
  const sort = req.query.sort === 'experience'
    ? 'ap.experience_years DESC,u.name ASC'
    : search ? 'CASE WHEN u.name LIKE ? THEN 0 WHEN ap.firm_name LIKE ? THEN 1 ELSE 2 END,u.name ASC' : 'u.name ASC';
  const sortValues = req.query.sort === 'experience' || !search ? [] : [`%${search}%`, `%${search}%`];
  const [[{ total }], [rows]] = await Promise.all([
    db.execute(`SELECT COUNT(*) total FROM users u JOIN architect_profiles ap ON ap.user_id=u.id WHERE ${where}`, values),
    db.execute(`${architectSelect} WHERE ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...values, ...sortValues, limit, offset])
  ]);
  res.json(await signAssetUrls({ architects: rows, page, limit, total }));
};

exports.architect = async (req, res) => {
  const [rows] = await db.execute(
    `${architectSelect} WHERE u.id=? AND u.role='ARCHITECT' AND u.is_active=1`,
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Architect not found' });
  const [projects] = await db.execute(
    `SELECT pp.id,pp.title,pp.description,pp.category,pp.cover_image,pp.created_at
     FROM portfolio_projects pp WHERE pp.user_id=? ORDER BY pp.created_at DESC`,
    [req.params.id]
  );
  const [media] = await db.execute(
    `SELECT pm.project_id,pm.media_url FROM portfolio_media pm
     JOIN portfolio_projects pp ON pp.id=pm.project_id WHERE pp.user_id=? ORDER BY pm.id`,
    [req.params.id]
  );
  const mediaByProject = new Map();
  for (const item of media) {
    const urls = mediaByProject.get(item.project_id) || [];
    urls.push({ media_url: item.media_url });
    mediaByProject.set(item.project_id, urls);
  }
  const portfolio = projects.map(item=>({...item,media:mediaByProject.get(item.id)||[]}));
  res.json(await signAssetUrls({ ...rows[0], projects: portfolio }));
};

exports.savedArchitects = async (req, res) => {
  const [rows] = await db.execute(
    `${architectSelect}
     JOIN saved_architects sa ON sa.architect_id=u.id
     WHERE sa.client_id=? AND u.is_active=1 ORDER BY sa.created_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.saveArchitect = async (req, res) => {
  const [architect] = await db.execute(
    "SELECT id FROM users WHERE id=? AND role='ARCHITECT' AND is_active=1",
    [req.params.architectId]
  );
  if (!architect.length) return res.status(404).json({ message: 'Architect not found' });
  await db.execute(
    'INSERT IGNORE INTO saved_architects (client_id,architect_id) VALUES (?,?)',
    [req.user.id, req.params.architectId]
  );
  res.status(201).json({ message: 'Architect saved' });
};

exports.removeSavedArchitect = async (req, res) => {
  await db.execute(
    'DELETE FROM saved_architects WHERE client_id=? AND architect_id=?',
    [req.user.id, req.params.architectId]
  );
  res.json({ message: 'Architect removed from saved list' });
};

exports.dashboard = async (req, res) => {
  const [enquiries] = await db.execute(
    `SELECT COUNT(*) total,
       SUM(status IN ('PENDING','VIEWED')) pending
     FROM project_inquiries WHERE client_id=?`,
    [req.user.id]
  );
  const [projects] = await db.execute(
    `SELECT COUNT(*) total,
       SUM(status NOT IN ('COMPLETED','CANCELLED')) active,
       SUM(status='COMPLETED') completed
     FROM client_projects WHERE client_id=?`,
    [req.user.id]
  );
  const [unread] = await db.execute(
    `SELECT COUNT(*) total
     FROM messages m
     JOIN conversation_participants cp ON cp.conversation_id=m.conversation_id AND cp.user_id=?
     WHERE m.sender_id<>? AND m.is_deleted=0
       AND (cp.last_read_at IS NULL OR m.created_at>cp.last_read_at)
       AND NOT EXISTS(SELECT 1 FROM message_hidden_for hidden WHERE hidden.message_id=m.id AND hidden.user_id=?)`,
    [req.user.id, req.user.id, req.user.id]
  );
  const [recent] = await db.execute(
    `SELECT i.id,i.title,i.status,i.created_at,u.id architect_id,u.name architect_name,u.profile_image architect_image
     FROM project_inquiries i JOIN users u ON u.id=i.architect_id
     WHERE i.client_id=? ORDER BY i.created_at DESC LIMIT 5`,
    [req.user.id]
  );
  const [recentProjects] = await db.execute(
    `SELECT p.id,p.title,p.status,p.location,p.updated_at,
       (SELECT pu.message FROM project_updates pu WHERE pu.project_id=p.id ORDER BY pu.created_at DESC LIMIT 1) latest_update
     FROM client_projects p WHERE p.client_id=? ORDER BY p.updated_at DESC LIMIT 3`,
    [req.user.id]
  );
  const [recentNotifications] = await db.execute(
    `SELECT id,title,message,notification_type,reference_id,is_read,created_at
     FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 5`,
    [req.user.id]
  );
  res.json(await signAssetUrls({
    enquiries: enquiries[0], projects: projects[0], unread_messages: unread[0].total,
    recent_enquiries: recent, recent_projects: recentProjects, recent_notifications: recentNotifications
  }));
};

async function getProjectForUser(projectId, user) {
  const [rows] = await db.execute(
    `SELECT p.*,i.description,i.budget,i.budget_min,i.budget_max,i.land_area,
       i.expected_timeline,i.preferred_style,i.status inquiry_status,
       c.name client_name,c.profile_image client_image,
       a.name architect_name,a.profile_image architect_image,a.location architect_location
     FROM client_projects p
     JOIN project_inquiries i ON i.id=p.inquiry_id
     JOIN users c ON c.id=p.client_id
     JOIN users a ON a.id=p.architect_id
     WHERE p.id=? AND (p.client_id=? OR p.architect_id=?)`,
    [projectId, user.id, user.id]
  );
  return rows[0];
}

exports.projects = async (req, res) => {
  const isArchitect = req.user.role === 'ARCHITECT';
  const ownerColumn = isArchitect ? 'p.architect_id' : 'p.client_id';
  const [rows] = await db.execute(
    `SELECT p.id,p.inquiry_id,p.title,p.category,p.location,p.status,p.start_date,
       p.expected_completion_date,p.updated_at,
       u.id other_party_id,u.name other_party_name,u.profile_image other_party_image,
       (SELECT pu.message FROM project_updates pu WHERE pu.project_id=p.id ORDER BY pu.created_at DESC LIMIT 1) latest_update,
       (SELECT pu.created_at FROM project_updates pu WHERE pu.project_id=p.id ORDER BY pu.created_at DESC LIMIT 1) latest_update_at
     FROM client_projects p JOIN users u ON u.id=${isArchitect ? 'p.client_id' : 'p.architect_id'}
     WHERE ${ownerColumn}=? ORDER BY p.updated_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.documents = async (req, res) => {
  const isArchitect = req.user.role === 'ARCHITECT';
  const ownerColumn = isArchitect ? 'p.architect_id' : 'p.client_id';
  const inquiryOwnerColumn = isArchitect ? 'i.architect_id' : 'i.client_id';
  const [rows] = await db.execute(
    `SELECT d.id,d.file_url,d.file_name,d.mime_type,d.file_size,d.uploaded_by,d.created_at,
       'PROJECT' context_type,p.id context_id,p.title context_title,u.name uploaded_by_name
     FROM project_documents d
     JOIN client_projects p ON p.id=d.project_id
     JOIN users u ON u.id=d.uploaded_by
     WHERE ${ownerColumn}=?
     UNION ALL
     SELECT d.id,d.file_url,d.file_name,d.mime_type,d.file_size,d.uploaded_by,d.created_at,
       'ENQUIRY' context_type,i.id context_id,i.title context_title,u.name uploaded_by_name
     FROM enquiry_documents d
     JOIN project_inquiries i ON i.id=d.inquiry_id
     JOIN users u ON u.id=d.uploaded_by
     WHERE ${inquiryOwnerColumn}=?
     ORDER BY created_at DESC`,
    [req.user.id, req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.project = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  const [updates] = await db.execute(
    `SELECT pu.id,pu.message,pu.progress,pu.created_at,u.id author_id,u.name author_name
     FROM project_updates pu JOIN users u ON u.id=pu.author_id
     WHERE pu.project_id=? ORDER BY pu.created_at DESC`,
    [req.params.id]
  );
  const [milestones] = await db.execute(
    `SELECT id,title,description,due_date,status,created_at,updated_at
     FROM project_milestones WHERE project_id=? ORDER BY due_date IS NULL,due_date,id`,
    [req.params.id]
  );
  const [documents] = await db.execute(
    `SELECT id,file_url,file_name,mime_type,file_size,uploaded_by,created_at
     FROM project_documents WHERE project_id=? ORDER BY created_at DESC`,
    [req.params.id]
  );
  res.json(await signAssetUrls({ ...project, updates, milestones, documents }));
};

exports.addMilestone = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (req.user.role !== 'ARCHITECT' || Number(project.architect_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Only the assigned architect can manage project milestones' });
  }
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() || null : null;
  const dueDate = req.body.due_date || null;
  if (!title || title.length > 255 || (description && description.length > 5000) ||
      (req.body.description !== undefined && req.body.description !== '' && typeof req.body.description !== 'string') ||
      (dueDate && !validDate(dueDate))) {
    return res.status(400).json({ message: 'Provide a milestone title, optional description, and valid due date' });
  }
  const [result] = await db.execute(
    'INSERT INTO project_milestones (project_id,title,description,due_date) VALUES (?,?,?,?)',
    [req.params.id, title, description, dueDate]
  );
  await notify(project.client_id, 'Project milestone added', `A milestone was added to ${project.title}.`, 'PROJECT_UPDATE', req.params.id);
  res.status(201).json({ id: result.insertId, message: 'Milestone added' });
};

exports.updateMilestone = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (req.user.role !== 'ARCHITECT' || Number(project.architect_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Only the assigned architect can manage project milestones' });
  }
  if (!['PENDING','COMPLETED'].includes(req.body.status)) {
    return res.status(400).json({ message: 'Invalid milestone status' });
  }
  const [milestones] = await db.execute(
    'SELECT id FROM project_milestones WHERE id=? AND project_id=?',
    [req.params.milestoneId, req.params.id]
  );
  if (!milestones.length) return res.status(404).json({ message: 'Milestone not found' });
  await db.execute(
    'UPDATE project_milestones SET status=? WHERE id=? AND project_id=?',
    [req.body.status, req.params.milestoneId, req.params.id]
  );
  if (req.body.status === 'COMPLETED') {
    await notify(project.client_id, 'Milestone completed', `A milestone for ${project.title} was completed.`, 'PROJECT_UPDATE', req.params.id);
  }
  res.json({ message: 'Milestone updated' });
};

exports.addProjectUpdate = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (req.user.role !== 'ARCHITECT' || Number(project.architect_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Only the assigned architect can publish project updates' });
  }
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const progress = req.body.progress === '' || req.body.progress === undefined ? null : Number(req.body.progress);
  if (!message || message.length > 5000 || (progress !== null && (!Number.isInteger(progress) || progress < 0 || progress > 100))) {
    return res.status(400).json({ message: 'Provide an update and an optional progress value from 0 to 100' });
  }
  const [result] = await db.execute(
    'INSERT INTO project_updates (project_id,author_id,message,progress) VALUES (?,?,?,?)',
    [req.params.id, req.user.id, message, progress]
  );
  await db.execute('UPDATE client_projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [req.params.id]);
  await notify(project.client_id, 'Project update', `The architect posted an update for ${project.title}.`, 'PROJECT_UPDATE', req.params.id);
  res.status(201).json({ id: result.insertId, message: 'Project update published' });
};

exports.updateProjectStatus = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (req.user.role !== 'ARCHITECT' || Number(project.architect_id) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'Only the assigned architect can change project status' });
  }
  const allowed = ['INITIATED','PLANNING','DESIGN','APPROVAL','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Invalid project status' });
  const expectedCompletion = req.body.expected_completion_date || null;
  if (expectedCompletion && !validDate(expectedCompletion)) {
    return res.status(400).json({ message: 'Expected completion date must be a valid calendar date' });
  }
  await db.execute(
    'UPDATE client_projects SET status=?,expected_completion_date=? WHERE id=?',
    [req.body.status, expectedCompletion, req.params.id]
  );
  await notify(project.client_id, 'Project status changed', `${project.title} is now ${req.body.status.toLowerCase().replace('_', ' ')}.`, 'PROJECT_STATUS', req.params.id);
  res.json({ message: 'Project status updated' });
};

exports.uploadProjectDocuments = async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user);
  if (!project) return res.status(404).json({ message: 'Project not found' });
  if (!req.files?.length) return res.status(400).json({ message: 'Choose at least one file to upload' });
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const records = [];
    for (const file of req.files) {
      const fileUrl = await upload(file, `projects/${req.params.id}`);
      const [result] = await conn.execute(
        `INSERT INTO project_documents (project_id,uploaded_by,file_url,file_name,mime_type,file_size)
         VALUES (?,?,?,?,?,?)`,
        [req.params.id, req.user.id, fileUrl, file.originalname.slice(0, 255), file.mimetype, file.size]
      );
      records.push({ id: result.insertId, file_url: fileUrl, file_name: file.originalname, mime_type: file.mimetype, file_size: file.size });
    }
    await conn.commit();
    res.status(201).json(await signAssetUrls(records));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};
