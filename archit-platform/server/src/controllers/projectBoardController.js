const db = require('../config/db');
const notify = require('../utils/notify');
const { upload, signAssetUrls } = require('../utils/objectStorage');

const categories = new Set([
  'Residential', 'Commercial', 'Interior Design', 'Landscape', 'Renovation',
  'Institutional', 'Other'
]);

function validDateText(value, maxLength) {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.length <= maxLength);
}

exports.listBoard = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(24, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const offset = (page - 1) * limit;
  const search = String(req.query.q || '').trim().slice(0, 100);
  const category = String(req.query.category || '').trim();
  const location = String(req.query.location || '').trim().slice(0, 100);
  const conditions = ["r.status='OPEN'"];
  const values = [];
  if (search) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ? OR r.preferred_style LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category && categories.has(category)) {
    conditions.push('r.category=?');
    values.push(category);
  }
  if (location) {
    conditions.push('r.location LIKE ?');
    values.push(`%${location}%`);
  }
  const where = conditions.join(' AND ');
  const [[{ total }], [rows]] = await Promise.all([
    db.execute(`SELECT COUNT(*) total FROM client_project_requests r WHERE ${where}`, values),
    db.execute(
      `SELECT r.id,r.title,r.category,r.description,r.location,r.land_area,
         r.budget_min,r.budget_max,r.expected_timeline,r.preferred_style,r.created_at,
         u.id client_id,u.name client_name,u.profile_image client_image,
         (SELECT COUNT(*) FROM client_project_proposals p WHERE p.request_id=r.id AND p.architect_id=?) has_applied
       FROM client_project_requests r JOIN users u ON u.id=r.client_id
       WHERE ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, ...values, limit, offset]
    )
  ]);
  res.json(await signAssetUrls({ requests: rows, page, limit, total }));
};

exports.myRequests = async (req, res) => {
  const [rows] = await db.execute(
    `SELECT r.*,
       (SELECT COUNT(*) FROM client_project_proposals p WHERE p.request_id=r.id) proposal_count,
       (SELECT COUNT(*) FROM client_project_proposals p WHERE p.request_id=r.id AND p.status='SHORTLISTED') shortlisted_count
     FROM client_project_requests r WHERE r.client_id=? ORDER BY r.created_at DESC`,
    [req.user.id]
  );
  res.json(await signAssetUrls(rows));
};

exports.createRequest = async (req, res) => {
  const {
    title, category, description, location, land_area, budget_min, budget_max,
    expected_timeline, preferred_style
  } = req.body;
  const min = budget_min === '' || budget_min === undefined || budget_min === null ? null : Number(budget_min);
  const max = budget_max === '' || budget_max === undefined || budget_max === null ? null : Number(budget_max);
  if (typeof title !== 'string' || !title.trim() || title.length > 255 ||
      typeof description !== 'string' || !description.trim() || description.length > 10000 ||
      !categories.has(category)) {
    return res.status(400).json({ message: 'Project title, category, and description are required' });
  }
  if (!validDateText(location, 255) || !validDateText(land_area, 100) ||
      !validDateText(expected_timeline, 100) || !validDateText(preferred_style, 255)) {
    return res.status(400).json({ message: 'One or more project details exceed the allowed length' });
  }
  if ((min !== null && (!Number.isFinite(min) || min < 0 || min > 9999999999.99)) ||
      (max !== null && (!Number.isFinite(max) || max < 0 || max > 9999999999.99)) ||
      (min !== null && max !== null && max < min)) {
    return res.status(400).json({ message: 'Enter a valid budget range' });
  }
  if (req.files?.length > 5) return res.status(400).json({ message: 'You can attach up to five project files' });

  const conn = await db.getConnection();
  let requestId;
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO client_project_requests
       (client_id,title,category,description,location,land_area,budget_min,budget_max,expected_timeline,preferred_style)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        req.user.id, title.trim(), category, description.trim(), location?.trim() || null,
        land_area?.trim() || null, min, max, expected_timeline?.trim() || null,
        preferred_style?.trim() || null
      ]
    );
    requestId = result.insertId;
    for (const file of req.files || []) {
      const fileUrl = await upload(file, `project-requests/${requestId}`);
      await conn.execute(
        `INSERT INTO client_project_request_documents (request_id,file_url,file_name,mime_type,file_size)
         VALUES (?,?,?,?,?)`,
        [requestId, fileUrl, file.originalname.slice(0, 255), file.mimetype, file.size]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  res.status(201).json({ id: requestId, message: 'Project brief posted to the architect board' });
};

async function findRequest(requestId, user) {
  const [rows] = await db.execute(
    `SELECT r.*,u.name client_name,u.profile_image client_image
     FROM client_project_requests r JOIN users u ON u.id=r.client_id
     WHERE r.id=? AND (
       r.client_id=? OR r.status='OPEN' OR EXISTS(
         SELECT 1 FROM client_project_proposals p WHERE p.request_id=r.id AND p.architect_id=?
       )
     )`,
    [requestId, user.id, user.id]
  );
  return rows[0];
}

exports.detail = async (req, res) => {
  const projectRequest = await findRequest(req.params.id, req.user);
  if (!projectRequest) return res.status(404).json({ message: 'Project brief not found' });
  const [documents] = await db.execute(
    `SELECT id,file_url,file_name,mime_type,file_size,created_at
     FROM client_project_request_documents WHERE request_id=? ORDER BY created_at`,
    [req.params.id]
  );
  let proposals = [];
  let myProposal = null;
  if (req.user.role === 'CLIENT') {
    const [rows] = await db.execute(
      `SELECT p.id,p.architect_id,p.message,p.status,p.conversation_id,p.inquiry_id,p.created_at,
         u.name architect_name,u.profile_image architect_image,u.location architect_location,
         ap.firm_name,ap.experience_years,ap.specializations
       FROM client_project_proposals p JOIN users u ON u.id=p.architect_id
       LEFT JOIN architect_profiles ap ON ap.user_id=u.id
       WHERE p.request_id=? ORDER BY p.created_at DESC`,
      [req.params.id]
    );
    proposals = rows;
  } else {
    const [rows] = await db.execute(
      'SELECT id,message,status,conversation_id,created_at FROM client_project_proposals WHERE request_id=? AND architect_id=?',
      [req.params.id, req.user.id]
    );
    myProposal = rows[0] || null;
  }
  res.json(await signAssetUrls({ ...projectRequest, documents, proposals, my_proposal: myProposal }));
};

exports.submitProposal = async (req, res) => {
  const projectRequest = await findRequest(req.params.id, req.user);
  if (!projectRequest || projectRequest.status !== 'OPEN') {
    return res.status(404).json({ message: 'This project brief is closed or unavailable' });
  }
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 5000) {
    return res.status(400).json({ message: 'Introduce yourself and explain your approach (maximum 5000 characters)' });
  }
  const conn = await db.getConnection();
  let proposalId;
  let conversationId;
  try {
    await conn.beginTransaction();
    const [existing] = await conn.execute(
      'SELECT id FROM client_project_proposals WHERE request_id=? AND architect_id=?',
      [projectRequest.id, req.user.id]
    );
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ message: 'You have already responded to this project brief' });
    }
    const [inserted] = await conn.execute(
      'INSERT INTO client_project_proposals (request_id,architect_id,message) VALUES (?,?,?)',
      [projectRequest.id, req.user.id, message]
    );
    proposalId = inserted.insertId;
    const [conversation] = await conn.execute(
      "INSERT INTO conversations (conversation_type,reference_id) VALUES ('CLIENT_PROJECT_PROPOSAL',?)",
      [proposalId]
    );
    conversationId = conversation.insertId;
    await conn.execute(
      'INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?),(?,?)',
      [conversationId, req.user.id, conversationId, projectRequest.client_id]
    );
    await conn.execute('UPDATE client_project_proposals SET conversation_id=? WHERE id=?', [conversationId, proposalId]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'You have already responded to this project brief' });
    throw error;
  } finally {
    conn.release();
  }
  await notify(projectRequest.client_id, 'Architect interested in your project', 'An architect responded to your project brief.', 'PROJECT_PROPOSAL', projectRequest.id);
  res.status(201).json({ id: proposalId, conversation_id: conversationId, message: 'Your introduction was sent to the client' });
};

exports.updateProposal = async (req, res) => {
  const status = req.body.status;
  if (!['SHORTLISTED', 'REJECTED', 'ACCEPTED'].includes(status)) {
    return res.status(400).json({ message: 'Choose shortlist, reject, or accept' });
  }
  const conn = await db.getConnection();
  let proposal;
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      `SELECT p.*,r.client_id,r.title,r.category,r.description,r.location,r.land_area,
         r.budget_min,r.budget_max,r.expected_timeline,r.preferred_style,r.status request_status
       FROM client_project_proposals p
       JOIN client_project_requests r ON r.id=p.request_id
       WHERE p.id=? AND p.request_id=? AND r.client_id=? FOR UPDATE`,
      [req.params.proposalId, req.params.id, req.user.id]
    );
    proposal = rows[0];
    if (!proposal) {
      await conn.rollback();
      return res.status(404).json({ message: 'Proposal not found' });
    }
    if (proposal.request_status !== 'OPEN' || ['ACCEPTED', 'REJECTED'].includes(proposal.status)) {
      await conn.rollback();
      return res.status(409).json({ message: 'This project brief or proposal is already closed' });
    }
    if (status === 'ACCEPTED') {
      await conn.execute(
        `INSERT INTO project_inquiries
         (client_id,architect_id,title,category,description,budget,budget_min,budget_max,location,land_area,expected_timeline,preferred_style,status,conversation_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'ACCEPTED',?)`,
        [
          proposal.client_id, proposal.architect_id, proposal.title, proposal.category,
          proposal.description, proposal.budget_max ?? proposal.budget_min,
          proposal.budget_min, proposal.budget_max, proposal.location, proposal.land_area,
          proposal.expected_timeline, proposal.preferred_style, proposal.conversation_id
        ]
      );
      const [inquiry] = await conn.execute('SELECT LAST_INSERT_ID() inquiry_id');
      const [project] = await conn.execute(
        `INSERT INTO client_projects (inquiry_id,client_id,architect_id,title,category,location)
         VALUES (?,?,?,?,?,?)`,
        [inquiry[0].inquiry_id, proposal.client_id, proposal.architect_id, proposal.title, proposal.category, proposal.location]
      );
      await conn.execute(
        "UPDATE client_project_proposals SET status=IF(id=?,'ACCEPTED','REJECTED'),inquiry_id=IF(id=?, ?, inquiry_id) WHERE request_id=?",
        [proposal.id, proposal.id, inquiry[0].inquiry_id, proposal.request_id]
      );
      await conn.execute("UPDATE client_project_requests SET status='CLOSED' WHERE id=?", [proposal.request_id]);
      proposal.project_id = project.insertId;
    } else {
      await conn.execute('UPDATE client_project_proposals SET status=? WHERE id=?', [status, proposal.id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  if (status === 'ACCEPTED') {
    await notify(proposal.architect_id, 'Project proposal accepted', `The client accepted your proposal for "${proposal.title}".`, 'PROJECT_PROPOSAL', proposal.request_id);
  } else {
    await notify(proposal.architect_id, 'Project proposal updated', `Your proposal for "${proposal.title}" was ${status.toLowerCase()}.`, 'PROJECT_PROPOSAL', proposal.request_id);
  }
  res.json({ message: status === 'ACCEPTED' ? 'Proposal accepted and project created' : `Proposal ${status.toLowerCase()}` });
};

exports.closeRequest = async (req, res) => {
  const [result] = await db.execute(
    "UPDATE client_project_requests SET status='CLOSED' WHERE id=? AND client_id=? AND status='OPEN'",
    [req.params.id, req.user.id]
  );
  if (!result.affectedRows) return res.status(404).json({ message: 'Open project brief not found' });
  res.json({ message: 'Project brief closed' });
};
