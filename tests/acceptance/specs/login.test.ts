import crypto from 'node:crypto';
import supertest from 'supertest';

import { flushRateLimitKeys } from './helpers/redis';

const request = supertest(process.env.API_URL ?? 'http://app:9000');
const BASE = '/partner-app/api';

function uniqueEmail(): string {
    return `test-${crypto.randomUUID()}@example.com`;
}

async function registerUser(overrides?: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}>) {
    const data = {
        email: uniqueEmail(),
        password: 'StrongPass1',
        firstName: 'Bob',
        lastName: 'Jones',
        ...overrides,
    };
    await request.post(`${BASE}/users/register`).send(data);
    return data;
}

describe('POST /users/login', () => {
    beforeAll(async () => {
        await flushRateLimitKeys();
    });

    it('should login with valid credentials and return 200 with tokens', async () => {
        const user = await registerUser();

        const res = await request.post(`${BASE}/users/login`).send({
            email: user.email,
            password: user.password,
        });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(
            expect.objectContaining({
                accessToken: expect.any(String),
                refreshToken: expect.any(String),
            }),
        );
    });

    it('should return 401 for wrong password', async () => {
        const user = await registerUser();

        const res = await request.post(`${BASE}/users/login`).send({
            email: user.email,
            password: 'WrongPassword1',
        });

        expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent email', async () => {
        const res = await request.post(`${BASE}/users/login`).send({
            email: 'nonexistent@example.com',
            password: 'StrongPass1',
        });

        expect(res.status).toBe(401);
    });

    it('should return 400 when required fields are missing', async () => {
        const res = await request.post(`${BASE}/users/login`).send({});

        expect(res.status).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
        const res = await request.post(`${BASE}/users/login`).send({
            email: 'someone@example.com',
        });

        expect(res.status).toBe(400);
    });
});
