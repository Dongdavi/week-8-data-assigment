// routes/orders.js
const express = require('express');
const router = express.Router();
const db = require('../db');

/*
Expected order payload to create:
{
  "user_id": 1,
  "address_id": 1,
  "items": [
    {"product_id": 1, "quantity": 2},
    {"product_id": 3, "quantity": 1}
  ]
}
*/

// Create order
router.post('/', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { user_id, address_id, items } = req.body;
    if (!user_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('user_id and non-empty items required');
    }

    // calculate total and check stock
    let total = 0;
    for (const it of items) {
      const [prodRows] = await conn.query('SELECT id, price, stock FROM products WHERE id = ?', [it.product_id]);
      if (prodRows.length === 0) throw new Error(`Product ${it.product_id} not found`);
      const prod = prodRows[0];
      if (prod.stock < it.quantity) throw new Error(`Insufficient stock for product ${it.product_id}`);
      total += Number(prod.price) * Number(it.quantity);
    }

    // create order
    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, address_id, total_amount) VALUES (?, ?, ?)',
      [user_id, address_id || null, total]
    );
    const orderId = orderResult.insertId;

    // insert order_items and reduce stock
    for (const it of items) {
      const [prodRows] = await conn.query('SELECT price, stock FROM products WHERE id = ?', [it.product_id]);
      const price = prodRows[0].price;
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, unit_price, quantity) VALUES (?, ?, ?, ?)',
        [orderId, it.product_id, price, it.quantity]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [it.quantity, it.product_id]);
    }

    await conn.commit();
    const [orderRows] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    res.status(201).json(orderRows[0]);
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// Get order by id (with items)
router.get('/:id', async (req, res, next) => {
  try {
    const orderId = req.params.id;
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) return res.status(404).json({ error: 'Order not found' });

    const [items] = await db.query(
      `SELECT oi.*, p.name AS product_name FROM order_items oi
       JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [orderId]
    );
    res.json({ order: orders[0], items });
  } catch (err) { next(err); }
});

// List orders (optional ?user_id=)
router.get('/', async (req, res, next) => {
  try {
    const { user_id } = req.query;
    let q = 'SELECT * FROM orders';
    const params = [];
    if (user_id) { q += ' WHERE user_id = ?'; params.push(user_id); }
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (err) { next(err); }
});

// Update order status (partial update)
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status required' });
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(rows[0] || { message: 'Order updated but not found' });
  } catch (err) { next(err); }
});

module.exports = router;
