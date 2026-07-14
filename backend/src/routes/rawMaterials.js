const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const n = (v) => (v === '' || v === undefined ? null : v);

// GET /api/raw-materials
router.get('/', async (req, res) => {
  try {
    const { type, subtype, search } = req.query;
    const params = [];
    const conditions = ['is_active = TRUE'];

    if (type) {
      params.push(type);
      conditions.push(`item_type = $${params.length}`);
    }
    if (subtype) {
      params.push(subtype);
      conditions.push(`item_subtype = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(item_code ILIKE $${params.length} OR item_name ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await pool.query(
      `SELECT id, item_code, item_name, item_type, item_subtype, gsm, width_mm, micron, uom, supplier, created_at
       FROM raw_materials ${where} ORDER BY item_name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get raw materials error:', err);
    res.status(500).json({ error: 'Failed to fetch raw materials' });
  }
});

// POST /api/raw-materials
router.post('/', authorize('admin', 'store_inventory', 'ppc_planner'), async (req, res) => {
  try {
    const { item_code, item_name, item_type, item_subtype, gsm, width_mm, micron, uom, supplier } = req.body;
    if (!item_code || !item_name) {
      return res.status(400).json({ error: 'Item code and name are required' });
    }

    const existing = await pool.query('SELECT id FROM raw_materials WHERE UPPER(item_code) = UPPER($1)', [item_code]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Item code already exists' });
    }

    const result = await pool.query(
      `INSERT INTO raw_materials (item_code, item_name, item_type, item_subtype, gsm, width_mm, micron, uom, supplier)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [item_code.toUpperCase(), item_name, item_type, item_subtype, n(gsm), n(width_mm), n(micron), uom || 'KG', supplier]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create raw material error:', err);
    res.status(500).json({ error: 'Failed to create raw material' });
  }
});

// PUT /api/raw-materials/:id
router.put('/:id', authorize('admin', 'store_inventory', 'ppc_planner'), async (req, res) => {
  try {
    const { item_name, item_type, item_subtype, gsm, width_mm, micron, uom, supplier, is_active } = req.body;
    const result = await pool.query(
      `UPDATE raw_materials SET
         item_name = COALESCE($1, item_name),
         item_type = COALESCE($2, item_type),
         item_subtype = COALESCE($3, item_subtype),
         gsm = COALESCE($4, gsm),
         width_mm = COALESCE($5, width_mm),
         micron = COALESCE($6, micron),
         uom = COALESCE($7, uom),
         supplier = COALESCE($8, supplier),
         is_active = COALESCE($9, is_active),
         updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [item_name, item_type, item_subtype, n(gsm), n(width_mm), n(micron), uom, supplier, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Raw material not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update raw material error:', err);
    res.status(500).json({ error: 'Failed to update raw material' });
  }
});

module.exports = router;
