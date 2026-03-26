const { z } = require('zod');
const ApiError = require('../utils/apiError');

const PATENT_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'];

const emptyToUndefined = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const normalizeMobile = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.replace(/\D/g, '');
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

const filingBaseSchema = z.object({
  title: z
    .preprocess(emptyToUndefined, z.string().min(1, 'title is required').max(300, 'title max length is 300'))
    .optional(),
  fieldOfInvention: z
    .preprocess(emptyToUndefined, z.string().min(1, 'fieldOfInvention is required').max(120))
    .optional(),
  fieldOfInventionOther: z.preprocess(emptyToUndefined, z.string().max(255)).optional(),
  abstractText: z
    .preprocess(
      emptyToUndefined,
      z.string().min(1, 'abstractText is required').max(5000, 'abstractText max length is 5000')
    )
    .optional(),
  applicantName: z
    .preprocess(
      emptyToUndefined,
      z.string().min(1, 'applicantName is required').max(120, 'applicantName max length is 120')
    )
    .optional(),
  applicantEmail: z
    .preprocess(emptyToUndefined, z.string().email('Invalid email format').max(255))
    .transform((value) => value.toLowerCase())
    .optional(),
  applicantMobile: z
    .preprocess(normalizeMobile, z.string().min(10, 'applicantMobile must be at least 10 digits').max(15))
    .optional(),
  supportingDocumentUrl: z.preprocess(emptyToUndefined, z.string().url('supportingDocumentUrl must be a valid URL')).optional(),
  estimation: z
    .object({
      total: z.number().finite().nonnegative(),
      currency: z.string().trim().min(1).max(16).optional().default('INR'),
      selections: z.array(z.string().trim().min(1)).optional().default([]),
    })
    .optional(),
});

const createPatentFilingSchema = filingBaseSchema
  .extend({
    saveAsDraft: z.preprocess(normalizeBoolean, z.boolean()).optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.fieldOfInvention === 'Other' && !value.fieldOfInventionOther) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fieldOfInventionOther'],
        message: 'fieldOfInventionOther is required when fieldOfInvention is Other',
      });
    }

    if (value.saveAsDraft) {
      return;
    }

    const requiredFields = [
      'title',
      'abstractText',
      'applicantName',
      'applicantEmail',
      'applicantMobile',
      'fieldOfInvention',
    ];

    requiredFields.forEach((field) => {
      if (!value[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} is required`,
        });
      }
    });
  });

const updatePatentFilingSchema = filingBaseSchema.superRefine((value, ctx) => {
  if (value.fieldOfInvention === 'Other' && !value.fieldOfInventionOther) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fieldOfInventionOther'],
      message: 'fieldOfInventionOther is required when fieldOfInvention is Other',
    });
  }
});

const uploadDocumentSchema = z.object({
  supportingDocumentUrl: z
    .preprocess(emptyToUndefined, z.string().url('supportingDocumentUrl must be a valid URL')),
});

const presignRequestSchema = z.object({
  fileName: z.preprocess(emptyToUndefined, z.string().min(1).max(255)).optional().default('supporting-document'),
  contentType: z.preprocess(emptyToUndefined, z.string().min(1).max(120)).optional().default('application/octet-stream'),
});

const listFilingsQuerySchema = z.object({
  page: z.preprocess((value) => normalizeNumber(value, 0), z.number().int().min(0)).default(0),
  size: z.preprocess((value) => normalizeNumber(value, 10), z.number().int().min(1).max(100)).default(10),
  sort: z
    .preprocess(emptyToUndefined, z.string())
    .optional()
    .default('submittedAt,desc'),
  status: z.enum(PATENT_STATUSES).optional(),
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

const parseLegacySubmitPayload = (req) =>
  parseWithValidationError(
    z
      .object({
        title: z.string().trim().min(1).max(300),
        fieldOfInvention: z.string().trim().min(1).max(120),
        fieldOfInventionOther: z.preprocess(emptyToUndefined, z.string().trim().max(255)).optional(),
        abstractText: z.string().trim().min(1).max(5000),
        applicantName: z.string().trim().min(1).max(120),
        applicantEmail: z
          .string()
          .trim()
          .email('Invalid email format')
          .transform((value) => value.toLowerCase()),
        applicantMobile: z.preprocess(normalizeMobile, z.string().min(10).max(15)),
        supportingDocumentUrl: z.preprocess(
          emptyToUndefined,
          z.string().url('supportingDocument must be a valid URL')
        ),
      })
      .superRefine((value, ctx) => {
        if (value.fieldOfInvention === 'Other' && !value.fieldOfInventionOther) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fieldOfInventionOther'],
            message: 'fieldOfInventionOther is required when fieldOfInvention is Other',
          });
        }
      }),
    {
      title: req.query.title,
      fieldOfInvention: req.query.fieldOfInvention,
      fieldOfInventionOther: req.query.fieldOfInventionOther,
      abstractText: req.query.abstract || req.query.abstractText,
      applicantName: req.query.applicantName,
      applicantEmail: req.query.applicantEmail,
      applicantMobile: req.query.applicantMobile,
      supportingDocumentUrl: req.body.supportingDocument || req.body.supportingDocumentUrl,
    }
  );

module.exports = {
  PATENT_STATUSES,
  createPatentFilingSchema,
  updatePatentFilingSchema,
  uploadDocumentSchema,
  presignRequestSchema,
  parseListFilingsQuery,
  parseLegacySubmitPayload,
};
