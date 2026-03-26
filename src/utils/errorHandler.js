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
    return res.status(401).json({ message: 'Invalid token', code: 'UNAUTHORIZED' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Token expired', code: 'UNAUTHORIZED' });
  }

  if (err.code === '23505') {
    return res.status(409).json({
      message: 'A record with this value already exists',
      code: 'CONFLICT',
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      message: 'Invalid request parameter format',
      code: 'BAD_REQUEST',
    });
  }

  const response = {
    message: err.message || 'Internal Server Error',
  };

  const errors = err.errors || err.details;
  if (errors) {
    response.errors = errors;
  }

  if (err.code && !/^\d/.test(err.code)) {
    response.code = err.code;
  } else if (statusCode === 400) {
    response.code = 'BAD_REQUEST';
  } else if (statusCode === 401) {
    response.code = 'UNAUTHORIZED';
  } else if (statusCode === 403) {
    response.code = 'FORBIDDEN';
  } else if (statusCode === 404) {
    response.code = 'NOT_FOUND';
  } else if (statusCode === 409) {
    response.code = 'CONFLICT';
  } else if (statusCode === 422) {
    response.code = 'VALIDATION_ERROR';
  } else if (statusCode >= 500) {
    response.code = 'INTERNAL_ERROR';
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
