class ApiError extends Error {
  constructor(statusCode, message, errors = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.details = errors;
    this.code = code;
  }
}

module.exports = ApiError;
