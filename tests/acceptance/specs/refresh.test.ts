import supertest from 'supertest';

import { BASE, registerAndLogin } from './helpers/api';
import { flushRateLimitKeys } from './helpers/redis';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('POST /users/refresh', () => {
    beforeAll(async () => {
        await flushRateLimitKeys();
    });

    it('should return 200 with a new token pair for a valid refresh token', async () => {
        const user = await registerAndLogin();

        await flushRateLimitKeys();
        const res = await request.post(`${BASE}/users/refresh`).send({
            refreshToken: user.refreshToken,
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            }),
        );
        // New tokens should be different from the original (rotation)
        expect(res.body.refreshToken).not.toBe(user.refreshToken);
    });

    it('should return 401 for an invalid refresh token', async () => {
        await flushRateLimitKeys();
        const res = await request.post(`${BASE}/users/refresh`).send({
            refreshToken: 'invalid-token-value',
        });

        expect(res.status).toBe(401);
    });

    it('should return 422 with structured errors when refreshToken field is missing', async () => {
        await flushRateLimitKeys();
        const res = await request
            .post(`${BASE}/users/refresh`)
            .set('Content-Type', 'application/json')
            .send({});

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('refreshToken');
    });

    it('should return 415 when Content-Type is not application/json', async () => {
        await flushRateLimitKeys();
        const res = await request
            .post(`${BASE}/users/refresh`)
            .set('Content-Type', 'text/plain')
            .send('not json');

        expect(res.status).toBe(415);
        expect(res.body).toEqual({
            message: 'Content-Type must be application/json',
        });
    });

    it('should invalidate old refresh token after rotation', async () => {
        const user = await registerAndLogin();

        // Use the refresh token once (rotation creates a new one)
        await flushRateLimitKeys();
        await request.post(`${BASE}/users/refresh`).send({
            refreshToken: user.refreshToken,
        });

        // Try using the same (now-rotated) refresh token again
        await flushRateLimitKeys();
        const res = await request.post(`${BASE}/users/refresh`).send({
            refreshToken: user.refreshToken,
        });

        expect(res.status).toBe(401);
    });
});
