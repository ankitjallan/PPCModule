const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

const n = (v) => (v === '' || v === undefined ? null : v);

// GET /api/spec-sheets
router.get('/', async (req, res) => {
  try {
    const { fg_code_id, customer_id, is_current } = req.query;
    const params = [];
    const conditions = [];

    if (is_current !== 'all') conditions.push('ss.is_current = TRUE');
    if (fg_code_id) { params.push(fg_code_id); conditions.push(`ss.fg_code_id = $${params.length}`); }
    if (customer_id) { params.push(customer_id); conditions.push(`c.id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ss.id, ss.fg_code_id, ss.version, ss.is_current, ss.total_gsm, ss.width_mm,
              ss.job_name, ss.no_of_colors, ss.no_of_ups, ss.reel_width_mm, ss.repeat_length_mm,
              ss.notes, ss.created_at,
              f.fg_code, f.description AS fg_description,
              c.id AS customer_id, c.name AS customer_name,
              u.name AS created_by_name
       FROM spec_sheets ss
       JOIN fg_codes f ON ss.fg_code_id = f.id
       LEFT JOIN customers c ON f.customer_id = c.id
       LEFT JOIN users u ON ss.created_by = u.id
       ${where}
       ORDER BY f.fg_code, ss.version DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get spec sheets error:', err);
    res.status(500).json({ error: 'Failed to fetch spec sheets' });
  }
});

// GET /api/spec-sheets/fg/:fgCodeId - get current spec sheet for FG code
router.get('/fg/:fgCodeId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ss.* FROM spec_sheets ss
       WHERE ss.fg_code_id = $1 AND ss.is_current = TRUE
       ORDER BY ss.version DESC LIMIT 1`,
      [req.params.fgCodeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No current spec sheet found for this FG code' });
    }

    const sheet = result.rows[0];
    const [films, cylinder, process] = await Promise.all([
      pool.query('SELECT * FROM spec_sheet_films WHERE spec_sheet_id = $1 ORDER BY layer_no', [sheet.id]),
      pool.query('SELECT * FROM spec_sheet_cylinders WHERE spec_sheet_id = $1', [sheet.id]),
      pool.query('SELECT * FROM spec_sheet_process WHERE spec_sheet_id = $1', [sheet.id]),
    ]);

    res.json({ ...sheet, films: films.rows, cylinder: cylinder.rows[0] || null, process: process.rows[0] || null });
  } catch (err) {
    console.error('Get spec sheet by FG code error:', err);
    res.status(500).json({ error: 'Failed to fetch spec sheet' });
  }
});

// GET /api/spec-sheets/:id - full spec sheet
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ss.*, f.fg_code, f.description AS fg_description,
              c.name AS customer_name, u.name AS created_by_name
       FROM spec_sheets ss
       JOIN fg_codes f ON ss.fg_code_id = f.id
       LEFT JOIN customers c ON f.customer_id = c.id
       LEFT JOIN users u ON ss.created_by = u.id
       WHERE ss.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Spec sheet not found' });

    const sheet = result.rows[0];
    const [films, cylinder, process] = await Promise.all([
      pool.query('SELECT * FROM spec_sheet_films WHERE spec_sheet_id = $1 ORDER BY layer_no', [sheet.id]),
      pool.query('SELECT * FROM spec_sheet_cylinders WHERE spec_sheet_id = $1', [sheet.id]),
      pool.query('SELECT * FROM spec_sheet_process WHERE spec_sheet_id = $1', [sheet.id]),
    ]);

    res.json({ ...sheet, films: films.rows, cylinder: cylinder.rows[0] || null, process: process.rows[0] || null });
  } catch (err) {
    console.error('Get spec sheet by id error:', err);
    res.status(500).json({ error: 'Failed to fetch spec sheet' });
  }
});

