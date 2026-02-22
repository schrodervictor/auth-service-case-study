import supertest from 'supertest';

import { BASE, registerAndLogin } from './helpers/api';
import { flushRateLimitKeys } from './helpers/redis';

const request = supertest(process.env.API_URL ?? 'http://app:9000');

describe('POST /users/logout', () => {
    it('should return 204 when authenticated', async () => {
        const user = await registerAndLogin();

        const res = await request
            .post(`${BASE}/users/logout`)
            .set('Authorization', `Bearer ${user.accessToken}`);

        expect(res.status).toBe(204);
    });

    it('should invalidate refresh tokens after logout', async () => {
        const user = await registerAndLogin();

        // Logout
        await request
            .post(`${BASE}/users/logout`)
            .set('Authorization', `Bearer ${user.accessToken}`);

        // Try to refresh with the old refresh token
        await flushRateLimitKeys();
        const res = await request.post(`${BASE}/users/refresh`).send({
            refreshToken: user.refreshToken,
        });

        expect(res.status).toBe(401);
    });

    it('should return 401 when no Authorization header is provided', async () => {
        const res = await request.post(`${BASE}/users/logout`);

        expect(res.status).toBe(401);
    });
});
