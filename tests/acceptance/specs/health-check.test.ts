import supertest from 'supertest';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('Health check endpoint', () => {
    it('GET /partner-app/api/health-check returns 200', async () => {
        const res = await request.get('/partner-app/api/health-check');
        expect(res.status).toBe(200);
    });

    it('GET /partner-app/api/health-check returns status "healthy"', async () => {
        const res = await request.get('/partner-app/api/health-check');
        expect(res.body).toEqual({ status: 'healthy' });
    });

    it('GET /partner-app/api/health-check does not contain message field', async () => {
        const res = await request.get('/partner-app/api/health-check');
        expect(res.body.message).toBeUndefined();
    });

    it('GET /partner-app/api/health-check response body contains only status field', async () => {
        const res = await request.get('/partner-app/api/health-check');
        expect(Object.keys(res.body)).toEqual(['status']);
    });
});
