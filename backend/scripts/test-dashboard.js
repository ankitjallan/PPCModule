require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });

const df = '2026-05-17', dt = '2026-06-17';

const queries = [
  ['Open Orders', `SELECT COUNT(*) AS count, COALESCE(SUM(qty_kg), 0) AS total_qty FROM sales_orders WHERE status NOT IN ('COMPLETED','CANCELLED')`, []],
  ['Overdue', `SELECT COUNT(*) AS count FROM sales_orders WHERE delivery_date < CURRENT_DATE AND status NOT IN ('COMPLETED','CANCELLED')`, []],
  ['Due Week', `SELECT COUNT(*) AS count FROM sales_orders WHERE delivery_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' AND status NOT IN ('COMPLETED','CANCELLED')`, []],
  ['Daily Trend', `SELECT entry_date, SUM(actual_output_kg) AS total_kg, SUM(actual_output_km) AS total_km FROM ptd_entries WHERE entry_date BETWEEN $1 AND $2 GROUP BY entry_date ORDER BY entry_date`, [df, dt]],
  ['Orders by Status', `SELECT status, COUNT(*) AS count FROM sales_orders GROUP BY status ORDER BY count DESC`, []],
  ['Efficiency', `SELECT CASE WHEN SUM(po.target_output_kg) > 0 THEN ROUND((SUM(pe.actual_output_kg) / SUM(po.target_output_kg) * 100)::numeric, 1) ELSE 0 END AS efficiency_pct FROM ptd_entries pe JOIN production_orders po ON pe.production_order_id = po.id WHERE pe.entry_date BETWEEN $1 AND $2`, [df, dt]],
  ['On-Time', `SELECT COUNT(*) AS total_completed, SUM(CASE WHEN updated_at::date <= delivery_date THEN 1 ELSE 0 END) AS on_time FROM sales_orders WHERE status = 'COMPLETED' AND updated_at::date BETWEEN $1 AND $2`, [df, dt]],
  ['Machine Util', `SELECT m.id AS machine_id, m.name AS machine_name, COALESCE(SUM(mpj.run_hrs), 0) AS run_hrs, (DATE_PART('day', $2::date - $1::date) + 1) * 24 AS available_hrs FROM machines m LEFT JOIN machine_plan_jobs mpj ON mpj.machine_plan_id IN (SELECT id FROM machine_plans WHERE plan_date BETWEEN $1 AND $2 AND machine_id = m.id) WHERE m.is_active = TRUE GROUP BY m.id, m.name ORDER BY run_hrs DESC`, [df, dt]],
  ['Stage WIP', `SELECT stage, COUNT(*) AS jobs_in_stage, SUM(target_km - ptd_km) AS wip_km FROM production_stage_tracking WHERE status = 'IN_PROGRESS' GROUP BY stage ORDER BY stage`, []],
  ['Top Customers', `SELECT c.id, c.name AS customer_name, COUNT(so.id) AS order_count, COALESCE(SUM(so.qty_kg), 0) AS total_qty FROM customers c JOIN sales_orders so ON so.customer_id = c.id WHERE so.status NOT IN ('COMPLETED','CANCELLED') GROUP BY c.id, c.name ORDER BY total_qty DESC LIMIT 10`, []],
  ['RM Shortage', `SELECT rm.id, rm.item_code, rm.item_name FROM raw_materials rm JOIN stock s ON rm.id = s.raw_material_id WHERE s.last_30_cons > 0 AND (COALESCE(s.store_stock,0) + COALESCE(s.process_stock,0)) < s.last_30_cons AND rm.is_active = TRUE LIMIT 5`, []],
  ['New vs Repeat', `SELECT order_type, COUNT(*) AS count, COALESCE(SUM(qty_kg), 0) AS total_qty FROM sales_orders WHERE status NOT IN ('CANCELLED') GROUP BY order_type`, []],
];

(async () => {
  await c.connect();
  for (const [name, sql, params] of queries) {
    try {
      await c.query(sql, params);
      console.log(`✅ ${name}`);
    } catch (e) {
      console.log(`❌ ${name}: ${e.message}`);
    }
  }
  await c.end();
})();
