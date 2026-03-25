const ApiError = require('./apiError');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const requestInfo = `${req.method} ${req.originalUrl}`;

  console.error(`[${new Date().toISOString()}] ${requestInfo}`);
  console.error(err.stack || err);

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired' });
  }

  if (err.code === '23505') {
    return res.status(409).json({ message: 'A record with this value already exists' });
  }

  const response = {
    message: err.message || 'Internal Server Error',
  };

  if (err instanceof ApiError && err.details) {
    response.details = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  notFound,
  errorHandler,
};
