import supertest from 'supertest';

const request = supertest(process.env.API_URL ?? 'http://app:9000');
const DOCS_BASE = '/partner-app/api/docs';

describe('OpenAPI documentation endpoints', () => {
    it('GET /docs/ serves Swagger UI HTML', async () => {
        const res = await request.get(`${DOCS_BASE}/`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.text).toContain('Swagger UI');
    });

    it('GET /docs redirects to /docs/', async () => {
        const res = await request.get(DOCS_BASE);
        expect(res.status).toBe(301);
        expect(res.headers.location).toMatch(/docs\/$/);
    });

    it('GET /docs/spec.json returns valid OpenAPI JSON', async () => {
        const res = await request.get(`${DOCS_BASE}/spec.json`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body.openapi).toBe('3.0.3');
        expect(res.body.info).toBeDefined();
        expect(res.body.paths).toBeDefined();
    });

    it('GET /docs/spec.yaml returns valid OpenAPI YAML', async () => {
        const res = await request.get(`${DOCS_BASE}/spec.yaml`);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/yaml/);
        expect(res.text).toContain('openapi: 3.0.3');
        expect(res.text).toContain('paths:');
    });

    it('JSON spec documents all endpoints', async () => {
        const res = await request.get(`${DOCS_BASE}/spec.json`);
        const paths = Object.keys(res.body.paths);

        expect(paths).toContain('/health-check');
        expect(paths).toContain('/users/register');
        expect(paths).toContain('/users/login');
        expect(paths).toContain('/users/refresh');
        expect(paths).toContain('/users/logout');
        expect(paths).toContain('/users/profile');
    });
});
