const ApiError = require('./apiError');

const validate = (schema, options = {}) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  const statusCode = options.statusCode || 400;
  const code = options.code || 'VALIDATION_ERROR';

  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return next(new ApiError(statusCode, 'Validation failed', errors, code));
  }

  req.body = result.data;
  return next();
};

module.exports = validate;
