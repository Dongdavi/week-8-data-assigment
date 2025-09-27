// routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Create product
router.post('/', async (req, res, next) => {
  try {
    const { sku, name, description, price, stock, category_id } = req.body;
    const [result] = await db.query(
      `INSERT INTO products (sku, name, description, price, stock, category_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sku, name, description || null, price, stock || 0, category_id || null]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Read all products (with optional ?category_id=)
router.get('/', async (req, res, next) => {
  try {
    const { category_id } = req.query;
    let q = 'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id';
    const params = [];
    if (category_id) { q += ' WHERE p.category_id = ?'; params.push(category_id); }
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Read single product
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Update product
router.put('/:id', async (req, res, next) => {
  try {
    const { sku, name, description, price, stock, category_id } = req.body;
    await db.query(
      `UPDATE products SET sku=?, name=?, description=?, price=?, stock=?, category_id=?
       WHERE id=?`,
      [sku, name, description || null, price, stock, category_id || null, req.params.id]
    );
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found after update' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Delete product
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
