const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const includeInactive = req.query.includeInactive === 'true';
    const params = [];
    const conditions = [];

    if (!includeInactive) {
      conditions.push('is_active = TRUE');
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT id, name, code, contact_person, email, phone, address, is_active, created_at
       FROM customers ${where} ORDER BY name`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers
router.post('/', authorize('admin', 'sales', 'ppc_planner'), async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    const existing = await pool.query('SELECT id FROM customers WHERE UPPER(code) = UPPER($1)', [code]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Customer code already exists' });
    }

    const result = await pool.query(
      `INSERT INTO customers (name, code, contact_person, email, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, code.toUpperCase(), contact_person, email, phone, address]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create customer error:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id
router.put('/:id', authorize('admin', 'sales', 'ppc_planner'), async (req, res) => {
  try {
    const { name, code, contact_person, email, phone, address, is_active } = req.body;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE customers SET
         name = COALESCE($1, name),
         code = COALESCE($2, code),
         contact_person = COALESCE($3, contact_person),
         email = COALESCE($4, email),
         phone = COALESCE($5, phone),
         address = COALESCE($6, address),
         is_active = COALESCE($7, is_active),
         updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, code, contact_person, email, phone, address, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update customer error:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE customers SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json({ message: 'Customer deactivated' });
  } catch (err) {
    console.error('Deactivate customer error:', err);
    res.status(500).json({ error: 'Failed to deactivate customer' });
  }
});

module.exports = router;
