const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const ApiError = require('../utils/apiError');

const REGISTRABLE_ROLES = ['client', 'agent'];

const normalizeRegistrationRole = (role) => {
  if (REGISTRABLE_ROLES.includes(role)) {
    return role;
  }
  return 'client';
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, 'JWT secret is not configured');
  }

  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
});

const registerUser = async ({ name, email, password, role }) => {
  const normalizedRole = normalizeRegistrationRole(role);

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'Email already in use');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await db.query(
    `INSERT INTO users (name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, hashedPassword, normalizedRole]
  );

  return result.rows[0];
};

const loginUser = async ({ email, password }) => {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

  if (result.rows.length === 0) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const user = result.rows[0];
  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const token = createToken(user);

  return {
    token,
    user: sanitizeUser(user),
  };
};

const getUserById = async (id) => {
  const result = await db.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'User not found');
  }

  return result.rows[0];
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
};
