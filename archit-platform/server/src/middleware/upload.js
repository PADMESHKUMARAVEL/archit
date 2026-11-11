const path = require('path');
const multer = require('multer');
const { required } = require('../config/env');

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const documentExtensions = new Set(['.pdf', '.doc', '.docx', '.txt']);
const documentMimeTypes = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);
const maxBytes = Number(required('MAX_UPLOAD_MB')) * 1024 * 1024;

function createUpload(allowDocuments = false) {
  return multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    // Some browsers report local files as application/octet-stream. The
    // extension is preserved server-side, so accept that generic MIME type
    // for one of our explicit allow-listed extensions.
    const genericMimeType = file.mimetype === 'application/octet-stream' || !file.mimetype;
    const isImage = imageExtensions.has(extension) && (imageMimeTypes.has(file.mimetype) || genericMimeType);
    const isDocument = allowDocuments && documentExtensions.has(extension) && (documentMimeTypes.has(file.mimetype) || genericMimeType);
    if (!isImage && !isDocument) {
      const error = new Error(allowDocuments
        ? 'Only JPG, PNG, WEBP, GIF, PDF, DOC, DOCX, and TXT files are allowed'
        : 'Only JPG, PNG, WEBP, and GIF images are allowed');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  }
  });
}

module.exports = {
  image: createUpload(),
  postAttachment: createUpload(true)
};
