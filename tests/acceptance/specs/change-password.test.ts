import supertest from 'supertest';

import { BASE, registerAndLogin } from './helpers/api';
import { flushRateLimitKeys } from './helpers/redis';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('PUT /users/password', () => {
    const originalPassword = 'StrongPass1';
    const newPassword = 'NewP@ssw0rd';

    it('should return 204 when changing password with valid credentials', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        const res = await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: originalPassword, newPassword });

        expect(res.status).toBe(204);
    });

    it('should fail to login with old password after change', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: originalPassword, newPassword });

        await flushRateLimitKeys();
        const loginRes = await request.post(`${BASE}/users/login`).send({
            email: user.email,
            password: originalPassword,
        });

        expect(loginRes.status).toBe(401);
    });

    it('should succeed to login with new password after change', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: originalPassword, newPassword });

        await flushRateLimitKeys();
        const loginRes = await request.post(`${BASE}/users/login`).send({
            email: user.email,
            password: newPassword,
        });

        expect(loginRes.status).toBe(200);
        expect(loginRes.body).toHaveProperty('accessToken');
        expect(loginRes.body).toHaveProperty('refreshToken');
    });

    it('should return 401 when current password is wrong', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        const res = await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: 'WrongP@ss1', newPassword });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty(
            'message',
            'Current password is incorrect',
        );
    });

    it('should return 422 with structured errors when new password is weak', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        const res = await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ currentPassword: originalPassword, newPassword: 'weak' });

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('newPassword');
        expect(res.body.errors.newPassword.length).toBeGreaterThan(0);
    });

    it('should return 422 with structured errors when fields are missing', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        const res = await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .set('Content-Type', 'application/json')
            .send({});

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('currentPassword');
        expect(res.body.errors).toHaveProperty('newPassword');
    });

    it('should return 401 when no Authorization header is provided', async () => {
        const res = await request
            .put(`${BASE}/users/password`)
            .send({ currentPassword: originalPassword, newPassword });

        expect(res.status).toBe(401);
    });

    it('should return 415 when Content-Type is not application/json', async () => {
        const user = await registerAndLogin({ password: originalPassword });

        const res = await request
            .put(`${BASE}/users/password`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .set('Content-Type', 'text/plain')
            .send('not json');

        expect(res.status).toBe(415);
        expect(res.body).toEqual({
            message: 'Content-Type must be application/json',
        });
    });
});
