import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

const loadApp = async () => {
  vi.resetModules();
  const mod = await import('../src/server');
  return mod.app;
};

describe('server', () => {
  it('GET /health returns ok', async () => {
    const app = await loadApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /transfer requires api key', async () => {
    delete process.env.API_KEY;
    const app = await loadApp();
    const res = await request(app)
      .post('/transfer')
      .send({ walletId: 'test', amount: 1, recipient: 'test' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'API key not configured' });
  });

  it('POST /transfer rejects missing fields', async () => {
    process.env.API_KEY = 'test-key';
    const app = await loadApp();
    const res = await request(app)
      .post('/transfer')
      .set('Authorization', 'Bearer test-key')
      .send({ amount: 1, recipient: 'test' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "walletId, amount, recipient, token ('SOL' | 'USDC') required",
    });
  });

  it('POST /deposit rejects missing fields', async () => {
    process.env.API_KEY = 'test-key';
    const app = await loadApp();
    const res = await request(app)
      .post('/deposit')
      .set('Authorization', 'Bearer test-key')
      .send({ amount: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "walletId, amount, token ('SOL' | 'USDC') required",
    });
  });

  it('POST /withdraw rejects missing fields', async () => {
    process.env.API_KEY = 'test-key';
    const app = await loadApp();
    const res = await request(app)
      .post('/withdraw')
      .set('Authorization', 'Bearer test-key')
      .send({ walletId: 'test', amount: 1 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "walletId, amount, recipient, token ('SOL' | 'USDC') required",
    });
  });

  it('POST /balance rejects missing fields', async () => {
    process.env.API_KEY = 'test-key';
    const app = await loadApp();
    const res = await request(app)
      .post('/balance')
      .set('Authorization', 'Bearer test-key')
      .send({ walletId: 'test' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "walletId, token ('SOL' | 'USDC') required",
    });
  });
});