// POST /api/spec-sheets - create new spec sheet
router.post('/', authorize('admin', 'ppc_planner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      fg_code_id, total_gsm, width_mm, job_name, no_of_colors, no_of_ups,
      reel_width_mm, repeat_length_mm, notes, films, cylinder, process
    } = req.body;

    if (!fg_code_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'FG code is required' });
    }

    // Mark existing as not current
    await client.query(
      'UPDATE spec_sheets SET is_current = FALSE WHERE fg_code_id = $1',
      [fg_code_id]
    );

    // Get next version
    const versionResult = await client.query(
      'SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM spec_sheets WHERE fg_code_id = $1',
      [fg_code_id]
    );
    const version = versionResult.rows[0].next_version;

    const ssResult = await client.query(
      `INSERT INTO spec_sheets
         (fg_code_id, version, is_current, total_gsm, width_mm, job_name, no_of_colors, no_of_ups, reel_width_mm, repeat_length_mm, notes, created_by)
       VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [fg_code_id, version, n(total_gsm), n(width_mm), job_name, no_of_colors || 0, no_of_ups || 1,
       n(reel_width_mm), n(repeat_length_mm), notes, req.user.id]
    );
    const sheet = ssResult.rows[0];

    // Insert films
    if (films && films.length > 0) {
      for (const film of films) {
        await client.query(
          `INSERT INTO spec_sheet_films
             (spec_sheet_id, layer_no, raw_material_id, item_code, item_name, gsm, width_mm, micron, std_wastage, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [sheet.id, film.layer_no, film.raw_material_id || null, film.item_code,
           film.item_name, n(film.gsm), n(film.width_mm), n(film.micron), film.std_wastage || 5, film.notes]
        );
      }
    }

    // Insert cylinder
    if (cylinder) {
      await client.query(
        `INSERT INTO spec_sheet_cylinders
           (spec_sheet_id, cylinder_type, circumference_mm, cylinder_code, supplier, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sheet.id, cylinder.cylinder_type, n(cylinder.circumference_mm),
         cylinder.cylinder_code, cylinder.supplier, cylinder.remarks]
      );
    }

    // Insert process
    if (process) {
      await client.query(
        `INSERT INTO spec_sheet_process
           (spec_sheet_id, has_printing, printing_machine_id, has_ecl, ecl_machine_id,
            has_lam1, lam1_machine_id, has_lam2, lam2_machine_id, has_slitting, slitting_machine_id,
            has_pouching, pouching_machine_id, special_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [sheet.id,
         process.has_printing || false, process.printing_machine_id || null,
         process.has_ecl || false, process.ecl_machine_id || null,
         process.has_lam1 || false, process.lam1_machine_id || null,
         process.has_lam2 || false, process.lam2_machine_id || null,
         process.has_slitting || false, process.slitting_machine_id || null,
         process.has_pouching || false, process.pouching_machine_id || null,
         process.special_instructions || null]
      );
    }

    await client.query('COMMIT');

    // Return full sheet
    const filmsRes = await pool.query('SELECT * FROM spec_sheet_films WHERE spec_sheet_id = $1 ORDER BY layer_no', [sheet.id]);
    const cylRes = await pool.query('SELECT * FROM spec_sheet_cylinders WHERE spec_sheet_id = $1', [sheet.id]);
    const procRes = await pool.query('SELECT * FROM spec_sheet_process WHERE spec_sheet_id = $1', [sheet.id]);

    res.status(201).json({
      ...sheet,
      films: filmsRes.rows,
      cylinder: cylRes.rows[0] || null,
      process: procRes.rows[0] || null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create spec sheet error:', err);
    res.status(500).json({ error: 'Failed to create spec sheet' });
  } finally {
    client.release();
  }
});

// PUT /api/spec-sheets/:id - create new version
router.put('/:id', authorize('admin', 'ppc_planner'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM spec_sheets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Spec sheet not found' });
    }

    const old = existing.rows[0];

    // Mark existing as not current
    await client.query(
      'UPDATE spec_sheets SET is_current = FALSE WHERE fg_code_id = $1',
      [old.fg_code_id]
    );

    const {
      total_gsm, width_mm, job_name, no_of_colors, no_of_ups,
      reel_width_mm, repeat_length_mm, notes, films, cylinder, process
    } = req.body;

    const ssResult = await client.query(
      `INSERT INTO spec_sheets
         (fg_code_id, version, is_current, total_gsm, width_mm, job_name, no_of_colors, no_of_ups, reel_width_mm, repeat_length_mm, notes, created_by)
       VALUES ($1, $2, TRUE, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [old.fg_code_id, old.version + 1,
       total_gsm || old.total_gsm, width_mm || old.width_mm,
       job_name || old.job_name, no_of_colors || old.no_of_colors,
       no_of_ups || old.no_of_ups, reel_width_mm || old.reel_width_mm,
       repeat_length_mm || old.repeat_length_mm, notes || old.notes, req.user.id]
    );
    const sheet = ssResult.rows[0];

    if (films && films.length > 0) {
      for (const film of films) {
        await client.query(
          `INSERT INTO spec_sheet_films
             (spec_sheet_id, layer_no, raw_material_id, item_code, item_name, gsm, width_mm, micron, std_wastage, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [sheet.id, film.layer_no, film.raw_material_id || null, film.item_code,
           film.item_name, n(film.gsm), n(film.width_mm), n(film.micron), film.std_wastage || 5, film.notes]
        );
      }
    }

    if (cylinder) {
      await client.query(
        `INSERT INTO spec_sheet_cylinders (spec_sheet_id, cylinder_type, circumference_mm, cylinder_code, supplier, remarks)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sheet.id, cylinder.cylinder_type, n(cylinder.circumference_mm), cylinder.cylinder_code, cylinder.supplier, cylinder.remarks]
      );
    }

    if (process) {
      await client.query(
        `INSERT INTO spec_sheet_process
           (spec_sheet_id, has_printing, printing_machine_id, has_ecl, ecl_machine_id,
            has_lam1, lam1_machine_id, has_lam2, lam2_machine_id, has_slitting, slitting_machine_id,
            has_pouching, pouching_machine_id, special_instructions)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [sheet.id,
         process.has_printing || false, process.printing_machine_id || null,
         process.has_ecl || false, process.ecl_machine_id || null,
         process.has_lam1 || false, process.lam1_machine_id || null,
         process.has_lam2 || false, process.lam2_machine_id || null,
         process.has_slitting || false, process.slitting_machine_id || null,
         process.has_pouching || false, process.pouching_machine_id || null,
         process.special_instructions || null]
      );
    }

    await client.query('COMMIT');
    res.json(sheet);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update spec sheet error:', err);
    res.status(500).json({ error: 'Failed to update spec sheet' });
  } finally {
    client.release();
  }
});

module.exports = router;
