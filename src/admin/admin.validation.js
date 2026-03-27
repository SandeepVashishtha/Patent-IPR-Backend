const { z } = require('zod');
const ApiError = require('../utils/apiError');

const ALLOWED_ADMIN_STATUSES = ['APPROVED', 'REJECTED'];
const LIST_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];
const FILING_TYPES = ['patent', 'nonPatent'];

const emptyToUndefined = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const normalizeBoolean = (value) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return false;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const normalizeNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) {
    return value;
  }
  return asNumber;
};

const listAdminFilingsQuerySchema = z.object({
  page: z.preprocess((value) => normalizeNumber(value, 0), z.number().int().min(0)).default(0),
  size: z.preprocess((value) => normalizeNumber(value, 10), z.number().int().min(1).max(100)).default(10),
  status: z.enum(LIST_STATUSES).optional(),
  type: z.preprocess(emptyToUndefined, z.enum(FILING_TYPES)).optional(),
  unassigned: z.preprocess(normalizeBoolean, z.boolean()).optional().default(false),
});

const assignAgentSchema = z.object({
  agentId: z.preprocess(emptyToUndefined, z.string().uuid('agentId must be a valid UUID')),
});

const updateAdminDecisionSchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(ALLOWED_ADMIN_STATUSES)),
});

const parseWithValidationError = (schema, payload) => {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      422,
      'Validation failed',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
      'VALIDATION_ERROR'
    );
  }
  return parsed.data;
};

const parseAdminFilingsQuery = (query) => parseWithValidationError(listAdminFilingsQuerySchema, query);

module.exports = {
  assignAgentSchema,
  updateAdminDecisionSchema,
  parseAdminFilingsQuery,
};
