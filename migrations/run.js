require('dotenv').config();
const pool = require('../src/config/db');

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('Running migrations...');
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS categories (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(100) UNIQUE NOT NULL, slug VARCHAR(100) UNIQUE NOT NULL, description TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS products (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name VARCHAR(255) NOT NULL, slug VARCHAR(255) UNIQUE NOT NULL, description TEXT, price NUMERIC(10,2) NOT NULL CHECK (price >= 0), compare_price NUMERIC(10,2), stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0), sku VARCHAR(100) UNIQUE, category_id UUID REFERENCES categories(id) ON DELETE SET NULL, images JSONB DEFAULT '[]', specs JSONB DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS orders (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES users(id) ON DELETE SET NULL, status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded')), subtotal NUMERIC(10,2) NOT NULL, tax NUMERIC(10,2) NOT NULL DEFAULT 0, shipping NUMERIC(10,2) NOT NULL DEFAULT 0, total NUMERIC(10,2) NOT NULL, shipping_address JSONB NOT NULL, stripe_payment_intent_id VARCHAR(255), stripe_session_id VARCHAR(255), notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS order_items (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), order_id UUID REFERENCES orders(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id) ON DELETE SET NULL, product_name VARCHAR(255) NOT NULL, product_sku VARCHAR(100), quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(10,2) NOT NULL, total_price NUMERIC(10,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS cart_items (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID REFERENCES users(id) ON DELETE CASCADE, product_id UUID REFERENCES products(id) ON DELETE CASCADE, quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0), created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (user_id, product_id));
      CREATE TABLE IF NOT EXISTS reviews (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), product_id UUID REFERENCES products(id) ON DELETE CASCADE, user_id UUID REFERENCES users(id) ON DELETE CASCADE, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), title VARCHAR(255), body TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (product_id, user_id));
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
    `);
    console.log('Migrations complete!');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
