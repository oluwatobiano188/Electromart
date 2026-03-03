const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');

const createCheckoutSession = async (req, res, next) => {
  try {
    const { shipping_address } = req.body;
    const cartResult = await pool.query(
      `SELECT ci.quantity, p.id AS product_id, p.name, p.price, p.stock, p.sku, p.images
       FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.user_id = $1 AND p.is_active = true`,
      [req.user.id]
    );
    if (!cartResult.rows.length) return res.status(400).json({ error: 'Cart is empty' });

    for (const item of cartResult.rows) {
      if (item.stock < item.quantity) return res.status(409).json({ error: `Insufficient stock for: ${item.name}` });
    }

    const TAX_RATE = 0.08;
    const SHIPPING_FLAT = 9.99;
    const subtotal = cartResult.rows.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax + SHIPPING_FLAT;

    const orderResult = await pool.query(
      'INSERT INTO orders (user_id, status, subtotal, tax, shipping, total, shipping_address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [req.user.id, 'pending', subtotal.toFixed(2), tax.toFixed(2), SHIPPING_FLAT, total.toFixed(2), JSON.stringify(shipping_address)]
    );
    const orderId = orderResult.rows[0].id;

    for (const item of cartResult.rows) {
      await pool.query(
        'INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, unit_price, total_price) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [orderId, item.product_id, item.name, item.sku, item.quantity, item.price, (parseFloat(item.price) * item.quantity).toFixed(2)]
      );
    }

    const lineItems = cartResult.rows.map((item) => ({
      price_data: { currency: 'usd', product_data: { name: item.name, images: (item.images || []).slice(0, 1) }, unit_amount: Math.round(parseFloat(item.price) * 100) },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
      customer_email: req.user.email,
      metadata: { order_id: orderId, user_id: req.user.id },
    });

    await pool.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, orderId]);
    res.json({ session_id: session.id, url: session.url, order_id: orderId });
  } catch (err) { next(err); }
};

const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.order_id;
    try {
      await pool.query('UPDATE orders SET status = $1, stripe_payment_intent_id = $2, updated_at = NOW() WHERE id = $3', ['paid', session.payment_intent, orderId]);
      const items = await pool.query('SELECT product_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
      for (const item of items.rows) {
        await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
      }
      await pool.query('DELETE FROM cart_items WHERE user_id = $1', [session.metadata.user_id]);
    } catch (err) { console.error('Webhook processing error:', err); }
  }
  res.json({ received: true });
};

const getSession = async (req, res, next) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const orderId = session.metadata?.order_id;
    const result = await pool.query(
      `SELECT o.id, o.status, o.total, o.shipping_address,
              json_agg(json_build_object('product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price)) AS items
       FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.id = $1 GROUP BY o.id`,
      [orderId]
    );
    res.json({ order: result.rows[0] || null });
  } catch (err) { next(err); }
};

module.exports = { createCheckoutSession, handleWebhook, getSession };
