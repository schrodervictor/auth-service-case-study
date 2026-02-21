/**
 * Acceptance test example — black-box HTTP tests against the running API.
 * Run with: npm run test:acceptance
 *
 * Prerequisites:
 *   docker compose up          (full stack must be running)
 */
import supertest from 'supertest';

describe('Health check endpoint', () => {
    it.todo('GET /partner-app/api/health-check returns 200');

    // Uncomment once the API is running and a health-check route exists:
    //
    // const API_URL = process.env.API_URL ?? 'http://localhost:9000';
    // const request = supertest(API_URL);
    //
    // it('returns 200 on the health-check endpoint', async () => {
    //     const res = await request.get('/partner-app/api/health-check');
    //     expect(res.status).toBe(200);
    // });
});
