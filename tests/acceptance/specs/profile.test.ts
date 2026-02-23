import supertest from 'supertest';

import { BASE, registerAndLogin } from './helpers/api';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('GET /users/profile', () => {
    it('should return 200 with user data when authenticated', async () => {
        const user = await registerAndLogin();

        const res = await request
            .get(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            }),
        );
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when no Authorization header is provided', async () => {
        const res = await request.get(`${BASE}/users/profile`);

        expect(res.status).toBe(401);
    });

    it('should return 401 when token is invalid', async () => {
        const res = await request
            .get(`${BASE}/users/profile`)
            .set('Authorization', 'Bearer invalid-token');

        expect(res.status).toBe(401);
    });
});

describe('PUT /users/profile', () => {
    it('should update firstName and return 200 with updated user', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ firstName: 'Updated' });

        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Updated');
        expect(res.body.lastName).toBe(user.lastName);
    });

    it('should update lastName and return 200 with updated user', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ lastName: 'NewLast' });

        expect(res.status).toBe(200);
        expect(res.body.lastName).toBe('NewLast');
        expect(res.body.firstName).toBe(user.firstName);
    });

    it('should return 422 when no fields are provided', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({});

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('_');
    });

    it('should strip extra fields and not persist them', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ firstName: 'Updated', admin: true, role: 'superuser' });

        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Updated');
        expect(res.body).not.toHaveProperty('admin');
        expect(res.body).not.toHaveProperty('role');
    });

    it('should return 422 when firstName is empty string', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ firstName: '' });

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 422 when lastName is empty string', async () => {
        const user = await registerAndLogin();

        const res = await request
            .put(`${BASE}/users/profile`)
            .set('Authorization', `Bearer ${user.accessToken}`)
            .send({ lastName: '' });

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
    });

    it('should return 401 when no Authorization header is provided', async () => {
        const res = await request
            .put(`${BASE}/users/profile`)
            .send({ firstName: 'Hacker' });

        expect(res.status).toBe(401);
    });
});
