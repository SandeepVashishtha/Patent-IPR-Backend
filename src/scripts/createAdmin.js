require('dotenv').config();

const bcrypt = require('bcrypt');
const db = require('../config/db');

const [name, email, password] = process.argv.slice(2);

const createOrUpdateAdmin = async () => {
  if (!name || !email || !password) {
    console.log('Usage: npm run create-admin -- "Admin Name" admin@example.com StrongPassword123');
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email)
       DO UPDATE SET
         name = EXCLUDED.name,
         password = EXCLUDED.password,
         role = 'admin'
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hashedPassword]
    );

    console.log('Admin user created/updated successfully:');
    console.log(result.rows[0]);
  } catch (error) {
    console.error('Failed to create/update admin:', error.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
};

createOrUpdateAdmin();
