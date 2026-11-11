const { required } = require('../src/config/env');
const db = require('../src/config/db');
const bcrypt = require('bcryptjs');

async function run() {
  const demoEmail = required('DEMO_EMAIL');
  const demoPassword = required('DEMO_PASSWORD');
  const studentPassword = required('STUDENT_TEST_PASSWORD');
  const architectPassword = required('ARCHITECT_TEST_PASSWORD');
  const clientPassword = required('CLIENT_TEST_PASSWORD');
  const passwordHashes = {
    STUDENT: await bcrypt.hash(studentPassword, 10),
    ARCHITECT: await bcrypt.hash(architectPassword, 10),
    CLIENT: await bcrypt.hash(clientPassword, 10)
  };
  const users = [
    ['Aarav Student','student1@archit.test','STUDENT','Architecture student exploring sustainable housing.','Coimbatore'],
    ['Meera Student','student2@archit.test','STUDENT','Interested in urban design and visualization.','Chennai'],
    ['Nila Student','student3@archit.test','STUDENT','Focused on heritage conservation and adaptive reuse.','Madurai'],
    ['Arun Architect','architect@archit.test','ARCHITECT','Registered architect focused on residential projects.','Coimbatore'],
    ['Divya Architect','architect2@archit.test','ARCHITECT','Interior architect specializing in workplace design.','Chennai'],
    ['Ravi Architect','architect3@archit.test','ARCHITECT','Architect working on sustainable public buildings.','Madurai'],
    ['Kavya Client','client@archit.test','CLIENT','Looking for a residential architect.','Coimbatore'],
    ['Sanjay Client','client2@archit.test','CLIENT','Planning a renovation and interior project.','Chennai'],
    ['Priya Client','client3@archit.test','CLIENT','Seeking an architect for a commercial workspace.','Madurai'],
    ['CIT User', demoEmail.toLowerCase(), 'STUDENT','Architecture student at CIT.','Coimbatore']
  ];
  const ids = {};
  for (const [name,email,role,bio,location] of users) {
    const [existing] = await db.execute('SELECT id FROM users WHERE email=?',[email]);
    let passwordHash = role === 'STUDENT' ? passwordHashes.STUDENT : passwordHashes[role];
    if (email === demoEmail.toLowerCase()) passwordHash = await bcrypt.hash(demoPassword, 10);
    if (existing.length) {
      ids[email] = existing[0].id;
      await db.execute('UPDATE users SET password_hash=? WHERE id=?', [passwordHash, existing[0].id]);
      continue;
    }
    const [r] = await db.execute(
      'INSERT INTO users (name,email,password_hash,role,bio,location) VALUES (?,?,?,?,?,?)',
      [name,email,passwordHash,role,bio,location]
    );
    ids[email] = r.insertId;
    if (role === 'STUDENT' || role === 'ARCHITECT') {
      const table = role === 'STUDENT' ? 'student_profiles' : 'architect_profiles';
      await db.execute(`INSERT INTO ${table} (user_id) VALUES (?)`,[r.insertId]);
    }
  }
  await db.execute('UPDATE users SET password_hash=? WHERE email=?', [await bcrypt.hash(demoPassword, 10), demoEmail.toLowerCase()]);
  await db.execute(
    'INSERT INTO student_profiles (user_id,college,degree,graduation_year,skills) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE college=VALUES(college)',
    [ids['student1@archit.test'],'CIT','B.Arch',2027,JSON.stringify(['AutoCAD','SketchUp','Revit'])]
  );
  await db.execute(
    'INSERT INTO student_profiles (user_id,college,degree,graduation_year,skills) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE college=VALUES(college)',
    [ids['student2@archit.test'],'Anna University','B.Arch',2028,JSON.stringify(['Rhino','Lumion','Urban Design'])]
  );
  await db.execute(
    'INSERT INTO architect_profiles (user_id,firm_name,experience_years,specializations) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE firm_name=VALUES(firm_name)',
    [ids['architect@archit.test'],'Arun Studio',7,JSON.stringify(['Residential','Sustainable Design','Interiors'])]
  );
  const [p] = await db.execute('SELECT id FROM posts WHERE user_id=? LIMIT 1',[ids['student1@archit.test']]);
  if (!p.length) await db.execute('INSERT INTO posts (user_id,content,visibility) VALUES (?,?,?)',
    [ids['student1@archit.test'],'Sharing an early concept for a climate-responsive courtyard home. Feedback welcome!','PUBLIC']);
  const [j] = await db.execute('SELECT id FROM job_posts WHERE architect_id=? LIMIT 1',[ids['architect@archit.test']]);
  if (!j.length) await db.execute(
    `INSERT INTO job_posts (architect_id,title,description,job_type,location,requirements,deadline)
     VALUES (?,?,?,?,?,?,DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
    [ids['architect@archit.test'],'Architectural Design Intern','Assist with concept design, drawings and 3D visualization.','INTERNSHIP','Coimbatore','AutoCAD or Revit; portfolio required.']
  );
  const [c] = await db.execute(
    `SELECT id FROM connections WHERE (requester_id=? AND receiver_id=?) OR (requester_id=? AND receiver_id=?)`,
    [ids['student1@archit.test'],ids['student2@archit.test'],ids['student2@archit.test'],ids['student1@archit.test']]
  );
  if (!c.length) await db.execute(
    "INSERT INTO connections (requester_id,receiver_id,status) VALUES (?,?, 'ACCEPTED')",
    [ids['student1@archit.test'],ids['student2@archit.test']]
  );
  const [conversation] = await db.execute(
    `SELECT c.id FROM conversations c
     JOIN conversation_participants first ON first.conversation_id=c.id AND first.user_id=?
     JOIN conversation_participants second ON second.conversation_id=c.id AND second.user_id=?
     WHERE c.conversation_type='CONNECTION' LIMIT 1`,
    [ids['student1@archit.test'],ids['student2@archit.test']]
  );
  if (!conversation.length) {
    const [connection] = await db.execute(
      `SELECT id FROM connections
       WHERE requester_id=? AND receiver_id=? AND status='ACCEPTED' LIMIT 1`,
      [ids['student1@archit.test'],ids['student2@archit.test']]
    );
    const [created] = await db.execute(
      "INSERT INTO conversations (conversation_type,reference_id) VALUES ('CONNECTION',?)",
      [connection[0].id]
    );
    await db.execute(
      'INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?),(?,?)',
      [created.insertId,ids['student1@archit.test'],created.insertId,ids['student2@archit.test']]
    );
  }
  console.log('Test seed complete.');
  console.log(`Students: ${studentPassword}`);
  console.log(`Architects: ${architectPassword}`);
  console.log(`Clients: ${clientPassword}`);
  console.log(`CIT demo: ${demoPassword}`);
}

run().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => db.end());
