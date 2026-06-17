const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const pool = require('../config/database');

const router = express.Router();

// All settings routes require admin
router.use(authenticate, authorize('admin'));

// GET /api/settings/data-stats — row counts before clearing
router.get('/data-stats', async (req, res) => {
  try {
    const tables = [
      'ptd_entries', 'machine_plan_jobs', 'machine_plans',
      'production_rm_allocation', 'production_stage_tracking', 'production_orders',
      'work_orders', 'sales_orders', 'spec_sheet_process', 'spec_sheet_cylinders',
      'spec_sheet_films', 'spec_sheets', 'fg_codes', 'stock', 'stock_imports',
      'raw_materials', 'machines', 'customers', 'audit_log',
    ];
    const counts = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*) FROM ${t}`);
      counts[t] = parseInt(r.rows[0].count);
    }
    res.json(counts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/settings/clear-test-data
// Clears all transactional + master data EXCEPT users, roles, shifts, process_categories
router.post('/clear-test-data', async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'CLEAR TEST DATA') {
    return res.status(400).json({ error: 'Confirmation text does not match' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tables = [
      'audit_log', 'export_layouts',
      'ptd_entries', 'machine_plan_jobs', 'machine_plans',
      'production_rm_allocation', 'production_stage_tracking', 'production_orders',
      'work_orders', 'sales_orders',
      'spec_sheet_process', 'spec_sheet_cylinders', 'spec_sheet_films', 'spec_sheets',
      'fg_codes', 'stock', 'stock_imports', 'raw_materials', 'machines', 'customers',
    ];
    for (const t of tables) {
      await client.query(`DELETE FROM ${t}`);
    }
    await client.query('COMMIT');
    res.json({ message: 'All test/client data cleared. System configuration (users, roles, shifts, process categories) preserved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Clear failed: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/settings/clear-all-data
// Clears EVERYTHING including users (except the requesting admin)
router.post('/clear-all-data', async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'CLEAR ALL DATA') {
    return res.status(400).json({ error: 'Confirmation text does not match' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tables = [
      'audit_log', 'export_layouts',
      'ptd_entries', 'machine_plan_jobs', 'machine_plans',
      'production_rm_allocation', 'production_stage_tracking', 'production_orders',
      'work_orders', 'sales_orders',
      'spec_sheet_process', 'spec_sheet_cylinders', 'spec_sheet_films', 'spec_sheets',
      'fg_codes', 'stock', 'stock_imports', 'raw_materials', 'machines', 'customers',
    ];
    for (const t of tables) {
      await client.query(`DELETE FROM ${t}`);
    }
    // Delete all users except the currently logged-in admin
    await client.query(`DELETE FROM users WHERE id != $1`, [req.user.id]);
    await client.query('COMMIT');
    res.json({ message: 'All data cleared. Only your admin account has been preserved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Clear failed: ' + err.message });
  } finally {
    client.release();
  }
});

// POST /api/settings/seed-test-data — trigger seed from UI
router.post('/seed-test-data', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    const scriptPath = path.join(__dirname, '../../scripts/seed-test-data.js');
    execSync(`node "${scriptPath}"`, {
      env: { ...process.env },
      timeout: 60000,
      stdio: 'pipe',
    });
    res.json({ message: 'Test data seeded successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Seed failed: ' + (err.stderr?.toString() || err.message) });
  }
});

module.exports = router;
