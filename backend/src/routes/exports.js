const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a8a' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial', size: 10 };
const DATA_FONT = { name: 'Arial', size: 10 };
const THIN_BORDER = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };

const DEFAULT_COLUMNS = {
  stock: [
    { key: 'item_code', label: 'Item Code', width: 20 },
    { key: 'item_name', label: 'Item Name', width: 40 },
    { key: 'item_type', label: 'Type', width: 15 },
    { key: 'item_subtype', label: 'Sub Type', width: 15 },
    { key: 'store_stock', label: 'Store Stock', width: 15 },
    { key: 'qc_hold', label: 'QC Hold', width: 15 },
    { key: 'process_stock', label: 'Process Stock', width: 15 },
    { key: 'total_stock', label: 'Total Stock', width: 15 },
    { key: 'last_30_cons', label: 'Last 30 Cons', width: 15 },
    { key: 'pending_po', label: 'Pending PO', width: 15 },
    { key: 'days_cover', label: 'Days Cover', width: 12 },
  ],
  sales_orders: [
    { key: 'so_number', label: 'SO Number', width: 18 },
    { key: 'so_date', label: 'SO Date', width: 14 },
    { key: 'customer_name', label: 'Customer', width: 30 },
    { key: 'fg_code', label: 'FG Code', width: 20 },
    { key: 'job_name', label: 'Job Name', width: 30 },
    { key: 'order_type', label: 'Type', width: 10 },
    { key: 'qty_kg', label: 'Qty (KG)', width: 15 },
    { key: 'delivery_date', label: 'Delivery Date', width: 14 },
    { key: 'priority', label: 'Priority', width: 12 },
    { key: 'status', label: 'Status', width: 15 },
  ],
  production_orders: [
    { key: 'wo_number', label: 'WO Number', width: 18 },
    { key: 'so_number', label: 'SO Number', width: 18 },
    { key: 'customer_name', label: 'Customer', width: 30 },
    { key: 'fg_code', label: 'FG Code', width: 20 },
    { key: 'target_output_kg', label: 'Target KG', width: 14 },
    { key: 'target_output_km', label: 'Target KM', width: 14 },
    { key: 'status', label: 'Status', width: 15 },
    { key: 'delivery_date', label: 'Delivery Date', width: 14 },
  ],
  ptd_entries: [
    { key: 'entry_date', label: 'Date', width: 14 },
    { key: 'so_number', label: 'SO Number', width: 18 },
    { key: 'fg_code', label: 'FG Code', width: 20 },
    { key: 'customer_name', label: 'Customer', width: 25 },
    { key: 'stage', label: 'Stage', width: 14 },
    { key: 'machine_name', label: 'Machine', width: 18 },
    { key: 'shift_no', label: 'Shift', width: 8 },
    { key: 'actual_output_kg', label: 'Actual KG', width: 14 },
    { key: 'actual_output_km', label: 'Actual KM', width: 14 },
    { key: 'waste_kg', label: 'Waste KG', width: 12 },
    { key: 'operator_name', label: 'Operator', width: 20 },
  ],
  pending_orders: [
    { key: 'wo_number', label: 'WO Number', width: 18 },
    { key: 'so_number', label: 'SO Number', width: 18 },
    { key: 'customer_name', label: 'Customer', width: 25 },
    { key: 'fg_code', label: 'FG Code', width: 20 },
    { key: 'delivery_date', label: 'Delivery Date', width: 14 },
    { key: 'print_ptd', label: 'Print PTD', width: 12 },
    { key: 'ecl_ptd', label: 'ECL PTD', width: 12 },
    { key: 'lam1_ptd', label: 'Lam1 PTD', width: 12 },
    { key: 'lam2_ptd', label: 'Lam2 PTD', width: 12 },
    { key: 'slit_ptd', label: 'Slit PTD', width: 12 },
    { key: 'pouch_ptd', label: 'Pouch PTD', width: 12 },
  ],
};

