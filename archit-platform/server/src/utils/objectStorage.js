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
  'resume_url',
  'cover_image'
]);

let client;

function getClient() {
  if (!client) {
    client = new S3Client({
      region: required('STORAGE_REGION'),
      endpoint: required('STORAGE_ENDPOINT'),
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
  if (typeof value !== 'string' || !value.startsWith('object://')) return value;
  const key = value.slice('object://'.length);
  if (!key || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid R2 asset key');
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
