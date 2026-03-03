const pool = require('../config/db');

const getCart = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.slug, p.price, p.compare_price, p.stock, p.images, p.sku
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1 AND p.is_active = true ORDER BY ci.created_at ASC`,
      [req.user.id]
    );
    const items = result.rows;
    const subtotal = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
    res.json({ items, summary: { item_count: items.reduce((sum, i) => sum + i.quantity, 0), subtotal: subtotal.toFixed(2) } });
  } catch (err) { next(err); }
};

const addItem = async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const product = await pool.query('SELECT id, stock FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (!product.rows.length) return res.status(404).json({ error: 'Product not found' });
    if (product.rows[0].stock < quantity) return res.status(409).json({ error: 'Insufficient stock' });
    const result = await pool.query(
      `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW()
       RETURNING *`,
      [req.user.id, product_id, quantity]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) { next(err); }
};

const updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity <= 0) {
      await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      return res.status(204).send();
    }
    const result = await pool.query(
      'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Cart item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) { next(err); }
};

const removeItem = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).send();
  } catch (err) { next(err); }
};

const clearCart = async (req, res, next) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
