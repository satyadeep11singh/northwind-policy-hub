const logger = require('../services/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Internal server error';

  if (status >= 500) {
    logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error');
  }

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
