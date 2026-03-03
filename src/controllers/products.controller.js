const pool = require('../config/db');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, search, minPrice, maxPrice, sort = 'created_at', order = 'desc' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = ['p.is_active = true'];
    const params = [];
    let i = 1;

    if (category) { conditions.push(`c.slug = $${i++}`); params.push(category); }
    if (search) { conditions.push(`(p.name ILIKE $${i} OR p.description ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (minPrice) { conditions.push(`p.price >= $${i++}`); params.push(minPrice); }
    if (maxPrice) { conditions.push(`p.price <= $${i++}`); params.push(maxPrice); }

    const allowedSorts = { price: 'p.price', name: 'p.name', created_at: 'p.created_at' };
    const sortCol = allowedSorts[sort] || 'p.created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';
    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT p.id, p.name, p.slug, p.price, p.compare_price, p.stock, p.images, p.specs, p.sku,
                c.name AS category_name, c.slug AS category_slug,
                COALESCE(AVG(r.rating), 0)::NUMERIC(3,1) AS avg_rating, COUNT(r.id) AS review_count
         FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN reviews r ON r.product_id = p.id
         ${where} GROUP BY p.id, c.name, c.slug ORDER BY ${sortCol} ${sortDir} LIMIT $${i} OFFSET $${i + 1}`,
        [...params, parseInt(limit), offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`, params
      ),
    ]);

    const total = parseInt(countRes.rows[0].count);
    res.json({ products: dataRes.rows, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              COALESCE(AVG(r.rating), 0)::NUMERIC(3,1) AS avg_rating, COUNT(r.id) AS review_count
       FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN reviews r ON r.product_id = p.id
       WHERE p.slug = $1 AND p.is_active = true GROUP BY p.id, c.name, c.slug`,
      [req.params.slug]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, slug, description, price, compare_price, stock, sku, category_id, images, specs } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, slug, description, price, compare_price, stock, sku, category_id, images, specs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [name, slug, description, price, compare_price || null, stock || 0, sku || null, category_id || null, JSON.stringify(images || []), JSON.stringify(specs || {})]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const fields = ['name', 'description', 'price', 'compare_price', 'stock', 'sku', 'category_id', 'images', 'specs', 'is_active'];
    const updates = [];
    const values = [];
    let i = 1;
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${i++}`);
        values.push(['images', 'specs'].includes(field) ? JSON.stringify(req.body[field]) : req.body[field]);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at = NOW()');
    values.push(req.params.id);
    const result = await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await pool.query('UPDATE products SET is_active = false WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { list, getOne, create, update, remove };
