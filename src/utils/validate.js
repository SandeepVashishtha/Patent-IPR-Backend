const ApiError = require('./apiError');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return next(new ApiError(400, 'Validation failed', details));
  }

  req.body = result.data;
  return next();
};

module.exports = validate;
