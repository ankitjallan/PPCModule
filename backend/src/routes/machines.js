const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/machines
router.get('/', async (req, res) => {
  try {
    const { process_category_id, is_active } = req.query;
    const params = [];
    const conditions = [];

    if (is_active !== 'all') {
      conditions.push('m.is_active = TRUE');
    }
    if (process_category_id) {
      params.push(process_category_id);
      conditions.push(`m.process_category_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT m.id, m.name, m.machine_code, m.speed_mpm, m.width_mm, m.is_active,
              pc.id AS process_category_id, pc.name AS process_category_name
       FROM machines m
       LEFT JOIN process_categories pc ON m.process_category_id = pc.id
       ${where}
       ORDER BY pc.sequence_order, m.name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get machines error:', err);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

// POST /api/machines
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, machine_code, process_category_id, speed_mpm, width_mm } = req.body;
    if (!name || !machine_code) {
      return res.status(400).json({ error: 'Name and machine code are required' });
    }

    const existing = await pool.query('SELECT id FROM machines WHERE UPPER(machine_code) = UPPER($1)', [machine_code]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Machine code already exists' });
    }

    const result = await pool.query(
      `INSERT INTO machines (name, machine_code, process_category_id, speed_mpm, width_mm)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, machine_code.toUpperCase(), process_category_id, speed_mpm || 0, width_mm || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create machine error:', err);
    res.status(500).json({ error: 'Failed to create machine' });
  }
});

// PUT /api/machines/:id
router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, process_category_id, speed_mpm, width_mm, is_active } = req.body;
    const result = await pool.query(
      `UPDATE machines SET
         name = COALESCE($1, name),
         process_category_id = COALESCE($2, process_category_id),
         speed_mpm = COALESCE($3, speed_mpm),
         width_mm = COALESCE($4, width_mm),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, process_category_id, speed_mpm, width_mm, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update machine' });
  }
});

module.exports = router;
