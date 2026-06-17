/**
 * Applies the schema SQL and sets correct admin password.
 * Safe to run multiple times (uses IF NOT EXISTS / ON CONFLICT).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

async function setup() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('Connected to database.');
  } catch (err) {
    console.error('Cannot connect to database:', err.message);
    console.error('Check DATABASE_URL in backend/.env:', process.env.DATABASE_URL);
    process.exit(1);
  }

  // Check if schema already applied
  const tableCheck = await client.query(
    `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`
  );

  if (tableCheck.rows[0].count === '0') {
    console.log('Applying schema...');
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/001_schema.sql'), 'utf8');
    try {
      await client.query(sql);
      console.log('Schema applied.');
    } catch (err) {
      console.error('Schema error:', err.message);
      // Non-fatal — may already be partially applied
    }
  } else {
    console.log('Schema already exists.');
  }

  // Always ensure admin password is correct
  const hash = await bcrypt.hash('Admin@1234', 10);

  const existing = await client.query(`SELECT id FROM users WHERE email = 'admin@mipl.com'`);
  if (existing.rows.length === 0) {
    const roleRes = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
    if (roleRes.rows.length > 0) {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role_id) VALUES ('System Administrator', 'admin@mipl.com', $1, $2)`,
        [hash, roleRes.rows[0].id]
      );
      console.log('Admin user created: admin@mipl.com / Admin@1234');
    }
  } else {
    await client.query(`UPDATE users SET password_hash = $1, is_active = true WHERE email = 'admin@mipl.com'`, [hash]);
    console.log('Admin password reset: admin@mipl.com / Admin@1234');
  }

  await client.end();
}

setup().catch(err => { console.error(err); process.exit(1); });
