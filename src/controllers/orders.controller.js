const pool = require('../config/db');

const myOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await pool.query(
      `SELECT o.id, o.status, o.subtotal, o.tax, o.shipping, o.total, o.shipping_address, o.created_at,
              json_agg(json_build_object('id', oi.id, 'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'total_price', oi.total_price)) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.user_id = $1
       GROUP BY o.id ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), offset]
    );
    res.json({ orders: result.rows });
  } catch (err) { next(err); }
};

const getOrder = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT o.*, json_agg(json_build_object('id', oi.id, 'product_id', oi.product_id, 'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'total_price', oi.total_price)) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.id = $1 AND o.user_id = $2 GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: result.rows[0] });
  } catch (err) { next(err); }
};

const allOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let i = 1;
    if (status) { conditions.push(`o.status = $${i++}`); params.push(status); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at, u.name AS customer_name, u.email AS customer_email
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ${where} ORDER BY o.created_at DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ orders: result.rows });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: result.rows[0] });
  } catch (err) { next(err); }
};

module.exports = { myOrders, getOrder, allOrders, updateStatus };
