function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}
function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'The uploaded file is too large' });
  }
  res.status(err.status || 500).json({
    message: err.status ? err.message : 'Internal server error'
  });
}
module.exports = { notFound, errorHandler };
