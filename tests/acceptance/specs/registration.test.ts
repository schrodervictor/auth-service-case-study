import crypto from 'node:crypto';
import supertest from 'supertest';

const request = supertest(process.env.API_URL ?? 'http://app:9000');
const BASE = '/partner-app/api';

function uniqueEmail(): string {
    return `test-${crypto.randomUUID()}@example.com`;
}

const validUser = () => ({
    email: uniqueEmail(),
    password: 'StrongPass1',
    firstName: 'Alice',
    lastName: 'Smith',
});

describe('POST /users/register', () => {
    it('should register a new user and return 201 with user DTO', async () => {
        const data = validUser();
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

    it('should return 400 when required fields are missing', async () => {
        const res = await request.post(`${BASE}/users/register`).send({});

        expect(res.status).toBe(400);
    });

    it('should return 400 when email is missing', async () => {
        const { email: _email, ...data } = validUser();
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
        const { password: _password, ...data } = validUser();
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(400);
    });

    it('should return 409 when email already exists', async () => {
        const data = validUser();
        await request.post(`${BASE}/users/register`).send(data);

        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(409);
    });

    it('should return 422 for invalid email format', async () => {
        const data = { ...validUser(), email: 'not-an-email' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 422 for weak password (too short)', async () => {
        const data = { ...validUser(), password: 'Ab1' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
        expect(res.body).toHaveProperty('errors');
    });

    it('should return 422 for weak password (no uppercase)', async () => {
        const data = { ...validUser(), password: 'weakpass1' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });

    it('should return 422 for weak password (no lowercase)', async () => {
        const data = { ...validUser(), password: 'WEAKPASS1' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });

    it('should return 422 for weak password (no number)', async () => {
        const data = { ...validUser(), password: 'WeakPassword' };
        const res = await request.post(`${BASE}/users/register`).send(data);

        expect(res.status).toBe(422);
    });
});
