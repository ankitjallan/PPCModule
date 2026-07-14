const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /api/ptd/entries
router.post('/entries', authorize('admin', 'ppc_planner', 'machine_operator'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { entries } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Entries array is required' });
    }

    const inserted = [];

    for (const entry of entries) {
      const {
        production_order_id, stage, machine_id, shift_no,
        entry_date, actual_output_kg, actual_output_km, waste_kg, operator_name, remarks
      } = entry;

      if (!production_order_id || !stage) {
        continue;
      }

      // Insert PTD entry
      const result = await client.query(
        `INSERT INTO ptd_entries
           (production_order_id, stage, machine_id, shift_no, entry_date,
            actual_output_kg, actual_output_km, waste_kg, operator_name, remarks, entered_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [production_order_id, stage, machine_id === '' ? null : machine_id, shift_no === '' ? null : shift_no,
         entry_date || new Date().toISOString().split('T')[0],
         actual_output_kg || 0, actual_output_km || 0, waste_kg || 0,
         operator_name, remarks, req.user.id]
      );
      inserted.push(result.rows[0]);

      // Update production_stage_tracking
      await client.query(
        `UPDATE production_stage_tracking
         SET ptd_kg = ptd_kg + $1,
             ptd_km = ptd_km + $2,
             status = CASE
               WHEN ptd_km + $2 >= target_km AND target_km > 0 THEN 'COMPLETED'
               WHEN ptd_km + $2 > 0 THEN 'IN_PROGRESS'
               ELSE status
             END,
             updated_at = NOW()
         WHERE production_order_id = $3 AND stage = $4`,
        [actual_output_kg || 0, actual_output_km || 0, production_order_id, stage]
      );

      // Update production order stage status
      await client.query(
        `UPDATE production_orders SET status = 'IN_PROGRESS', updated_at = NOW()
         WHERE id = $1 AND status = 'OPEN'`,
        [production_order_id]
      );
    }

    // Check if all stages are completed for affected production orders
    const poIds = [...new Set(entries.map(e => e.production_order_id))];
    for (const poId of poIds) {
      const stagesResult = await client.query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed
         FROM production_stage_tracking WHERE production_order_id = $1`,
        [poId]
      );
      const { total, completed } = stagesResult.rows[0];
      if (parseInt(total) > 0 && parseInt(total) === parseInt(completed)) {
        // All stages done - complete the production order and sales order
        const poResult = await client.query(
          `UPDATE production_orders SET status = 'COMPLETED', updated_at = NOW()
           WHERE id = $1 RETURNING sales_order_id`,
          [poId]
        );
        if (poResult.rows.length > 0) {
          await client.query(
            `UPDATE sales_orders SET status = 'COMPLETED', updated_at = NOW()
             WHERE id = $1`,
            [poResult.rows[0].sales_order_id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ inserted: inserted.length, entries: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PTD entry error:', err);
    res.status(500).json({ error: 'Failed to save PTD entries: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/ptd/entries
router.get('/entries', async (req, res) => {
  try {
    const { date, machineId, shift, productionOrderId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    if (date) { params.push(date); conditions.push(`pe.entry_date = $${params.length}`); }
    if (machineId) { params.push(machineId); conditions.push(`pe.machine_id = $${params.length}`); }
    if (shift) { params.push(parseInt(shift)); conditions.push(`pe.shift_no = $${params.length}`); }
    if (productionOrderId) { params.push(productionOrderId); conditions.push(`pe.production_order_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM ptd_entries pe ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT pe.*, m.name AS machine_name, so.so_number, so.job_name,
              c.name AS customer_name, f.fg_code, u.name AS entered_by_name
       FROM ptd_entries pe
       LEFT JOIN machines m ON pe.machine_id = m.id
       JOIN production_orders po ON pe.production_order_id = po.id
       JOIN sales_orders so ON po.sales_order_id = so.id
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       LEFT JOIN users u ON pe.entered_by = u.id
       ${where}
       ORDER BY pe.entry_date DESC, pe.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get PTD entries error:', err);
    res.status(500).json({ error: 'Failed to fetch PTD entries' });
  }
});

// GET /api/ptd/summary/:productionOrderId
router.get('/summary/:productionOrderId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT stage,
              SUM(actual_output_kg) AS total_kg,
              SUM(actual_output_km) AS total_km,
              SUM(waste_kg) AS total_waste,
              COUNT(*) AS entry_count,
              MIN(entry_date) AS first_entry,
              MAX(entry_date) AS last_entry
       FROM ptd_entries
       WHERE production_order_id = $1
       GROUP BY stage
       ORDER BY stage`,
      [req.params.productionOrderId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get PTD summary error:', err);
    res.status(500).json({ error: 'Failed to fetch PTD summary' });
  }
});

module.exports = router;
