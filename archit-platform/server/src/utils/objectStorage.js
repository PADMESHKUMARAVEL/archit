const { randomUUID } = require('crypto');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { required } = require('../config/env');

const ASSET_FIELDS = new Set([
  'profile_image',
  'architect_image',
  'other_party_image',
  'media_url',
  'attachment_url',
  'file_url',
  'resume_url',
  'cover_image'
]);

let client;
let warnedLegacyLocalAsset = false;

function getClient() {
  if (!client) {
    const endpoint = required('STORAGE_ENDPOINT');
    let parsedEndpoint;
    try {
      parsedEndpoint = new URL(endpoint);
    } catch {
      throw new Error('STORAGE_ENDPOINT must be a valid Supabase Storage S3 URL');
    }
    if (parsedEndpoint.protocol !== 'https:' ||
        !parsedEndpoint.hostname.endsWith('.supabase.co') ||
        parsedEndpoint.pathname.replace(/\/+$/, '') !== '/storage/v1/s3') {
      throw new Error('STORAGE_ENDPOINT must use https://<project>.supabase.co/storage/v1/s3');
    }
    client = new S3Client({
      region: required('STORAGE_REGION'),
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: required('STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: required('STORAGE_SECRET_ACCESS_KEY')
      }
    });
  }
  return client;
}

function getBucket() {
  return required('STORAGE_BUCKET_NAME');
}

async function upload(file, folder) {
  if (!file?.buffer) throw new Error('An in-memory uploaded file is required');
  const extension = path.extname(file.originalname).toLowerCase();
  const key = `${folder}/${randomUUID()}${extension}`;

  await getClient().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || 'application/octet-stream',
    CacheControl: 'private, max-age=300'
  }));

  return `object://${key}`;
}

async function signUrl(value) {
  if (typeof value !== 'string') return value;
  if (/localhost|127\.0\.0\.1|\/uploads\//i.test(value)) {
    if (!warnedLegacyLocalAsset) {
      console.warn('A legacy localhost upload reference was found. That asset is unavailable until migrated to Supabase Storage.');
      warnedLegacyLocalAsset = true;
    }
    return null;
  }
  if (!value.startsWith('object://')) return value;
  const key = value.slice('object://'.length);
  if (!key || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid Supabase Storage object key');
  }
  const expiresIn = Number(process.env.STORAGE_URL_TTL_SECONDS || 3600);
  if (!Number.isInteger(expiresIn) || expiresIn < 60 || expiresIn > 604800) {
    throw new Error('STORAGE_URL_TTL_SECONDS must be an integer between 60 and 604800');
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn }
  );
}

async function signAssetUrls(value) {
  if (Array.isArray(value)) return Promise.all(value.map(signAssetUrls));
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const entries = await Promise.all(Object.entries(value).map(async ([key, item]) => [
    key,
    ASSET_FIELDS.has(key) ? await signUrl(item) : await signAssetUrls(item)
  ]));
  return Object.fromEntries(entries);
}

module.exports = { upload, signUrl, signAssetUrls };
