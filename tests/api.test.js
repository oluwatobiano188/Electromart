const request = require('supertest');

jest.mock('../src/config/db', () => ({ query: jest.fn(), connect: jest.fn(), on: jest.fn() }));
jest.mock('stripe', () => jest.fn().mockImplementation(() => ({
  checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
})));

const app = require('../src/app');
const pool = require('../src/config/db');

describe('GET /', () => {
  it('returns 200 and service info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('ElectroMart API');
  });
});

describe('POST /api/auth/register', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
  });
  it('creates a user successfully', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'uuid-1', name: 'Alice', email: 'alice@test.com', role: 'customer', created_at: new Date() }] });
    const res = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });
  it('returns 409 for duplicate email', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    const res = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@test.com', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/products', () => {
  it('returns product list', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 'p1', name: 'MacBook Pro', price: '1999.99' }] }).mockResolvedValueOnce({ rows: [{ count: '1' }] });
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.products).toBeDefined();
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
