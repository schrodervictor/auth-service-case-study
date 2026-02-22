import supertest from 'supertest';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('Health check endpoint', () => {
    it('GET /partner-app/api/health-check returns 200', async () => {
        const res = await request.get('/partner-app/api/health-check');
        expect(res.status).toBe(200);
    });
});
