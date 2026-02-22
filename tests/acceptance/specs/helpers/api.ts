import crypto from 'node:crypto';
import supertest from 'supertest';

const request = supertest(process.env.API_URL ?? 'http://app:9000');
export const BASE = '/partner-app/api';

export function uniqueEmail(): string {
    return `test-${crypto.randomUUID()}@example.com`;
}

export function validUserData(overrides?: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}>) {
    return {
        email: uniqueEmail(),
        password: 'StrongPass1',
        firstName: 'Test',
        lastName: 'User',
        ...overrides,
    };
}

/**
 * Register a user and login, returning tokens and user info.
 * Flushes rate limit keys before the login call to avoid 429 interference.
 */
export async function registerAndLogin(overrides?: Partial<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
}>): Promise<{
    accessToken: string;
    refreshToken: string;
    email: string;
    firstName: string;
    lastName: string;
}> {
    const { flushRateLimitKeys } = await import('./redis');

    const data = validUserData(overrides);

    await request.post(`${BASE}/users/register`).send(data);

    await flushRateLimitKeys();
    const loginRes = await request.post(`${BASE}/users/login`).send({
        email: data.email,
        password: data.password,
    });

    return {
        accessToken: loginRes.body.accessToken,
        refreshToken: loginRes.body.refreshToken,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
    };
}

export { request };
