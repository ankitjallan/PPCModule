const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authenticate);

// GET /api/stock
router.get('/', async (req, res) => {
  try {
    const { search, item_type, item_subtype } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const params = [];
    const conditions = ['rm.is_active = TRUE'];

    if (item_type) {
      params.push(item_type);
      conditions.push(`rm.item_type = $${params.length}`);
    }
    if (item_subtype) {
      params.push(item_subtype);
      conditions.push(`rm.item_subtype = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(rm.item_code ILIKE $${params.length} OR rm.item_name ILIKE $${params.length})`);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM raw_materials rm ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT
         rm.id AS raw_material_id,
         rm.item_code, rm.item_name, rm.item_type, rm.item_subtype,
         rm.gsm, rm.width_mm, rm.micron, rm.uom,
         COALESCE(s.store_stock, 0) AS store_stock,
         COALESCE(s.qc_hold, 0) AS qc_hold,
         COALESCE(s.process_stock, 0) AS process_stock,
         COALESCE(s.pending_movement, 0) AS pending_movement,
         COALESCE(s.store_stock, 0) + COALESCE(s.process_stock, 0) AS total_stock,
         COALESCE(s.last_30_cons, 0) AS last_30_cons,
         COALESCE(s.pending_po, 0) AS pending_po,
         COALESCE(s.qc_pending, 0) AS qc_pending,
         s.updated_at AS stock_updated_at,
         CASE
           WHEN COALESCE(s.last_30_cons, 0) > 0
           THEN ROUND(((COALESCE(s.store_stock, 0) + COALESCE(s.process_stock, 0)) / s.last_30_cons * 30)::numeric, 1)
           ELSE NULL
         END AS days_cover
       FROM raw_materials rm
       LEFT JOIN stock s ON rm.id = s.raw_material_id
       ${where}
       ORDER BY rm.item_name
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Get stock error:', err);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

// PUT /api/stock/:rawMaterialId
router.put('/:rawMaterialId', authorize('admin', 'store_inventory'), async (req, res) => {
  try {
    const { rawMaterialId } = req.params;
    const { store_stock, qc_hold, process_stock, pending_movement, last_30_cons, pending_po, qc_pending } = req.body;

    const rmCheck = await pool.query('SELECT id FROM raw_materials WHERE id = $1', [rawMaterialId]);
    if (rmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Raw material not found' });
    }

    const result = await pool.query(
      `INSERT INTO stock (raw_material_id, store_stock, qc_hold, process_stock, pending_movement, last_30_cons, pending_po, qc_pending, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (raw_material_id) DO UPDATE SET
         store_stock = EXCLUDED.store_stock,
         qc_hold = EXCLUDED.qc_hold,
         process_stock = EXCLUDED.process_stock,
         pending_movement = EXCLUDED.pending_movement,
         last_30_cons = EXCLUDED.last_30_cons,
         pending_po = EXCLUDED.pending_po,
         qc_pending = EXCLUDED.qc_pending,
         updated_at = NOW()
       RETURNING *`,
      [rawMaterialId, store_stock || 0, qc_hold || 0, process_stock || 0,
       pending_movement || 0, last_30_cons || 0, pending_po || 0, qc_pending || 0]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ error: 'Failed to update stock' });
  }
});

// POST /api/stock/import
router.post('/import', authorize('admin', 'store_inventory'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const worksheet = workbook.worksheets[0];
    let headerRowIndex = -1;
    let headers = {};

    // Find header row
    worksheet.eachRow((row, rowNum) => {
      if (headerRowIndex !== -1) return;
      const values = row.values;
      for (let i = 1; i < values.length; i++) {
        const val = String(values[i] || '').trim().toUpperCase();
        if (val.includes('ITEMCODE') || val === 'ITEM CODE' || val === 'ITEM_CODE') {
          headerRowIndex = rowNum;
          break;
        }
      }
    });

    if (headerRowIndex === -1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Could not find header row with ITEMCODE column' });
    }

    const headerRow = worksheet.getRow(headerRowIndex);
    headerRow.eachCell((cell, colNum) => {
      const key = String(cell.value || '').trim().toUpperCase().replace(/\s+/g, '_');
      headers[key] = colNum;
    });

    const getCol = (row, ...keys) => {
      for (const k of keys) {
        const col = headers[k];
        if (col) {
          const val = row.getCell(col).value;
          if (val !== null && val !== undefined && val !== '') return val;
        }
      }
      return null;
    };

    const toNum = (v) => {
      const n = parseFloat(String(v || '0').replace(/,/g, ''));
      return isNaN(n) ? 0 : n;
    };

    let count = 0;
    const errors = [];

    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const itemCode = getCol(row, 'ITEMCODE', 'ITEM_CODE', 'ITEM CODE');
      const itemName = getCol(row, 'ITEMNAME', 'ITEM_NAME', 'ITEM NAME', 'DESCRIPTION');

      if (!itemCode) continue;

      try {
        const itemCodeStr = String(itemCode).trim().toUpperCase();
        const itemNameStr = String(itemName || itemCodeStr).trim();
        const itemType = String(getCol(row, 'ITEM_TYPE', 'ITEMTYPE', 'TYPE') || '').trim();
        const itemSubtype = String(getCol(row, 'ITEM_SUBTYPE', 'SUBTYPE', 'SUB_TYPE') || '').trim();
        const gsm = toNum(getCol(row, 'GSM'));
        const widthMm = toNum(getCol(row, 'WIDTH_MM', 'WIDTH', 'WIDTHMM'));
        const storeStock = toNum(getCol(row, 'STORE_STOCK', 'STORE STOCK', 'STORESTOCK', 'CLOSING_STOCK', 'CLOSING STOCK'));
        const qcHold = toNum(getCol(row, 'QC_HOLD', 'QC HOLD', 'QCHOLD'));
        const processStock = toNum(getCol(row, 'PROCESS_STOCK', 'PROCESS STOCK', 'PROCESSSTOCK'));
        const last30Cons = toNum(getCol(row, 'LAST_30_CONS', 'LAST30CONS', 'AVG_CONSUMPTION', 'AVG CONSUMPTION', 'CONSUMPTION'));
        const pendingPo = toNum(getCol(row, 'PENDING_PO', 'PENDING PO', 'PENDINGPO', 'OPEN_PO'));

        // Upsert raw material
        const rmResult = await client.query(
          `INSERT INTO raw_materials (item_code, item_name, item_type, item_subtype, gsm, width_mm)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (item_code) DO UPDATE SET
             item_name = EXCLUDED.item_name,
             item_type = CASE WHEN EXCLUDED.item_type != '' THEN EXCLUDED.item_type ELSE raw_materials.item_type END,
             item_subtype = CASE WHEN EXCLUDED.item_subtype != '' THEN EXCLUDED.item_subtype ELSE raw_materials.item_subtype END,
             gsm = CASE WHEN EXCLUDED.gsm > 0 THEN EXCLUDED.gsm ELSE raw_materials.gsm END,
             width_mm = CASE WHEN EXCLUDED.width_mm > 0 THEN EXCLUDED.width_mm ELSE raw_materials.width_mm END,
             updated_at = NOW()
           RETURNING id`,
          [itemCodeStr, itemNameStr, itemType || null, itemSubtype || null, gsm || null, widthMm || null]
        );

        const rmId = rmResult.rows[0].id;

        // Upsert stock
        await client.query(
          `INSERT INTO stock (raw_material_id, store_stock, qc_hold, process_stock, last_30_cons, pending_po, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (raw_material_id) DO UPDATE SET
             store_stock = EXCLUDED.store_stock,
             qc_hold = EXCLUDED.qc_hold,
             process_stock = EXCLUDED.process_stock,
             last_30_cons = EXCLUDED.last_30_cons,
             pending_po = EXCLUDED.pending_po,
             updated_at = NOW()`,
          [rmId, storeStock, qcHold, processStock, last30Cons, pendingPo]
        );

        count++;
      } catch (rowErr) {
        errors.push({ row: r, itemCode: String(itemCode), error: rowErr.message });
      }
    }

    // Log the import
    await client.query(
      `INSERT INTO stock_imports (filename, imported_by, record_count, error_count, errors)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.file.originalname, req.user.id, count, errors.length, JSON.stringify(errors)]
    );

    await client.query('COMMIT');
    res.json({ success: true, count, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stock import error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  } finally {
    client.release();
  }
});

// GET /api/stock/imports
router.get('/imports', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT si.*, u.name AS imported_by_name
       FROM stock_imports si
       LEFT JOIN users u ON si.imported_by = u.id
       ORDER BY si.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

module.exports = router;
