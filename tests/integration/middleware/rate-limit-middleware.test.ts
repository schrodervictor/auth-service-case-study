import Redis from 'ioredis';
import type { Request, Response, NextFunction } from 'express';

import {
    createRateLimitMiddleware,
    type RateLimitMiddlewareFunction,
    type RateLimitConfig,
} from '../../../src/middleware/rate-limit-middleware';

/**
 * Integration tests for rate limit middleware against real Redis.
 *
 * These tests require a running Redis instance (via docker-compose).
 * Run with: make test-integration
 */

const REDIS_OPTIONS = {
    host: 'redis',
    port: 6379,
};

const createMockRequest = (ip = '192.168.1.1'): Partial<Request> => ({
    ip,
});

const createMockResponse = (): Partial<Response> & {
    statusCode?: number;
    body?: unknown;
    headers: Record<string, string>;
} => {
    const res: Partial<Response> & {
        statusCode?: number;
        body?: unknown;
        headers: Record<string, string>;
    } = { headers: {} };
    res.status = jest.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn().mockImplementation((data: unknown) => {
        res.body = data;
        return res;
    });
    res.set = jest.fn().mockImplementation((key: string, value: string) => {
        res.headers[key] = value;
        return res;
    });
    return res;
};

const createMockNext = (): jest.Mock<NextFunction> => jest.fn();

/** Invoke middleware and wait for completion (it's async internally). */
async function invokeMiddleware(
    middleware: RateLimitMiddlewareFunction,
    req: Partial<Request>,
    res: Partial<Response>,
    next: jest.Mock,
): Promise<void> {
    // The middleware returns void in its type but is actually a promise internally.
    // Use Promise.resolve to handle both sync and async returns.
    await Promise.resolve(middleware(req as Request, res as Response, next));
    // Small delay to ensure async chains resolve
    await new Promise((resolve) => setTimeout(resolve, 10));
}

