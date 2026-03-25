const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.string().trim().email('Invalid email').transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  role: z
    .preprocess(
      (value) =>
        typeof value === 'string' ? value.trim().toLowerCase() : undefined,
      z.enum(['client', 'agent', 'admin']).optional()
    )
    .optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  registerSchema,
  loginSchema,
};
