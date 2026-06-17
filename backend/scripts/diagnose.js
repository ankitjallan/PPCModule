require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function diagnose() {
  console.log('\n=== MIPL PPC Diagnostics ===\n');
  console.log('DATABASE_URL:', process.env.DATABASE_URL || 'NOT SET');

  // 1. Test DB connection
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ DB connection OK:', res.rows[0].now);
  } catch (err) {
    console.error('❌ DB connection FAILED:', err.message);
    console.log('\nFix: Make sure PostgreSQL is running and DATABASE_URL in backend/.env is correct.');
    process.exit(1);
  }

  // 2. Check if roles table exists
  try {
    const res = await pool.query(`SELECT COUNT(*) FROM roles`);
    console.log('✅ roles table exists, rows:', res.rows[0].count);
  } catch {
    console.error('❌ roles table missing — schema not applied.');
    console.log('Fix: Run backend/migrations/001_schema.sql in your PostgreSQL database.');
    process.exit(1);
  }

  // 3. Check if admin user exists
  try {
    const res = await pool.query(`SELECT id, email, password_hash, is_active FROM users WHERE email = 'admin@mipl.com'`);
    if (res.rows.length === 0) {
      console.error('❌ Admin user not found in DB.');
      console.log('Fix: Re-run the schema SQL or run: node scripts/reset-admin.js');
    } else {
      const user = res.rows[0];
      console.log('✅ Admin user found:', user.email, '| active:', user.is_active);

      // 4. Test password hash
      const match = await bcrypt.compare('Admin@1234', user.password_hash);
      if (match) {
        console.log('✅ Password hash matches "Admin@1234" — login should work!');
      } else {
        console.error('❌ Password hash does NOT match "Admin@1234".');
        console.log('   Stored hash:', user.password_hash);
        console.log('   Fix: Run: node scripts/reset-admin.js');
      }
    }
  } catch (err) {
    console.error('❌ Error checking users table:', err.message);
  }

  // 5. Test what backend actually returns for login
  const http = require('http');
  const body = JSON.stringify({ email: 'admin@mipl.com', password: 'Admin@1234' });
  const options = {
    hostname: 'localhost', port: process.env.PORT || 5000, path: '/api/auth/login',
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  console.log('\nTesting live login endpoint...');
  await new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Login endpoint returned 200 — login is working!');
        } else {
          console.error(`❌ Login endpoint returned ${res.statusCode}:`, data);
        }
        resolve();
      });
    });
    req.on('error', (e) => {
      console.error('❌ Could not reach backend at port', process.env.PORT || 5000, '—', e.message);
      console.log('   Fix: Make sure the backend is running first.');
      resolve();
    });
    req.write(body);
    req.end();
  });

  console.log('\n=== Done ===\n');
  await pool.end();
}

diagnose().catch(err => { console.error(err); process.exit(1); });
