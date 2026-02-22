import supertest from 'supertest';

import { BASE, registerAndLogin } from './helpers/api';
import { flushRateLimitKeys } from './helpers/redis';
import { clearEventbusFile, getResetKeyForEmail } from './helpers/eventbus';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('Password Reset', () => {
    beforeAll(async () => {
        await flushRateLimitKeys();
        clearEventbusFile();
    });

    describe('POST /users/reset-key', () => {
        beforeEach(async () => {
            await flushRateLimitKeys();
        });

        it('should return 200 with generic message for existing email', async () => {
            const user = await registerAndLogin();

            const res = await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'If an account with that email exists, a reset key has been generated.',
            });
        });

        it('should return 200 with same generic message for non-existent email', async () => {
            const res = await request.post(`${BASE}/users/reset-key`).send({
                email: 'nonexistent-reset@example.com',
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'If an account with that email exists, a reset key has been generated.',
            });
        });

        it('should return 415 when Content-Type is not application/json', async () => {
            const res = await request
                .post(`${BASE}/users/reset-key`)
                .set('Content-Type', 'text/plain')
                .send('not json');

            expect(res.status).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
        });

        it('should return 422 when email is missing', async () => {
            const res = await request
                .post(`${BASE}/users/reset-key`)
                .set('Content-Type', 'application/json')
                .send({});

            expect(res.status).toBe(422);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('email');
        });
    });

    describe('POST /users/validate-reset-key', () => {
        beforeEach(async () => {
            await flushRateLimitKeys();
        });

        it('should return 200 with { valid: true } for a valid reset key', async () => {
            const user = await registerAndLogin();
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);
            expect(resetKey).not.toBeNull();

            await flushRateLimitKeys();
            const res = await request.post(`${BASE}/users/validate-reset-key`).send({
                resetKey,
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ valid: true });
        });

        it('should return 200 with { valid: false } for an invalid/random key', async () => {
            const res = await request.post(`${BASE}/users/validate-reset-key`).send({
                resetKey: 'totally-invalid-random-key-value',
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ valid: false });
        });

        it('should return 415 when Content-Type is not application/json', async () => {
            const res = await request
                .post(`${BASE}/users/validate-reset-key`)
                .set('Content-Type', 'text/plain')
                .send('not json');

            expect(res.status).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
        });

        it('should return 422 when resetKey is missing', async () => {
            const res = await request
                .post(`${BASE}/users/validate-reset-key`)
                .set('Content-Type', 'application/json')
                .send({});

            expect(res.status).toBe(422);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('resetKey');
        });
    });

    describe('POST /users/password/reset', () => {
        const newPassword = 'NewStr0ngPass';

        beforeEach(async () => {
            await flushRateLimitKeys();
        });

        it('should return 200 on successful password reset', async () => {
            const user = await registerAndLogin();
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);
            expect(resetKey).not.toBeNull();

            await flushRateLimitKeys();
            const res = await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword,
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                message: 'Password has been reset successfully.',
            });
        });

        it('should allow login with new password after reset', async () => {
            const user = await registerAndLogin();
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);

            await flushRateLimitKeys();
            await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword,
            });

            await flushRateLimitKeys();
            const loginRes = await request.post(`${BASE}/users/login`).send({
                email: user.email,
                password: newPassword,
            });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body).toHaveProperty('accessToken');
            expect(loginRes.body).toHaveProperty('refreshToken');
        });

        it('should reject login with old password after reset', async () => {
            const originalPassword = 'StrongPass1';
            const user = await registerAndLogin({ password: originalPassword });
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);

            await flushRateLimitKeys();
            await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword,
            });

            await flushRateLimitKeys();
            const loginRes = await request.post(`${BASE}/users/login`).send({
                email: user.email,
                password: originalPassword,
            });

            expect(loginRes.status).toBe(401);
        });

        it('should return 400 for invalid reset key', async () => {
            const res = await request.post(`${BASE}/users/password/reset`).send({
                resetKey: 'totally-invalid-key',
                newPassword,
            });

            expect(res.status).toBe(400);
            expect(res.body).toEqual({ message: 'Invalid or expired reset key' });
        });

        it('should return 422 for weak password', async () => {
            const user = await registerAndLogin();
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);

            await flushRateLimitKeys();
            const res = await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword: 'weak',
            });

            expect(res.status).toBe(422);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('newPassword');
        });

        it('should return 415 when Content-Type is not application/json', async () => {
            const res = await request
                .post(`${BASE}/users/password/reset`)
                .set('Content-Type', 'text/plain')
                .send('not json');

            expect(res.status).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
        });

        it('should return 422 when required fields are missing', async () => {
            const res = await request
                .post(`${BASE}/users/password/reset`)
                .set('Content-Type', 'application/json')
                .send({});

            expect(res.status).toBe(422);
            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors).toHaveProperty('resetKey');
            expect(res.body.errors).toHaveProperty('newPassword');
        });
    });

    describe('single-use key', () => {
        it('should return 400 on second reset attempt with same key', async () => {
            await flushRateLimitKeys();
            const user = await registerAndLogin();
            clearEventbusFile();

            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);
            expect(resetKey).not.toBeNull();

            // First reset succeeds
            await flushRateLimitKeys();
            const firstRes = await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword: 'FirstReset1',
            });
            expect(firstRes.status).toBe(200);

            // Second reset with the same key fails
            await flushRateLimitKeys();
            const secondRes = await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword: 'SecondReset1',
            });
            expect(secondRes.status).toBe(400);
            expect(secondRes.body).toEqual({ message: 'Invalid or expired reset key' });
        });
    });

    describe('refresh token revocation', () => {
        it('should invalidate refresh tokens after password reset', async () => {
            await flushRateLimitKeys();
            const user = await registerAndLogin();
            clearEventbusFile();

            // Request a reset key
            await request.post(`${BASE}/users/reset-key`).send({
                email: user.email,
            });

            const resetKey = getResetKeyForEmail(user.email);
            expect(resetKey).not.toBeNull();

            // Reset the password
            await flushRateLimitKeys();
            await request.post(`${BASE}/users/password/reset`).send({
                resetKey,
                newPassword: 'AfterReset1',
            });

            // Try to use the old refresh token — should fail
            await flushRateLimitKeys();
            const refreshRes = await request.post(`${BASE}/users/refresh`).send({
                refreshToken: user.refreshToken,
            });

            expect(refreshRes.status).toBe(401);
        });
    });

    describe('rate limiting', () => {
        beforeEach(async () => {
            await flushRateLimitKeys();
        });

        it('should return 429 on POST /users/reset-key after exceeding max attempts', async () => {
            const maxAttempts = 3;

            // Send maxAttempts requests (all should be allowed)
            for (let i = 0; i < maxAttempts; i++) {
                const r = await request.post(`${BASE}/users/reset-key`).send({
                    email: `ratelimit-reset-${i}@example.com`,
                });
                expect(r.status).not.toBe(429);
            }

            // Request beyond the limit should be rate limited
            const res = await request.post(`${BASE}/users/reset-key`).send({
                email: 'ratelimit-reset-extra@example.com',
            });

            expect(res.status).toBe(429);
            expect(res.body).toHaveProperty('message');
        });

        it('should return 429 on POST /users/validate-reset-key after exceeding max attempts', async () => {
            const maxAttempts = 10;

            for (let i = 0; i < maxAttempts; i++) {
                const r = await request.post(`${BASE}/users/validate-reset-key`).send({
                    resetKey: `fake-key-${i}`,
                });
                expect(r.status).not.toBe(429);
            }

            const res = await request.post(`${BASE}/users/validate-reset-key`).send({
                resetKey: 'fake-key-extra',
            });

            expect(res.status).toBe(429);
            expect(res.body).toHaveProperty('message');
        });

        it('should return 429 on POST /users/password/reset after exceeding max attempts', async () => {
            const maxAttempts = 5;

            for (let i = 0; i < maxAttempts; i++) {
                const r = await request.post(`${BASE}/users/password/reset`).send({
                    resetKey: `fake-key-${i}`,
                    newPassword: 'SomePass123',
                });
                expect(r.status).not.toBe(429);
            }

            const res = await request.post(`${BASE}/users/password/reset`).send({
                resetKey: 'fake-key-extra',
                newPassword: 'SomePass123',
            });

            expect(res.status).toBe(429);
            expect(res.body).toHaveProperty('message');
        });
    });
});