describe('Rate limit middleware integration (real Redis)', () => {
    let redisClient: Redis;

    beforeAll(async () => {
        redisClient = new Redis(REDIS_OPTIONS);
        // Verify connection
        const pong = await redisClient.ping();
        if (pong !== 'PONG') {
            throw new Error(`Redis connection failed: expected PONG, got ${pong}`);
        }
    });

    afterAll(async () => {
        await redisClient.quit();
    });

    beforeEach(async () => {
        // Clean up all rate limit keys before each test
        const keys = await redisClient.keys('rateLimit:*');
        if (keys.length > 0) {
            await redisClient.del(...keys);
        }
    });

    describe('requests under the limit', () => {
        it('should allow requests under the limit through', async () => {
            const config: RateLimitConfig = { maxAttempts: 5, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);

            for (let i = 0; i < 5; i++) {
                const req = createMockRequest('10.0.0.100');
                const res = createMockResponse();
                const next = createMockNext();

                await invokeMiddleware(middleware, req, res, next);

                expect(next).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
            }
        });
    });

    describe('requests over the limit', () => {
        it('should return 429 when exceeding maxAttempts', async () => {
            const config: RateLimitConfig = { maxAttempts: 3, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);
            const ip = '10.0.0.101';

            // Make 3 allowed requests
            for (let i = 0; i < 3; i++) {
                const req = createMockRequest(ip);
                const res = createMockResponse();
                const next = createMockNext();
                await invokeMiddleware(middleware, req, res, next);
                expect(next).toHaveBeenCalled();
            }

            // 4th request should be blocked
            const req = createMockRequest(ip);
            const res = createMockResponse();
            const next = createMockNext();
            await invokeMiddleware(middleware, req, res, next);

            expect(res.statusCode).toBe(429);
            expect(res.body).toEqual({
                message: 'Too many requests. Please try again later.',
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should include Retry-After header with a positive numeric value', async () => {
            const config: RateLimitConfig = { maxAttempts: 1, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);
            const ip = '10.0.0.102';

            // First request allowed
            const req1 = createMockRequest(ip);
            const res1 = createMockResponse();
            const next1 = createMockNext();
            await invokeMiddleware(middleware, req1, res1, next1);

            // Second request blocked
            const req2 = createMockRequest(ip);
            const res2 = createMockResponse();
            const next2 = createMockNext();
            await invokeMiddleware(middleware, req2, res2, next2);

            expect(res2.statusCode).toBe(429);
            expect(res2.headers['Retry-After']).toBeDefined();
            const retryAfter = Number(res2.headers['Retry-After']);
            expect(retryAfter).toBeGreaterThan(0);
            expect(retryAfter).toBeLessThanOrEqual(60);
        });
    });

    describe('counter reset after window expires', () => {
        it('should allow requests again after the window expires', async () => {
            const config: RateLimitConfig = { maxAttempts: 2, windowSeconds: 2 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);
            const ip = '10.0.0.103';

            // Use up all attempts
            for (let i = 0; i < 2; i++) {
                const req = createMockRequest(ip);
                const res = createMockResponse();
                const next = createMockNext();
                await invokeMiddleware(middleware, req, res, next);
                expect(next).toHaveBeenCalled();
            }

            // Verify 3rd is blocked
            const reqBlocked = createMockRequest(ip);
            const resBlocked = createMockResponse();
            const nextBlocked = createMockNext();
            await invokeMiddleware(middleware, reqBlocked, resBlocked, nextBlocked);
            expect(resBlocked.statusCode).toBe(429);

            // Wait for window to expire
            await new Promise((resolve) => setTimeout(resolve, 2500));

            // Should be allowed again
            const reqAfter = createMockRequest(ip);
            const resAfter = createMockResponse();
            const nextAfter = createMockNext();
            await invokeMiddleware(middleware, reqAfter, resAfter, nextAfter);

            expect(nextAfter).toHaveBeenCalled();
            expect(resAfter.status).not.toHaveBeenCalled();
        }, 10000); // Extended timeout for window expiry wait
    });

    describe('independent counters', () => {
        it('should track different IPs independently', async () => {
            const config: RateLimitConfig = { maxAttempts: 2, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);

            // IP A uses up all attempts
            for (let i = 0; i < 2; i++) {
                const req = createMockRequest('10.0.0.200');
                const res = createMockResponse();
                const next = createMockNext();
                await invokeMiddleware(middleware, req, res, next);
            }

            // IP A is blocked
            const reqA = createMockRequest('10.0.0.200');
            const resA = createMockResponse();
            const nextA = createMockNext();
            await invokeMiddleware(middleware, reqA, resA, nextA);
            expect(resA.statusCode).toBe(429);

            // IP B should still be allowed
            const reqB = createMockRequest('10.0.0.201');
            const resB = createMockResponse();
            const nextB = createMockNext();
            await invokeMiddleware(middleware, reqB, resB, nextB);
            expect(nextB).toHaveBeenCalled();
            expect(resB.status).not.toHaveBeenCalled();
        });

        it('should track different endpoint keys independently', async () => {
            const config: RateLimitConfig = { maxAttempts: 2, windowSeconds: 60 };
            const loginMiddleware = createRateLimitMiddleware(redisClient, 'login', config);
            const refreshMiddleware = createRateLimitMiddleware(redisClient, 'refresh', config);
            const ip = '10.0.0.202';

            // Use up login attempts
            for (let i = 0; i < 2; i++) {
                const req = createMockRequest(ip);
                const res = createMockResponse();
                const next = createMockNext();
                await invokeMiddleware(loginMiddleware, req, res, next);
            }

            // Login is blocked
            const reqLogin = createMockRequest(ip);
            const resLogin = createMockResponse();
            const nextLogin = createMockNext();
            await invokeMiddleware(loginMiddleware, reqLogin, resLogin, nextLogin);
            expect(resLogin.statusCode).toBe(429);

            // Refresh for same IP should still be allowed
            const reqRefresh = createMockRequest(ip);
            const resRefresh = createMockResponse();
            const nextRefresh = createMockNext();
            await invokeMiddleware(refreshMiddleware, reqRefresh, resRefresh, nextRefresh);
            expect(nextRefresh).toHaveBeenCalled();
            expect(resRefresh.status).not.toHaveBeenCalled();
        });
    });

    describe('TTL verification', () => {
        it('should set correct TTL on first request in window', async () => {
            const config: RateLimitConfig = { maxAttempts: 10, windowSeconds: 30 };
            const middleware = createRateLimitMiddleware(redisClient, 'login', config);
            const ip = '10.0.0.250';

            const req = createMockRequest(ip);
            const res = createMockResponse();
            const next = createMockNext();
            await invokeMiddleware(middleware, req, res, next);

            const ttl = await redisClient.ttl(`rateLimit:login:${ip}`);
            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(30);
        });
    });
});
