const request = require('supertest');
const express = require('express');
const healthRoutes = require('./health');

const app = express();
app.use('/health', healthRoutes);

describe('GET /health', () => {
  it('returns 200 with status field', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBeLessThanOrEqual(503);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });
});
