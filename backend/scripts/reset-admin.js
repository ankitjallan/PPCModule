require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function resetAdmin() {
  const password = process.argv[2] || 'Admin@1234';
  const hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = 'admin@mipl.com' RETURNING id, email`,
    [hash]
  );

  if (result.rows.length === 0) {
    // Insert if not exists
    const roleRes = await pool.query(`SELECT id FROM roles WHERE name = 'admin'`);
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role_id) VALUES ('System Administrator', 'admin@mipl.com', $1, $2)`,
      [hash, roleRes.rows[0].id]
    );
    console.log('Admin user created.');
  } else {
    console.log('Admin password updated for:', result.rows[0].email);
  }

  console.log(`Password set to: ${password}`);
  await pool.end();
}

resetAdmin().catch(err => { console.error(err); process.exit(1); });
