const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { dateFrom, dateTo, machineId, customerId } = req.query;
    const df = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dt = dateTo || new Date().toISOString().split('T')[0];

    const [
      openOrdersRes,
      overdueRes,
      dueWeekRes,
      dailyTrendRes,
      ordersByStatusRes,
      efficiencyRes,
      onTimeRes,
      machineUtilRes,
      stageWipRes,
      topCustomersRes,
      rmShortageRes,
      newRepeatRes,
    ] = await Promise.all([
      // 1. Open orders count + qty
      pool.query(
        `SELECT COUNT(*) AS count, COALESCE(SUM(qty_kg), 0) AS total_qty
         FROM sales_orders
         WHERE status NOT IN ('COMPLETED','CANCELLED')`
      ),
      // 2. Overdue orders
      pool.query(
        `SELECT COUNT(*) AS count
         FROM sales_orders
         WHERE delivery_date < CURRENT_DATE AND status NOT IN ('COMPLETED','CANCELLED')`
      ),
      // 3. Due this week
      pool.query(
        `SELECT COUNT(*) AS count
         FROM sales_orders
         WHERE delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           AND status NOT IN ('COMPLETED','CANCELLED')`
      ),
      // 4. Daily output trend
      pool.query(
        `SELECT entry_date, SUM(actual_output_kg) AS total_kg, SUM(actual_output_km) AS total_km
         FROM ptd_entries
         WHERE entry_date BETWEEN $1 AND $2
         GROUP BY entry_date ORDER BY entry_date`,
        [df, dt]
      ),
      // 5. Orders by status
      pool.query(
        `SELECT status, COUNT(*) AS count FROM sales_orders GROUP BY status ORDER BY count DESC`
      ),
      // 6. Efficiency %
      pool.query(
        `SELECT
           CASE WHEN SUM(po.target_output_kg) > 0
           THEN ROUND((SUM(pe.actual_output_kg) / SUM(po.target_output_kg) * 100)::numeric, 1)
           ELSE 0 END AS efficiency_pct
         FROM ptd_entries pe
         JOIN production_orders po ON pe.production_order_id = po.id
         WHERE pe.entry_date BETWEEN $1 AND $2`,
        [df, dt]
      ),
      // 7. On-time delivery %
      pool.query(
        `SELECT
           COUNT(*) AS total_completed,
           SUM(CASE WHEN updated_at::date <= delivery_date THEN 1 ELSE 0 END) AS on_time
         FROM sales_orders
         WHERE status = 'COMPLETED' AND updated_at::date BETWEEN $1 AND $2`,
        [df, dt]
      ),
      // 8. Machine utilization
      pool.query(
        `SELECT m.id AS machine_id, m.name AS machine_name,
                COALESCE(SUM(mpj.run_hrs), 0) AS run_hrs,
                (($2::date - $1::date) + 1) * 24 AS available_hrs,
                CASE WHEN (($2::date - $1::date) + 1) * 24 > 0
                THEN ROUND((COALESCE(SUM(mpj.run_hrs), 0) / ((($2::date - $1::date) + 1) * 24) * 100)::numeric, 1)
                ELSE 0 END AS utilization_pct
         FROM machines m
         LEFT JOIN machine_plan_jobs mpj ON mpj.machine_plan_id IN (
           SELECT id FROM machine_plans WHERE plan_date BETWEEN $1 AND $2 AND machine_id = m.id
         )
         WHERE m.is_active = TRUE
         GROUP BY m.id, m.name
         ORDER BY utilization_pct DESC`,
        [df, dt]
      ),
      // 9. Stage WIP
      pool.query(
        `SELECT stage,
                COUNT(*) AS jobs_in_stage,
                SUM(target_km - ptd_km) AS wip_km
         FROM production_stage_tracking
         WHERE status = 'IN_PROGRESS'
         GROUP BY stage ORDER BY stage`
      ),
      // 10. Top customers by qty
      pool.query(
        `SELECT c.id, c.name AS customer_name,
                COUNT(so.id) AS order_count,
                COALESCE(SUM(so.qty_kg), 0) AS total_qty
         FROM customers c
         JOIN sales_orders so ON so.customer_id = c.id
         WHERE so.status NOT IN ('COMPLETED','CANCELLED')
         GROUP BY c.id, c.name
         ORDER BY total_qty DESC
         LIMIT 10`
      ),
      // 11. RM shortage alerts
      pool.query(
        `SELECT rm.id, rm.item_code, rm.item_name, rm.item_type,
                COALESCE(s.store_stock, 0) + COALESCE(s.process_stock, 0) AS total_stock,
                COALESCE(s.last_30_cons, 0) AS last_30_cons,
                COALESCE(s.pending_po, 0) AS pending_po,
                CASE WHEN s.last_30_cons > 0
                THEN ROUND(((COALESCE(s.store_stock,0)+COALESCE(s.process_stock,0)) / s.last_30_cons * 30)::numeric, 1)
                ELSE NULL END AS days_cover
         FROM raw_materials rm
         JOIN stock s ON rm.id = s.raw_material_id
         WHERE s.last_30_cons > 0
           AND (COALESCE(s.store_stock,0) + COALESCE(s.process_stock,0)) < s.last_30_cons
           AND rm.is_active = TRUE
         ORDER BY days_cover ASC NULLS LAST
         LIMIT 20`
      ),
      // 12. New vs Repeat
      pool.query(
        `SELECT order_type, COUNT(*) AS count, COALESCE(SUM(qty_kg), 0) AS total_qty
         FROM sales_orders
         WHERE status NOT IN ('CANCELLED')
         GROUP BY order_type`
      ),
    ]);

    const onTime = onTimeRes.rows[0];
    const onTimePct = onTime.total_completed > 0
      ? Math.round((onTime.on_time / onTime.total_completed) * 100 * 10) / 10
      : 0;

    res.json({
      openOrders: {
        count: parseInt(openOrdersRes.rows[0].count),
        totalQty: parseFloat(openOrdersRes.rows[0].total_qty),
      },
      overdueOrders: parseInt(overdueRes.rows[0].count),
      dueThisWeek: parseInt(dueWeekRes.rows[0].count),
      dailyOutputTrend: dailyTrendRes.rows,
      ordersByStatus: ordersByStatusRes.rows,
      efficiencyPct: parseFloat(efficiencyRes.rows[0]?.efficiency_pct) || 0,
      onTimeDeliveryPct: onTimePct,
      machineUtilization: machineUtilRes.rows,
      stageWIP: stageWipRes.rows,
      topCustomers: topCustomersRes.rows,
      rmShortageAlerts: rmShortageRes.rows,
      newVsRepeat: newRepeatRes.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
