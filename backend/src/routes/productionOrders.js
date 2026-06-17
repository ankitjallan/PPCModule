const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// POST /api/production-orders/from-so/:soId
router.post('/from-so/:soId', authorize('admin', 'ppc_planner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const soId = req.params.soId;

    // 1. Fetch SO with FG code
    const soResult = await client.query(
      `SELECT so.*, c.name AS customer_name, f.fg_code
       FROM sales_orders so
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       WHERE so.id = $1`,
      [soId]
    );
    if (soResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sales order not found' });
    }
    const so = soResult.rows[0];

    // 2. Fetch current spec sheet
    const ssResult = await client.query(
      `SELECT ss.* FROM spec_sheets ss
       WHERE ss.fg_code_id = $1 AND ss.is_current = TRUE
       ORDER BY ss.version DESC LIMIT 1`,
      [so.fg_code_id]
    );
    if (ssResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No current spec sheet found for this FG code. Create a spec sheet first.' });
    }
    const specSheet = ssResult.rows[0];

    // Fetch sub-tables
    const [filmsRes, processRes] = await Promise.all([
      client.query('SELECT * FROM spec_sheet_films WHERE spec_sheet_id = $1 ORDER BY layer_no', [specSheet.id]),
      client.query('SELECT * FROM spec_sheet_process WHERE spec_sheet_id = $1', [specSheet.id]),
    ]);
    const films = filmsRes.rows;
    const process = processRes.rows[0] || {};

    // 3. Generate WO number
    const year = new Date().getFullYear();
    const woCountResult = await client.query(
      `SELECT COUNT(*) FROM work_orders WHERE EXTRACT(YEAR FROM created_at) = $1`, [year]
    );
    const woSeq = parseInt(woCountResult.rows[0].count) + 1;
    const woNumber = `WO-${year}-${String(woSeq).padStart(5, '0')}`;

    // 4. Insert work order
    const woResult = await client.query(
      `INSERT INTO work_orders (wo_number, sales_order_id, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [woNumber, soId, req.user.id]
    );
    const workOrder = woResult.rows[0];

    // 5. Calculate target_output_km
    // Formula: target_km = (qty_kg * 1,000,000) / total_gsm / primary_film_width_mm
    // primary film = layer 1 film
    const totalGsm = parseFloat(specSheet.total_gsm) || 1;
    const primaryFilm = films.find(f => f.layer_no === 1);
    const primaryWidth = primaryFilm ? (parseFloat(primaryFilm.width_mm) || parseFloat(specSheet.width_mm) || 1000) : (parseFloat(specSheet.width_mm) || 1000);
    const qtyKg = parseFloat(so.qty_kg) || 0;

    const targetKm = (qtyKg * 1000000) / totalGsm / primaryWidth;
    const targetKg = qtyKg;

    // 6. Insert production order
    const poResult = await client.query(
      `INSERT INTO production_orders (work_order_id, sales_order_id, spec_sheet_id, target_output_kg, target_output_km, status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN') RETURNING *`,
      [workOrder.id, soId, specSheet.id, targetKg, Math.round(targetKm * 100) / 100]
    );
    const po = poResult.rows[0];

    // 7. Create stage tracking rows
    const stages = [];
    if (process.has_printing) stages.push({ stage: 'PRINTING', machine_id: process.printing_machine_id, seq: 1 });
    if (process.has_ecl) stages.push({ stage: 'ECL', machine_id: process.ecl_machine_id, seq: 2 });
    if (process.has_lam1) stages.push({ stage: 'LAM1', machine_id: process.lam1_machine_id, seq: 3 });
    if (process.has_lam2) stages.push({ stage: 'LAM2', machine_id: process.lam2_machine_id, seq: 4 });
    if (process.has_slitting) stages.push({ stage: 'SLITTING', machine_id: process.slitting_machine_id, seq: 5 });
    if (process.has_pouching) stages.push({ stage: 'POUCHING', machine_id: process.pouching_machine_id, seq: 6 });

    for (const stg of stages) {
      await client.query(
        `INSERT INTO production_stage_tracking
           (production_order_id, stage, machine_id, target_km, sequence_order, status)
         VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
        [po.id, stg.stage, stg.machine_id, Math.round(targetKm * 100) / 100, stg.seq]
      );
    }

    // 8. Create RM allocation rows
    for (const film of films) {
      if (!film.raw_material_id) continue;

      const filmWidth = parseFloat(film.width_mm) || primaryWidth;
      const stdWastage = parseFloat(film.std_wastage) || 5;
      // bom_qty (kg) = target_km * film_width_mm / 1000 (convert to m²) * gsm / 1000 (convert gsm to kg/m²) * (1 + wastage%)
      const filmGsm = parseFloat(film.gsm) || 0;
      const bomQty = targetKm * (filmWidth / 1000) * (filmGsm / 1000) * (1 + stdWastage / 100);

      // Get stock
      const stockRes = await client.query(
        `SELECT COALESCE(store_stock, 0) + COALESCE(process_stock, 0) AS available,
                COALESCE(pending_po, 0) AS apo_qty
         FROM stock WHERE raw_material_id = $1`,
        [film.raw_material_id]
      );

      let rmStatus = 'UNKNOWN';
      if (stockRes.rows.length > 0) {
        const available = parseFloat(stockRes.rows[0].available) || 0;
        const apoQty = parseFloat(stockRes.rows[0].apo_qty) || 0;
        if (available >= bomQty) rmStatus = 'AVAILABLE';
        else if (available + apoQty >= bomQty) rmStatus = 'APO';
        else rmStatus = 'SHORT';
      }

      await client.query(
        `INSERT INTO production_rm_allocation
           (production_order_id, raw_material_id, layer_no, bom_qty, rm_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [po.id, film.raw_material_id, film.layer_no, Math.round(bomQty * 1000) / 1000, rmStatus]
      );
    }

    // 9. Update SO status
    await client.query(
      `UPDATE sales_orders SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = $1`, [soId]
    );

    await client.query('COMMIT');

    // Return full production order
    const fullPo = await _getFullProductionOrder(po.id, pool);
    res.status(201).json(fullPo);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create production order error:', err);
    res.status(500).json({ error: 'Failed to create production order: ' + err.message });
  } finally {
    client.release();
  }
});

async function _getFullProductionOrder(poId, pool) {
  const result = await pool.query(
    `SELECT po.*, wo.wo_number, so.so_number, so.qty_kg, so.delivery_date,
            c.name AS customer_name, f.fg_code, ss.version AS spec_version
     FROM production_orders po
     JOIN work_orders wo ON po.work_order_id = wo.id
     JOIN sales_orders so ON po.sales_order_id = so.id
     JOIN customers c ON so.customer_id = c.id
     JOIN fg_codes f ON so.fg_code_id = f.id
     LEFT JOIN spec_sheets ss ON po.spec_sheet_id = ss.id
     WHERE po.id = $1`,
    [poId]
  );
  const po = result.rows[0];
  if (!po) return null;

  const [stages, allocations] = await Promise.all([
    pool.query(
      `SELECT pst.*, m.name AS machine_name
       FROM production_stage_tracking pst
       LEFT JOIN machines m ON pst.machine_id = m.id
       WHERE pst.production_order_id = $1
       ORDER BY pst.sequence_order`,
      [poId]
    ),
    pool.query(
      `SELECT pra.*, rm.item_code, rm.item_name, rm.gsm, rm.width_mm
       FROM production_rm_allocation pra
       JOIN raw_materials rm ON pra.raw_material_id = rm.id
       WHERE pra.production_order_id = $1
       ORDER BY pra.layer_no`,
      [poId]
    ),
  ]);

  return { ...po, stages: stages.rows, rm_allocations: allocations.rows };
}

// GET /api/production-orders
router.get('/', async (req, res) => {
  try {
    const { status, customer_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = [];

    if (status) { params.push(status); conditions.push(`po.status = $${params.length}`); }
    if (customer_id) { params.push(customer_id); conditions.push(`so.customer_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM production_orders po
       JOIN sales_orders so ON po.sales_order_id = so.id ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT po.id, po.status, po.target_output_kg, po.target_output_km, po.created_at,
              wo.wo_number, so.so_number, so.qty_kg, so.delivery_date, so.priority,
              c.name AS customer_name, f.fg_code, f.description AS fg_description
       FROM production_orders po
       JOIN work_orders wo ON po.work_order_id = wo.id
       JOIN sales_orders so ON po.sales_order_id = so.id
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       ${where}
       ORDER BY so.delivery_date ASC, po.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get production orders error:', err);
    res.status(500).json({ error: 'Failed to fetch production orders' });
  }
});

// GET /api/production-orders/pending - Pending Order Tracker
router.get('/pending', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         po.id, po.status AS po_status, po.target_output_kg, po.target_output_km,
         wo.wo_number, so.so_number, so.qty_kg, so.delivery_date, so.priority, so.job_name,
         c.name AS customer_name, f.fg_code,
         MAX(CASE WHEN pst.stage = 'PRINTING' THEN pst.target_km END) AS print_target,
         MAX(CASE WHEN pst.stage = 'PRINTING' THEN pst.ptd_km END) AS print_ptd,
         MAX(CASE WHEN pst.stage = 'PRINTING' THEN pst.status END) AS print_status,
         MAX(CASE WHEN pst.stage = 'ECL' THEN pst.target_km END) AS ecl_target,
         MAX(CASE WHEN pst.stage = 'ECL' THEN pst.ptd_km END) AS ecl_ptd,
         MAX(CASE WHEN pst.stage = 'ECL' THEN pst.status END) AS ecl_status,
         MAX(CASE WHEN pst.stage = 'LAM1' THEN pst.target_km END) AS lam1_target,
         MAX(CASE WHEN pst.stage = 'LAM1' THEN pst.ptd_km END) AS lam1_ptd,
         MAX(CASE WHEN pst.stage = 'LAM1' THEN pst.status END) AS lam1_status,
         MAX(CASE WHEN pst.stage = 'LAM2' THEN pst.target_km END) AS lam2_target,
         MAX(CASE WHEN pst.stage = 'LAM2' THEN pst.ptd_km END) AS lam2_ptd,
         MAX(CASE WHEN pst.stage = 'LAM2' THEN pst.status END) AS lam2_status,
         MAX(CASE WHEN pst.stage = 'SLITTING' THEN pst.target_km END) AS slit_target,
         MAX(CASE WHEN pst.stage = 'SLITTING' THEN pst.ptd_km END) AS slit_ptd,
         MAX(CASE WHEN pst.stage = 'SLITTING' THEN pst.status END) AS slit_status,
         MAX(CASE WHEN pst.stage = 'POUCHING' THEN pst.target_km END) AS pouch_target,
         MAX(CASE WHEN pst.stage = 'POUCHING' THEN pst.ptd_km END) AS pouch_ptd,
         MAX(CASE WHEN pst.stage = 'POUCHING' THEN pst.status END) AS pouch_status,
         STRING_AGG(DISTINCT CASE WHEN pra.rm_status = 'SHORT' THEN rm.item_code END, ', ') AS short_rm
       FROM production_orders po
       JOIN work_orders wo ON po.work_order_id = wo.id
       JOIN sales_orders so ON po.sales_order_id = so.id
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       LEFT JOIN production_stage_tracking pst ON po.id = pst.production_order_id
       LEFT JOIN production_rm_allocation pra ON po.id = pra.production_order_id
       LEFT JOIN raw_materials rm ON pra.raw_material_id = rm.id
       WHERE po.status IN ('OPEN','IN_PROGRESS')
       GROUP BY po.id, wo.wo_number, so.so_number, so.qty_kg, so.delivery_date,
                so.priority, so.job_name, c.name, f.fg_code
       ORDER BY so.delivery_date ASC, so.priority DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending orders error:', err);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// GET /api/production-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const po = await _getFullProductionOrder(parseInt(req.params.id), pool);
    if (!po) return res.status(404).json({ error: 'Production order not found' });
    res.json(po);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch production order' });
  }
});

// PUT /api/production-orders/:id/spec-override
router.put('/:id/spec-override', authorize('admin', 'ppc_planner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { spec_sheet_id } = req.body;
    const poId = req.params.id;

    const ssResult = await client.query(
      'SELECT * FROM spec_sheets WHERE id = $1', [spec_sheet_id]
    );
    if (ssResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Spec sheet not found' });
    }

    await client.query(
      `UPDATE production_orders SET spec_sheet_id = $1, spec_overridden = TRUE, updated_at = NOW()
       WHERE id = $2`,
      [spec_sheet_id, poId]
    );

    // Recalculate targets based on new spec sheet
    const poResult = await client.query('SELECT * FROM production_orders WHERE id = $1', [poId]);
    const po = poResult.rows[0];
    const so = (await client.query('SELECT qty_kg FROM sales_orders WHERE id = $1', [po.sales_order_id])).rows[0];
    const specSheet = ssResult.rows[0];
    const films = (await client.query(
      'SELECT * FROM spec_sheet_films WHERE spec_sheet_id = $1 ORDER BY layer_no', [spec_sheet_id]
    )).rows;

    const totalGsm = parseFloat(specSheet.total_gsm) || 1;
    const primaryFilm = films.find(f => f.layer_no === 1);
    const primaryWidth = primaryFilm ? (parseFloat(primaryFilm.width_mm) || 1000) : 1000;
    const qtyKg = parseFloat(so.qty_kg) || 0;
    const targetKm = (qtyKg * 1000000) / totalGsm / primaryWidth;

    await client.query(
      `UPDATE production_orders SET target_output_km = $1, updated_at = NOW() WHERE id = $2`,
      [Math.round(targetKm * 100) / 100, poId]
    );

    await client.query('COMMIT');
    const fullPo = await _getFullProductionOrder(parseInt(poId), pool);
    res.json(fullPo);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to override spec sheet' });
  } finally {
    client.release();
  }
});

module.exports = router;
