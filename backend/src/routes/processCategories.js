const express = require('express');
const pool = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM process_categories ORDER BY sequence_order, name');
    res.json(result.rows);
  } catch (err) {
    console.error('Get process categories error:', err);
    res.status(500).json({ error: 'Failed to fetch process categories' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, sequence_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const result = await pool.query(
      'INSERT INTO process_categories (name, sequence_order) VALUES ($1, $2) RETURNING *',
      [name, sequence_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Category name already exists' });
    res.status(500).json({ error: 'Failed to create process category' });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const { name, sequence_order } = req.body;
    const result = await pool.query(
      `UPDATE process_categories SET
         name = COALESCE($1, name),
         sequence_order = COALESCE($2, sequence_order)
       WHERE id = $3 RETURNING *`,
      [name, sequence_order === '' ? null : sequence_order, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update process category error:', err);
    res.status(500).json({ error: 'Failed to update process category' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM process_categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    res.json({ message: 'Category deleted' });
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Category is in use and cannot be deleted' });
    res.status(500).json({ error: 'Failed to delete process category' });
  }
});

module.exports = router;