async function fetchSheetData(sheetName, df, dt) {
  switch (sheetName) {
    case 'stock':
      return (await pool.query(
        `SELECT rm.item_code, rm.item_name, rm.item_type, rm.item_subtype,
                COALESCE(s.store_stock,0) AS store_stock, COALESCE(s.qc_hold,0) AS qc_hold,
                COALESCE(s.process_stock,0) AS process_stock,
                COALESCE(s.store_stock,0)+COALESCE(s.process_stock,0) AS total_stock,
                COALESCE(s.last_30_cons,0) AS last_30_cons, COALESCE(s.pending_po,0) AS pending_po,
                CASE WHEN s.last_30_cons > 0 THEN ROUND(((COALESCE(s.store_stock,0)+COALESCE(s.process_stock,0))/s.last_30_cons*30)::numeric,1) ELSE NULL END AS days_cover
         FROM raw_materials rm LEFT JOIN stock s ON rm.id = s.raw_material_id
         WHERE rm.is_active = TRUE ORDER BY rm.item_name`
      )).rows;

    case 'sales_orders':
      return (await pool.query(
        `SELECT so.so_number, so.so_date, c.name AS customer_name, f.fg_code,
                so.job_name, so.order_type, so.qty_kg, so.delivery_date, so.priority, so.status
         FROM sales_orders so
         JOIN customers c ON so.customer_id = c.id
         JOIN fg_codes f ON so.fg_code_id = f.id
         WHERE so.so_date BETWEEN $1 AND $2
         ORDER BY so.delivery_date ASC`,
        [df, dt]
      )).rows;

    case 'production_orders':
      return (await pool.query(
        `SELECT wo.wo_number, so.so_number, c.name AS customer_name, f.fg_code,
                po.target_output_kg, po.target_output_km, po.status, so.delivery_date
         FROM production_orders po
         JOIN work_orders wo ON po.work_order_id = wo.id
         JOIN sales_orders so ON po.sales_order_id = so.id
         JOIN customers c ON so.customer_id = c.id
         JOIN fg_codes f ON so.fg_code_id = f.id
         WHERE po.created_at::date BETWEEN $1 AND $2
         ORDER BY so.delivery_date`,
        [df, dt]
      )).rows;

    case 'ptd_entries':
      return (await pool.query(
        `SELECT pe.entry_date, so.so_number, f.fg_code, c.name AS customer_name,
                pe.stage, m.name AS machine_name, pe.shift_no,
                pe.actual_output_kg, pe.actual_output_km, pe.waste_kg, pe.operator_name
         FROM ptd_entries pe
         JOIN production_orders po ON pe.production_order_id = po.id
         JOIN sales_orders so ON po.sales_order_id = so.id
         JOIN customers c ON so.customer_id = c.id
         JOIN fg_codes f ON so.fg_code_id = f.id
         LEFT JOIN machines m ON pe.machine_id = m.id
         WHERE pe.entry_date BETWEEN $1 AND $2
         ORDER BY pe.entry_date, pe.created_at`,
        [df, dt]
      )).rows;

    case 'pending_orders':
      return (await pool.query(
        `SELECT wo.wo_number, so.so_number, c.name AS customer_name, f.fg_code,
                so.delivery_date,
                MAX(CASE WHEN pst.stage='PRINTING' THEN pst.ptd_km END) AS print_ptd,
                MAX(CASE WHEN pst.stage='ECL' THEN pst.ptd_km END) AS ecl_ptd,
                MAX(CASE WHEN pst.stage='LAM1' THEN pst.ptd_km END) AS lam1_ptd,
                MAX(CASE WHEN pst.stage='LAM2' THEN pst.ptd_km END) AS lam2_ptd,
                MAX(CASE WHEN pst.stage='SLITTING' THEN pst.ptd_km END) AS slit_ptd,
                MAX(CASE WHEN pst.stage='POUCHING' THEN pst.ptd_km END) AS pouch_ptd
         FROM production_orders po
         JOIN work_orders wo ON po.work_order_id = wo.id
         JOIN sales_orders so ON po.sales_order_id = so.id
         JOIN customers c ON so.customer_id = c.id
         JOIN fg_codes f ON so.fg_code_id = f.id
         LEFT JOIN production_stage_tracking pst ON po.id = pst.production_order_id
         WHERE po.status IN ('OPEN','IN_PROGRESS')
         GROUP BY wo.wo_number, so.so_number, c.name, f.fg_code, so.delivery_date
         ORDER BY so.delivery_date`
      )).rows;

    default:
      return [];
  }
}

