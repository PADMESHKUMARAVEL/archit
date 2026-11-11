const fs = require('fs/promises');
const path = require('path');
const db = require('../src/config/db');
const { upload } = require('../src/utils/objectStorage');

const assets = [
  ['users', 'id', 'profile_image', 'profiles'],
  ['student_profiles', 'user_id', 'resume_url', 'applications'],
  ['post_media', 'id', 'media_url', 'posts'],
  ['portfolio_projects', 'id', 'cover_image', 'portfolio'],
  ['portfolio_media', 'id', 'media_url', 'portfolio'],
  ['job_applications', 'id', 'resume_url', 'applications'],
  ['messages', 'id', 'attachment_url', 'chat'],
  ['enquiry_documents', 'id', 'file_url', 'enquiries'],
  ['project_documents', 'id', 'file_url', 'projects'],
  ['client_project_request_documents', 'id', 'file_url', 'project-requests']
];

const mimeTypes = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain'
};

function localUploadName(value) {
  if (typeof value !== 'string' || value.startsWith('object://')) return null;
  let pathname;
  try {
    pathname = new URL(value, 'http://local-asset.invalid').pathname;
  } catch {
    return null;
  }
  const isLocalOrigin = value.startsWith('/') || value.startsWith('uploads/') ||
    /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//i.test(value);
  if (!isLocalOrigin) return null;
  const match = pathname.match(/\/uploads\/([^/]+)$/i);
  if (!match || match[1] === '.' || match[1] === '..') return null;
  return path.basename(decodeURIComponent(match[1]));
}

function isMissingSchemaError(error) {
  return error.code === 'ER_NO_SUCH_TABLE' || error.code === 'ER_BAD_FIELD_ERROR';
}

async function findLegacyAssets() {
  const found = [];
  for (const [table, primaryKey, column, folder] of assets) {
    let rows;
    try {
      [rows] = await db.execute(
        `SELECT \`${primaryKey}\` AS id, \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` LIKE '%localhost%' OR \`${column}\` LIKE '%127.0.0.1%' OR \`${column}\` LIKE '%/uploads/%' OR \`${column}\` LIKE 'uploads/%'`
      );
    } catch (error) {
      if (isMissingSchemaError(error)) continue;
      throw error;
    }

    for (const row of rows) {
      const fileName = localUploadName(row.value);
      if (!fileName) continue;
      const extension = path.extname(fileName).toLowerCase();
      if (!mimeTypes[extension]) {
        throw new Error(`Unsupported legacy upload extension in ${table}.${column}`);
      }
      found.push({ table, primaryKey, column, folder, id: row.id, oldUrl: row.value, fileName, extension });
    }
  }
  return found;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allowRemote = process.argv.includes('--allow-remote');
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (apply && !localHosts.has(String(process.env.DB_HOST || '').toLowerCase()) && !allowRemote) {
    throw new Error('Refusing to update a non-local database. Pass --allow-remote only when intentional.');
  }

  const localUploadDirectory = path.resolve(__dirname, '..', 'uploads');
  const legacyAssets = await findLegacyAssets();
  const ready = [];
  for (const asset of legacyAssets) {
    try {
      const filePath = path.join(localUploadDirectory, asset.fileName);
      const buffer = await fs.readFile(filePath);
      ready.push({ ...asset, buffer });
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`A referenced local upload is missing (${asset.table}.${asset.column}, row ${asset.id}). No assets were migrated.`);
      }
      throw error;
    }
  }

  console.log(`${apply ? 'Apply mode' : 'Dry run'}: ${ready.length} legacy upload(s) are available locally.`);
  for (const [table, column] of [...new Set(ready.map(asset => [`${asset.table}`, `${asset.column}`].join('.')))].map(key => key.split('.'))) {
    console.log(`  ${table}.${column}: ${ready.filter(asset => asset.table === table && asset.column === column).length}`);
  }
  if (!apply) {
    console.log('No changes made. Run with --apply to upload these files to Supabase and update their database references.');
    return;
  }

  for (const asset of ready) {
    const storedUrl = await upload({
      originalname: asset.fileName,
      mimetype: mimeTypes[asset.extension],
      buffer: asset.buffer
    }, asset.folder);
    const [result] = await db.execute(
      `UPDATE \`${asset.table}\` SET \`${asset.column}\`=? WHERE \`${asset.primaryKey}\`=? AND \`${asset.column}\`=?`,
      [storedUrl, asset.id, asset.oldUrl]
    );
    if (result.affectedRows !== 1) {
      throw new Error(`Uploaded asset was not linked to ${asset.table}.${asset.column}, row ${asset.id}. Check the database record before retrying.`);
    }
    console.log(`Migrated ${asset.table}.${asset.column}, row ${asset.id}`);
  }
  console.log('Migration complete. Local source files were left untouched.');
}

main()
  .catch(error => {
    console.error(`Legacy upload migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => db.end());
