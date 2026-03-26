const { z } = require('zod');
const ApiError = require('../utils/apiError');
const {
  NON_PATENT_TYPES,
  NON_PATENT_STATUSES,
  NON_PATENT_TYPE_CONFIG,
} = require('./nonPatentFiling.constants');

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

const normalizeYear = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }
  return value;
};

const hasValue = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
};

const requiredString = (field, max = 255) =>
  z.preprocess(
    emptyToUndefined,
    z.string().min(1, `${field} is required`).max(max, `${field} max length is ${max}`)
  );

const currentYear = new Date().getUTCFullYear();

const trademarkBaseSchema = z.object({
  trademarkName: requiredString('trademarkName', 255).optional(),
  classOfTrademark: requiredString('classOfTrademark', 120).optional(),
  descriptionGoodsServices: requiredString('descriptionGoodsServices', 5000).optional(),
  usageStatus: requiredString('usageStatus', 120).optional(),
  dateOfFirstUse: requiredString('dateOfFirstUse', 32).optional(),
  applicantName: requiredString('applicantName', 120).optional(),
  applicantType: requiredString('applicantType', 80).optional(),
  address: requiredString('address', 500).optional(),
  trademarkLogo: z
    .preprocess(emptyToUndefined, z.string().url('trademarkLogo must be a valid URL'))
    .optional(),
});

const copyrightBaseSchema = z.object({
  workType: requiredString('workType', 120).optional(),
  titleOfWork: requiredString('titleOfWork', 255).optional(),
  authorDetails: z
    .union([
      z.preprocess(emptyToUndefined, z.string().min(1, 'authorDetails is required').max(5000)),
      z.record(z.any()),
    ])
    .optional(),
  yearOfCreation: z
    .preprocess(normalizeYear, z.number().int().min(1000).max(currentYear + 1))
    .optional(),
  applicantName: requiredString('applicantName', 120).optional(),
  address: requiredString('address', 500).optional(),
  workFile: z.preprocess(emptyToUndefined, z.string().url('workFile must be a valid URL')).optional(),
});

const designBaseSchema = z.object({
  articleName: requiredString('articleName', 255).optional(),
  locarnoClass: requiredString('locarnoClass', 120).optional(),
  briefDescription: requiredString('briefDescription', 5000).optional(),
  applicantName: requiredString('applicantName', 120).optional(),
  address: requiredString('address', 500).optional(),
  representationOfDesign: z
    .preprocess(emptyToUndefined, z.string().url('representationOfDesign must be a valid URL'))
    .optional(),
});

const createSchema = (baseSchema, requiredFields) =>
  baseSchema
    .extend({
      saveAsDraft: z.preprocess(normalizeBoolean, z.boolean()).optional().default(false),
    })
    .superRefine((value, ctx) => {
      if (value.saveAsDraft) {
        return;
      }

      requiredFields.forEach((field) => {
        if (!hasValue(value[field])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required`,
          });
        }
      });
    });

const createSchemas = {
  [NON_PATENT_TYPES.TRADEMARK]: createSchema(
    trademarkBaseSchema,
    NON_PATENT_TYPE_CONFIG[NON_PATENT_TYPES.TRADEMARK].requiredFields
  ),
  [NON_PATENT_TYPES.COPYRIGHT]: createSchema(
    copyrightBaseSchema,
    NON_PATENT_TYPE_CONFIG[NON_PATENT_TYPES.COPYRIGHT].requiredFields
  ),
  [NON_PATENT_TYPES.DESIGN]: createSchema(
    designBaseSchema,
    NON_PATENT_TYPE_CONFIG[NON_PATENT_TYPES.DESIGN].requiredFields
  ),
};

const updateSchemas = {
  [NON_PATENT_TYPES.TRADEMARK]: trademarkBaseSchema,
  [NON_PATENT_TYPES.COPYRIGHT]: copyrightBaseSchema,
  [NON_PATENT_TYPES.DESIGN]: designBaseSchema,
};

const uploadSchemas = {
  [NON_PATENT_TYPES.TRADEMARK]: z.object({
    trademarkLogo: z.preprocess(emptyToUndefined, z.string().url('trademarkLogo must be a valid URL')),
  }),
  [NON_PATENT_TYPES.COPYRIGHT]: z.object({
    workFile: z.preprocess(emptyToUndefined, z.string().url('workFile must be a valid URL')),
  }),
  [NON_PATENT_TYPES.DESIGN]: z.object({
    representationOfDesign: z.preprocess(
      emptyToUndefined,
      z.string().url('representationOfDesign must be a valid URL')
    ),
  }),
};

const listFilingsQuerySchema = z.object({
  page: z.preprocess((value) => normalizeNumber(value, 0), z.number().int().min(0)).default(0),
  size: z.preprocess((value) => normalizeNumber(value, 10), z.number().int().min(1).max(100)).default(10),
  sort: z.preprocess(emptyToUndefined, z.string()).optional().default('submittedAt,desc'),
  status: z.enum(NON_PATENT_STATUSES).optional(),
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

const parseListFilingsQuery = (query) => parseWithValidationError(listFilingsQuerySchema, query);

const getCreateFilingSchema = (filingType) => createSchemas[filingType];
const getUpdateFilingSchema = (filingType) => updateSchemas[filingType];
const getUploadDocumentSchema = (filingType) => uploadSchemas[filingType];

module.exports = {
  NON_PATENT_STATUSES,
  parseListFilingsQuery,
  getCreateFilingSchema,
  getUpdateFilingSchema,
  getUploadDocumentSchema,
};
