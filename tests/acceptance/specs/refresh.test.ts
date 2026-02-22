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

    it('should return 400 when refreshToken field is missing', async () => {
        await flushRateLimitKeys();
        const res = await request.post(`${BASE}/users/refresh`).send({});

        expect(res.status).toBe(400);
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