// GET /api/exports/layout/:sheetName
router.get('/layout/:sheetName', async (req, res) => {
  try {
    const { sheetName } = req.params;
    const result = await pool.query(
      `SELECT column_config FROM export_layouts WHERE user_id = $1 AND sheet_name = $2`,
      [req.user.id, sheetName]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows[0].column_config);
    }

    // Return default config
    const defaultCols = DEFAULT_COLUMNS[sheetName] || [];
    res.json(defaultCols);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch layout' });
  }
});

// POST /api/exports/layout/:sheetName
router.post('/layout/:sheetName', async (req, res) => {
  try {
    const { sheetName } = req.params;
    const { column_config } = req.body;

    await pool.query(
      `INSERT INTO export_layouts (user_id, sheet_name, column_config)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, sheet_name) DO UPDATE SET
         column_config = EXCLUDED.column_config,
         updated_at = NOW()`,
      [req.user.id, sheetName, JSON.stringify(column_config)]
    );

    res.json({ message: 'Layout saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save layout' });
  }
});

// POST /api/exports/excel
router.post('/excel', async (req, res) => {
  try {
    const { sheets, dateFrom, dateTo } = req.body;
    const df = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dt = dateTo || new Date().toISOString().split('T')[0];

    if (!sheets || sheets.length === 0) {
      return res.status(400).json({ error: 'At least one sheet is required' });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MIPL PPC Module';
    workbook.created = new Date();

    for (const sheetName of sheets) {
      // Get user column config
      const layoutResult = await pool.query(
        `SELECT column_config FROM export_layouts WHERE user_id = $1 AND sheet_name = $2`,
        [req.user.id, sheetName]
      );
      const columns = layoutResult.rows.length > 0
        ? layoutResult.rows[0].column_config
        : (DEFAULT_COLUMNS[sheetName] || []);

      const data = await fetchSheetData(sheetName, df, dt);

      const ws = workbook.addWorksheet(sheetName.replace(/_/g, ' ').toUpperCase(), {
        pageSetup: { paperSize: 9, orientation: 'landscape' },
      });

      // Set columns
      ws.columns = columns.map(col => ({
        key: col.key,
        width: col.width || 15,
      }));

      // Header row
      const headerRow = ws.addRow(columns.map(col => col.label));
      headerRow.eachCell((cell) => {
        cell.fill = HEADER_FILL;
        cell.font = HEADER_FONT;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = THIN_BORDER;
      });
      headerRow.height = 20;

      // Data rows
      data.forEach((row, idx) => {
        const rowData = columns.map(col => row[col.key] ?? '');
        const dataRow = ws.addRow(rowData);
        dataRow.eachCell((cell) => {
          cell.font = DATA_FONT;
          cell.border = THIN_BORDER;
          cell.alignment = { vertical: 'middle' };
          if (idx % 2 === 1) cell.fill = ALT_FILL;
        });
      });

      // Auto-width based on content
      ws.columns.forEach((col, idx) => {
        let maxLen = columns[idx]?.label?.length || 10;
        data.forEach(row => {
          const val = String(row[columns[idx]?.key] ?? '');
          if (val.length > maxLen) maxLen = val.length;
        });
        col.width = Math.min(Math.max(maxLen + 2, 10), 60);
      });
    }

    const filename = `MIPL_PPC_Export_${dt}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ error: 'Failed to generate Excel export' });
  }
});

module.exports = router;
