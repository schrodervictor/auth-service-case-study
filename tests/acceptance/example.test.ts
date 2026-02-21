/**
 * Acceptance test example — black-box HTTP tests against the running API.
 * Run with: npm run test:acceptance
 *
 * Prerequisites:
 *   docker compose up          (full stack must be running)
 */
describe('Health check endpoint', () => {
    it.todo('GET /partner-app/api/health-check returns 200');

    // Uses supertest against the running API:
    //   import supertest from 'supertest';
    //   const request = supertest(process.env.API_URL ?? 'http://localhost:9000');
    //   it('returns 200', async () => {
    //       const res = await request.get('/partner-app/api/health-check');
    //       expect(res.status).toBe(200);
    //   });
});
