const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/sales-orders
router.get('/', async (req, res) => {
  try {
    const { status, customer_id, date_from, date_to, order_type, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`so.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id); conditions.push(`so.customer_id = $${params.length}`); }
    if (order_type) { params.push(order_type); conditions.push(`so.order_type = $${params.length}`); }
    if (date_from) { params.push(date_from); conditions.push(`so.delivery_date >= $${params.length}`); }
    if (date_to) { params.push(date_to); conditions.push(`so.delivery_date <= $${params.length}`); }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(so.so_number ILIKE $${params.length} OR so.job_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sales_orders so ${where}`, params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT so.id, so.so_number, so.job_name, so.order_type, so.qty_kg, so.qty_rolls,
              so.delivery_date, so.priority, so.status, so.so_date, so.remarks, so.created_at,
              c.id AS customer_id, c.name AS customer_name, c.code AS customer_code,
              f.id AS fg_code_id, f.fg_code, f.description AS fg_description,
              po.id AS production_order_id, po.status AS production_status
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       LEFT JOIN production_orders po ON so.id = po.sales_order_id
       ${where}
       ORDER BY so.delivery_date ASC, so.priority DESC, so.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get sales orders error:', err);
    res.status(500).json({ error: 'Failed to fetch sales orders' });
  }
});

// POST /api/sales-orders
router.post('/', authorize('admin', 'sales', 'ppc_planner'), async (req, res) => {
  try {
    const { customer_id, fg_code_id, job_name, order_type, qty_kg, qty_rolls,
            delivery_date, priority, remarks } = req.body;

    if (!customer_id || !fg_code_id || !qty_kg || !delivery_date) {
      return res.status(400).json({ error: 'Customer, FG code, quantity and delivery date are required' });
    }

    // Generate SO number
    const year = new Date().getFullYear();
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sales_orders WHERE EXTRACT(YEAR FROM created_at) = $1`, [year]
    );
    const seq = parseInt(countResult.rows[0].count) + 1;
    const soNumber = `SO-${year}-${String(seq).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO sales_orders
         (so_number, customer_id, fg_code_id, job_name, order_type, qty_kg, qty_rolls,
          delivery_date, priority, remarks, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [soNumber, customer_id, fg_code_id, job_name, order_type || 'NEW',
       qty_kg, qty_rolls === '' ? null : qty_rolls, delivery_date, priority || 'NORMAL', remarks, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create sales order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create sales order' });
  }
});

// GET /api/sales-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.*, c.name AS customer_name, c.code AS customer_code,
              f.fg_code, f.description AS fg_description,
              po.id AS production_order_id, po.status AS production_status,
              u.name AS created_by_name
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       LEFT JOIN production_orders po ON so.id = po.sales_order_id
       LEFT JOIN users u ON so.created_by = u.id
       WHERE so.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get sales order error:', err);
    res.status(500).json({ error: 'Failed to fetch sales order' });
  }
});

// PUT /api/sales-orders/:id
router.put('/:id', authorize('admin', 'sales', 'ppc_planner'), async (req, res) => {
  try {
    const { job_name, qty_kg, qty_rolls, delivery_date, priority, remarks } = req.body;
    const result = await pool.query(
      `UPDATE sales_orders SET
         job_name = COALESCE($1, job_name),
         qty_kg = COALESCE($2, qty_kg),
         qty_rolls = COALESCE($3, qty_rolls),
         delivery_date = COALESCE($4, delivery_date),
         priority = COALESCE($5, priority),
         remarks = COALESCE($6, remarks),
         updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [job_name, qty_kg === '' ? null : qty_kg, qty_rolls === '' ? null : qty_rolls,
       delivery_date, priority, remarks, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update sales order error:', err);
    res.status(500).json({ error: err.message || 'Failed to update sales order' });
  }
});

// PATCH /api/sales-orders/:id/status
router.patch('/:id/status', authorize('admin', 'ppc_planner'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const result = await pool.query(
      'UPDATE sales_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sales order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update sales order status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
