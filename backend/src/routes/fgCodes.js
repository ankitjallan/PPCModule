const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { customer_id, search } = req.query;
    const params = [];
    const conditions = ['f.is_active = TRUE'];

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`f.customer_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(f.fg_code ILIKE $${params.length} OR f.description ILIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT f.id, f.fg_code, f.description, f.fg_type, f.is_active, f.created_at,
              c.id AS customer_id, c.name AS customer_name, c.code AS customer_code
       FROM fg_codes f
       LEFT JOIN customers c ON f.customer_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY f.fg_code`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch FG codes' });
  }
});

router.post('/', authorize('admin', 'ppc_planner', 'sales'), async (req, res) => {
  try {
    const { fg_code, description, customer_id, fg_type } = req.body;
    if (!fg_code) return res.status(400).json({ error: 'FG code is required' });

    const existing = await pool.query('SELECT id FROM fg_codes WHERE UPPER(fg_code) = UPPER($1)', [fg_code]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'FG code already exists' });

    const result = await pool.query(
      'INSERT INTO fg_codes (fg_code, description, customer_id, fg_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [fg_code.toUpperCase(), description, customer_id, fg_type]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create FG code' });
  }
});

router.put('/:id', authorize('admin', 'ppc_planner', 'sales'), async (req, res) => {
  try {
    const { description, customer_id, fg_type, is_active } = req.body;
    const result = await pool.query(
      `UPDATE fg_codes SET
         description = COALESCE($1, description),
         customer_id = COALESCE($2, customer_id),
         fg_type = COALESCE($3, fg_type),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [description, customer_id, fg_type, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'FG code not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update FG code' });
  }
});

module.exports = router;
