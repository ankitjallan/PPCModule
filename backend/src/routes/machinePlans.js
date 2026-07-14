const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/machine-plans
router.get('/', async (req, res) => {
  try {
    const { date, machineId } = req.query;
    const params = [];
    const conditions = [];

    if (date) { params.push(date); conditions.push(`mp.plan_date = $${params.length}`); }
    if (machineId) { params.push(machineId); conditions.push(`mp.machine_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const plans = await pool.query(
      `SELECT mp.*, m.name AS machine_name, m.speed_mpm, pc.name AS process_category,
              u.name AS created_by_name
       FROM machine_plans mp
       JOIN machines m ON mp.machine_id = m.id
       LEFT JOIN process_categories pc ON m.process_category_id = pc.id
       LEFT JOIN users u ON mp.created_by = u.id
       ${where}
       ORDER BY mp.plan_date DESC, m.name`,
      params
    );

    if (plans.rows.length === 0) {
      return res.json([]);
    }

    // Fetch jobs for each plan
    const planIds = plans.rows.map(p => p.id);
    const jobsResult = await pool.query(
      `SELECT mpj.*, po.target_output_km, so.so_number, so.job_name,
              c.name AS customer_name, f.fg_code
       FROM machine_plan_jobs mpj
       JOIN production_orders po ON mpj.production_order_id = po.id
       JOIN sales_orders so ON po.sales_order_id = so.id
       JOIN customers c ON so.customer_id = c.id
       JOIN fg_codes f ON so.fg_code_id = f.id
       WHERE mpj.machine_plan_id = ANY($1)
       ORDER BY mpj.sequence_no`,
      [planIds]
    );

    const planMap = {};
    for (const plan of plans.rows) {
      planMap[plan.id] = { ...plan, jobs: [] };
    }
    for (const job of jobsResult.rows) {
      if (planMap[job.machine_plan_id]) {
        planMap[job.machine_plan_id].jobs.push(job);
      }
    }

    res.json(Object.values(planMap));
  } catch (err) {
    console.error('Get machine plans error:', err);
    res.status(500).json({ error: 'Failed to fetch machine plans' });
  }
});

// POST /api/machine-plans/generate
router.post('/generate', authorize('admin', 'ppc_planner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { machineId, planDate, jobs } = req.body;
    if (!machineId || !planDate || !jobs || jobs.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Machine, plan date and jobs are required' });
    }

    // Get machine speed
    const machineResult = await client.query(
      'SELECT id, name, speed_mpm FROM machines WHERE id = $1 AND is_active = TRUE',
      [machineId]
    );
    if (machineResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Machine not found' });
    }
    const machine = machineResult.rows[0];
    const speedMpm = parseFloat(machine.speed_mpm) || 1;

    // Upsert machine plan
    const mpResult = await client.query(
      `INSERT INTO machine_plans (plan_date, machine_id, created_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (plan_date, machine_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [planDate, machineId, req.user.id]
    );
    const plan = mpResult.rows[0];

    // Delete existing jobs for this plan
    await client.query('DELETE FROM machine_plan_jobs WHERE machine_plan_id = $1', [plan.id]);

    // Plan start: planDate 07:00:00
    const planStart = new Date(`${planDate}T07:00:00`);
    let cursor = new Date(planStart);

    const insertedJobs = [];
    let seqNo = 1;

    for (const job of jobs) {
      const { productionOrderId, stage, passNo } = job;

      // Get target km for this stage
      const stgResult = await client.query(
        `SELECT target_km FROM production_stage_tracking
         WHERE production_order_id = $1 AND stage = $2 AND pass_no = $3`,
        [productionOrderId, stage, passNo || 1]
      );

      let targetKm = 0;
      if (stgResult.rows.length > 0) {
        targetKm = parseFloat(stgResult.rows[0].target_km) || 0;
      }

      // run_hrs = (target_km * 1000 m) / (speed_mpm * 60 m/hr)
      const runHrs = targetKm > 0 ? (targetKm * 1000) / (speedMpm * 60) : 0;

      const fromTime = new Date(cursor);
      const toTime = new Date(cursor.getTime() + runHrs * 3600 * 1000);

      // Determine shift based on from_time hour
      const hour = fromTime.getHours();
      let shiftNo;
      if (hour >= 7 && hour < 15) shiftNo = 1;
      else if (hour >= 15 && hour < 23) shiftNo = 2;
      else shiftNo = 3;

      const jobResult = await client.query(
        `INSERT INTO machine_plan_jobs
           (machine_plan_id, production_order_id, stage, pass_no, sequence_no, shift_no, from_time, to_time, run_hrs, target_km)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [plan.id, productionOrderId, stage, passNo || 1, seqNo,
         shiftNo, fromTime.toISOString(), toTime.toISOString(),
         Math.round(runHrs * 10000) / 10000, Math.round(targetKm * 100) / 100]
      );

      insertedJobs.push(jobResult.rows[0]);
      cursor = toTime;
      seqNo++;
    }

    await client.query('COMMIT');

    res.status(201).json({ ...plan, jobs: insertedJobs });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Generate machine plan error:', err);
    res.status(500).json({ error: 'Failed to generate machine plan: ' + err.message });
  } finally {
    client.release();
  }
});

// PUT /api/machine-plans/jobs/:jobId
router.put('/jobs/:jobId', authorize('admin', 'ppc_planner', 'machine_operator'), async (req, res) => {
  try {
    const { from_time, to_time, remarks } = req.body;
    const result = await pool.query(
      `UPDATE machine_plan_jobs SET
         from_time = COALESCE($1, from_time),
         to_time = COALESCE($2, to_time),
         remarks = COALESCE($3, remarks),
         is_manually_edited = TRUE
       WHERE id = $4 RETURNING *`,
      [from_time, to_time, remarks, req.params.jobId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update machine plan job error:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/machine-plans/jobs/:jobId
router.delete('/jobs/:jobId', authorize('admin', 'ppc_planner'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM machine_plan_jobs WHERE id = $1 RETURNING id', [req.params.jobId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job removed from plan' });
  } catch (err) {
    console.error('Delete machine plan job error:', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

module.exports = router;
