const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');

const categories = new Set([
  'Residential', 'Commercial', 'Interior Design', 'Landscape', 'Renovation',
  'Institutional', 'Other'
]);

function validOptionalText(value, maxLength) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= maxLength);
}

exports.create = async (req, res) => {
  const architectId = Number(req.params.architectId);
  const {
    title, description, budget, budget_min, budget_max, location,
    category, land_area, expected_timeline, preferred_style
  } = req.body;
  const numericInputs = [budget, budget_min, budget_max].filter(value => value !== undefined && value !== null && value !== '');
  if (numericInputs.some(value => !['string', 'number'].includes(typeof value))) {
    return res.status(400).json({ message: 'Budget values must be numeric' });
  }
  const min = budget_min === '' || budget_min === undefined || budget_min === null ? null : Number(budget_min);
  const max = budget_max === '' || budget_max === undefined || budget_max === null ? null : Number(budget_max);
  const legacyBudget = budget === '' || budget === undefined || budget === null ? null : Number(budget);
  if (typeof title !== 'string' || !title.trim() || title.length > 255 ||
      typeof description !== 'string' || !description.trim() || description.length > 10000) {
    return res.status(400).json({ message: 'A project title and description are required' });
  }
  if (!validOptionalText(location, 255) || !validOptionalText(land_area, 100) ||
      !validOptionalText(expected_timeline, 100) || !validOptionalText(preferred_style, 255)) {
    return res.status(400).json({ message: 'One or more project details exceed the allowed length' });
  }
  if (category && !categories.has(category)) return res.status(400).json({ message: 'Choose a valid project category' });
  if ((legacyBudget !== null && (!Number.isFinite(legacyBudget) || legacyBudget < 0 || legacyBudget > 9999999999.99)) ||
      (min !== null && (!Number.isFinite(min) || min < 0 || min > 9999999999.99)) ||
      (max !== null && (!Number.isFinite(max) || max < 0 || max > 9999999999.99)) ||
      (min !== null && max !== null && max < min)) {
    return res.status(400).json({ message: 'Enter a valid budget range' });
  }
  if (req.files?.length > 5) return res.status(400).json({ message: 'You can attach up to five reference files' });

  if (!Number.isSafeInteger(architectId) || architectId < 1) {
    return res.status(400).json({ message: 'Invalid architect ID' });
  }
  const [architect] = await db.execute(
    "SELECT id FROM users WHERE id=? AND role='ARCHITECT' AND is_active=1",
    [architectId]
  );
  if (!architect.length) return res.status(404).json({ message: 'Architect not found' });
  const [clients] = await db.execute('SELECT name FROM users WHERE id=?', [req.user.id]);
  const enquiryMessage = [
    `Project enquiry: ${title.trim()}`,
    category ? `Category: ${category}` : null,
    location?.trim() ? `Location: ${location.trim()}` : null,
    land_area?.trim() ? `Land area: ${land_area.trim()}` : null,
    min !== null || max !== null ? `Budget: ${min ?? '—'} – ${max ?? '—'}` : legacyBudget !== null ? `Budget: ${legacyBudget}` : null,
    expected_timeline?.trim() ? `Expected timeline: ${expected_timeline.trim()}` : null,
    preferred_style?.trim() ? `Preferred style: ${preferred_style.trim()}` : null,
    '',
    'Project brief:',
    description.trim(),
    req.files?.length ? `\n${req.files.length} reference file(s) are attached to this enquiry.` : null
  ].filter(line => line !== null).join('\n');
  const [duplicates] = await db.execute(
    `SELECT id FROM project_inquiries
     WHERE client_id=? AND architect_id=? AND LOWER(title)=LOWER(?)
       AND status IN ('PENDING','VIEWED','RESPONDED','IN_DISCUSSION','ACCEPTED')
     LIMIT 1`,
    [req.user.id, architectId, title.trim()]
  );
  if (duplicates.length) return res.status(409).json({ message: 'An active enquiry with this title already exists for this architect' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [inq] = await conn.execute(
      `INSERT INTO project_inquiries
       (client_id,architect_id,title,description,budget,location,category,land_area,budget_min,budget_max,expected_timeline,preferred_style)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, architectId, title.trim(), description.trim(),
        legacyBudget ?? max ?? min, location?.trim() || null, category || null,
        land_area?.trim() || null, min, max, expected_timeline?.trim() || null,
        preferred_style?.trim() || null
      ]
    );
    const [conv] = await conn.execute(
      "INSERT INTO conversations (conversation_type,reference_id) VALUES ('CLIENT_ENQUIRY',?)",
      [inq.insertId]
    );
    await conn.execute(
      'INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?),(?,?)',
      [conv.insertId, req.user.id, conv.insertId, architectId]
    );
    await conn.execute('UPDATE project_inquiries SET conversation_id=? WHERE id=?', [conv.insertId, inq.insertId]);
    await conn.execute(
      'INSERT INTO messages (conversation_id,sender_id,message) VALUES (?,?,?)',
      [conv.insertId, req.user.id, enquiryMessage]
    );

    for (const file of req.files || []) {
      const fileUrl = await upload(file, `enquiries/${inq.insertId}`);
      await conn.execute(
        `INSERT INTO enquiry_documents (inquiry_id,uploaded_by,file_url,file_name,mime_type,file_size)
         VALUES (?,?,?,?,?,?)`,
        [inq.insertId, req.user.id, fileUrl, file.originalname.slice(0, 255), file.mimetype, file.size]
      );
    }

    await conn.commit();
    const details = [
      category,
      location?.trim(),
      min !== null || max !== null ? `Budget: ${min ?? '—'}–${max ?? '—'}` : null
    ].filter(Boolean);
    const summary = description.trim().slice(0, 240);
    const notificationMessage = `${clients[0]?.name || 'A client'} sent "${title.trim()}"${details.length ? ` (${details.join(' · ')})` : ''}. ${summary}${description.trim().length > 240 ? '…' : ''}`;
    await notify(architectId, 'New client enquiry', notificationMessage, 'ENQUIRY', inq.insertId);
    res.status(201).json({ id: inq.insertId, conversationId: conv.insertId, message: 'Enquiry sent' });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
};

exports.list = async (req, res) => {
  const isArchitect = req.user.role === 'ARCHITECT';
  const where = isArchitect ? 'i.architect_id=?' : 'i.client_id=?';
  const [rows] = await db.execute(
    `SELECT i.*,u.name other_party_name,u.profile_image other_party_image,
       (SELECT COUNT(*) FROM enquiry_documents d WHERE d.inquiry_id=i.id) document_count
     FROM project_inquiries i
     JOIN users u ON u.id=${isArchitect ? 'i.client_id' : 'i.architect_id'}
     WHERE ${where} ORDER BY i.created_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.detail = async (req, res) => {
  const isArchitect = req.user.role === 'ARCHITECT';
  const ownerColumn = isArchitect ? 'i.architect_id' : 'i.client_id';
  const [rows] = await db.execute(
    `SELECT i.*,c.name client_name,c.profile_image client_image,
       a.name architect_name,a.profile_image architect_image
     FROM project_inquiries i
     JOIN users c ON c.id=i.client_id
     JOIN users a ON a.id=i.architect_id
     WHERE i.id=? AND ${ownerColumn}=?`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'Enquiry not found' });
  const enquiry = rows[0];
  if (isArchitect && enquiry.status === 'PENDING') {
    await db.execute("UPDATE project_inquiries SET status='VIEWED' WHERE id=? AND status='PENDING'", [req.params.id]);
    enquiry.status = 'VIEWED';
  }
  const [documents] = await db.execute(
    `SELECT id,file_url,file_name,mime_type,file_size,uploaded_by,created_at
     FROM enquiry_documents WHERE inquiry_id=? ORDER BY created_at`,
    [req.params.id]
  );
  res.json(await signAssetUrls({ ...enquiry, documents }));
};

exports.updateStatus = async (req, res) => {
  const status = req.body.status;
  const allowed = ['RESPONDED', 'IN_DISCUSSION', 'ACCEPTED', 'REJECTED'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid enquiry status' });
  const conn = await db.getConnection();
  let inquiry;
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT * FROM project_inquiries WHERE id=? AND architect_id=? FOR UPDATE',
      [req.params.id, req.user.id]
    );
    inquiry = rows[0];
    if (!inquiry) {
      await conn.rollback();
      return res.status(404).json({ message: 'Enquiry not found' });
    }
    const transitions = {
      PENDING: ['RESPONDED', 'IN_DISCUSSION', 'ACCEPTED', 'REJECTED'],
      VIEWED: ['RESPONDED', 'IN_DISCUSSION', 'ACCEPTED', 'REJECTED'],
      RESPONDED: ['IN_DISCUSSION', 'ACCEPTED', 'REJECTED'],
      IN_DISCUSSION: ['ACCEPTED', 'REJECTED']
    };
    if (!transitions[inquiry.status]?.includes(status)) {
      await conn.rollback();
      return res.status(409).json({ message: 'That status transition is not allowed for this enquiry' });
    }
    await conn.execute('UPDATE project_inquiries SET status=? WHERE id=?', [status, req.params.id]);
    if (status === 'ACCEPTED') {
      await conn.execute(
        `INSERT IGNORE INTO client_projects (inquiry_id,client_id,architect_id,title,category,location)
         VALUES (?,?,?,?,?,?)`,
        [inquiry.id, inquiry.client_id, inquiry.architect_id, inquiry.title, inquiry.category, inquiry.location]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  const label = status === 'ACCEPTED' ? 'accepted' : status === 'REJECTED' ? 'rejected' : 'updated';
  await notify(inquiry.client_id, 'Enquiry ' + label, `Your project enquiry "${inquiry.title}" was ${label}.`, 'ENQUIRY', inquiry.id);
  res.json({ message: 'Enquiry status updated' });
};

exports.cancel = async (req, res) => {
  const [result] = await db.execute(
    `UPDATE project_inquiries SET status='CANCELLED'
     WHERE id=? AND client_id=? AND status IN ('PENDING','VIEWED','RESPONDED','IN_DISCUSSION')`,
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Enquiry not found or can no longer be cancelled' });
  const [rows] = await db.execute('SELECT architect_id,title FROM project_inquiries WHERE id=?', [req.params.id]);
  await notify(rows[0].architect_id, 'Enquiry cancelled', `The client cancelled "${rows[0].title}".`, 'ENQUIRY', Number(req.params.id));
  res.json({ message: 'Enquiry cancelled' });
};
