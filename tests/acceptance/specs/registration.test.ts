import supertest from 'supertest';

import { BASE, validUserData } from './helpers/api';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('POST /users/register', () => {
    it('should register a new user and return 201 with user DTO', async () => {
        const data = validUserData();
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(201);
        expect(res.body).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
            }),
        );
        expect(res.body).toHaveProperty('createdAt');
        expect(res.body).toHaveProperty('updatedAt');
        expect(res.body).not.toHaveProperty('password');
        expect(res.body).not.toHaveProperty('passwordHash');
    });

    it('should return 422 with structured errors when body is empty', async () => {
        const res = await request
            .post(`${BASE}/users/register`)
            .set('Content-Type', 'application/json')
            .send({});

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
        expect(res.body.errors).toHaveProperty('password');
    });

    it('should return 422 when email is missing', async () => {
        const { email: _email, ...data } = validUserData();
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('email');
    });

    it('should return 422 when password is missing', async () => {
        const { password: _password, ...data } = validUserData();
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
        expect(res.body.errors).toHaveProperty('password');
    });

    it('should return 415 when Content-Type is not application/json', async () => {
        const res = await request
            .post(`${BASE}/users/register`)
            .set('Content-Type', 'text/plain')
            .send('not json');

        expect(res.status).toBe(415);
        expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
    });

    it('should return 409 when email already exists', async () => {
        const data = validUserData();
        await request.post(`${BASE}/users/register`).send(data);

        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(409);
    });

    it('should return 422 for invalid email format', async () => {
        const data = validUserData({ email: 'not-an-email' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 422 for weak password (too short)', async () => {
        const data = validUserData({ password: 'Ab1' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 422 for weak password (no uppercase)', async () => {
        const data = validUserData({ password: 'weakpass1' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });

    it('should return 422 for weak password (no lowercase)', async () => {
        const data = validUserData({ password: 'WEAKPASS1' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });

    it('should return 422 for weak password (no number)', async () => {
        const data = validUserData({ password: 'WeakPassword' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });

    it('should strip extra fields and not include them in the response', async () => {
        const data = { ...validUserData(), admin: true, role: 'superuser' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(201);
        expect(res.body).not.toHaveProperty('admin');
        expect(res.body).not.toHaveProperty('role');
    });

    it('should return 422 when email is an empty string', async () => {
        const data = validUserData({ email: '' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body.errors).toHaveProperty('email');
    });

    it('should return 422 when firstName is an empty string', async () => {
        const data = validUserData({ firstName: '' });
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body.errors).toHaveProperty('firstName');
    });

    it('should return 422 when a number is sent as email (type error)', async () => {
        const res = await request.post(`${BASE}/users/register`).send({
            email: 12345,
            password: 'StrongPass1',
            firstName: 'Test',
            lastName: 'User',
        });

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('message', 'Validation failed');
        expect(res.body.errors).toHaveProperty('email');
    });
});
