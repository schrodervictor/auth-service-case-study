import type { Request, Response, NextFunction } from 'express';

import {
    createRateLimitMiddleware,
    type RateLimitMiddlewareFunction,
    type RateLimitConfig,
} from '../../../src/middleware/rate-limit-middleware';
import type { RedisClient } from '../../../src/redis/redis-client';

const flushPromises = () => new Promise(process.nextTick);

const createMockRedisClient = () => ({
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
}) as unknown as jest.Mocked<RedisClient>;

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

const DEFAULT_CONFIG: RateLimitConfig = {
    maxAttempts: 5,
    windowSeconds: 900,
};

describe('createRateLimitMiddleware', () => {
    describe('under rate limit', () => {
        let mockRedis: jest.Mocked<RedisClient>;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);
            middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
        });

        it('should call next() when request count is under the limit', async () => {
            mockRedis.incr.mockResolvedValue(3);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should call next() when request count equals maxAttempts (still allowed)', async () => {
            mockRedis.incr.mockResolvedValue(5);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should not modify req or res on the happy path', async () => {
            mockRedis.incr.mockResolvedValue(2);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
            expect(res.set).not.toHaveBeenCalled();
        });
    });

    describe('over rate limit', () => {
        let mockRedis: jest.Mocked<RedisClient>;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
        });

        it('should respond with 429 when count exceeds maxAttempts', async () => {
            mockRedis.incr.mockResolvedValue(6);
            mockRedis.ttl.mockResolvedValue(800);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.statusCode).toBe(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should respond with correct error message', async () => {
            mockRedis.incr.mockResolvedValue(6);
            mockRedis.ttl.mockResolvedValue(800);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.body).toEqual({
                message: 'Too many requests. Please try again later.',
            });
        });

        it('should set Retry-After header from Redis TTL', async () => {
            mockRedis.incr.mockResolvedValue(10);
            mockRedis.ttl.mockResolvedValue(450);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.set).toHaveBeenCalledWith('Retry-After', '450');
        });

        it('should fall back to windowSeconds for Retry-After when TTL is unavailable', async () => {
            mockRedis.incr.mockResolvedValue(10);
            mockRedis.ttl.mockResolvedValue(-1);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
        });

        it('should fall back to windowSeconds for Retry-After when TTL is -2 (key expired)', async () => {
            mockRedis.incr.mockResolvedValue(10);
            mockRedis.ttl.mockResolvedValue(-2);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
        });
    });

    describe('EXPIRE on first request', () => {
        let mockRedis: jest.Mocked<RedisClient>;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.expire.mockResolvedValue(1);
            middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
        });

        it('should call EXPIRE when count is 1 (first request in window)', async () => {
            mockRedis.incr.mockResolvedValue(1);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.any(String),
                DEFAULT_CONFIG.windowSeconds,
            );
        });

        it('should NOT call EXPIRE on subsequent requests (count > 1)', async () => {
            mockRedis.incr.mockResolvedValue(3);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.expire).not.toHaveBeenCalled();
        });
    });

    describe('Redis key format', () => {
        let mockRedis: jest.Mocked<RedisClient>;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);
        });

        it('should use key format rateLimit:{endpointKey}:{ip}', async () => {
            const middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
            const req = createMockRequest('10.0.0.1');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:login:10.0.0.1');
        });

        it('should use the correct endpointKey for refresh', async () => {
            const middleware = createRateLimitMiddleware(mockRedis, 'refresh', DEFAULT_CONFIG);
            const req = createMockRequest('10.0.0.2');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:refresh:10.0.0.2');
        });

        it('should handle IPv6 addresses in the key', async () => {
            const middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
            const req = createMockRequest('::1');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:login:::1');
        });

        it('should use fallback key when req.ip is undefined', async () => {
            const middleware = createRateLimitMiddleware(mockRedis, 'login', DEFAULT_CONFIG);
            const req = createMockRequest(undefined as unknown as string);
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.incr).toHaveBeenCalledWith(
                expect.stringMatching(/^rateLimit:login:.+$/),
            );
            const calledKey = mockRedis.incr.mock.calls[0][0] as string;
            expect(calledKey).not.toContain('undefined');
        });
    });

    describe('different configs', () => {
        let mockRedis: jest.Mocked<RedisClient>;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.expire.mockResolvedValue(1);
        });

        it('should respect custom maxAttempts', async () => {
            const config: RateLimitConfig = { maxAttempts: 3, windowSeconds: 600 };
            const middleware = createRateLimitMiddleware(mockRedis, 'login', config);

            // Count 3 = at limit, should pass
            mockRedis.incr.mockResolvedValue(3);
            const req1 = createMockRequest();
            const res1 = createMockResponse();
            const next1 = createMockNext();
            middleware(req1 as Request, res1 as Response, next1);
            await flushPromises();
            expect(next1).toHaveBeenCalled();

            // Count 4 = over limit, should block
            mockRedis.incr.mockResolvedValue(4);
            mockRedis.ttl.mockResolvedValue(500);
            const req2 = createMockRequest();
            const res2 = createMockResponse();
            const next2 = createMockNext();
            middleware(req2 as Request, res2 as Response, next2);
            await flushPromises();
            expect(res2.statusCode).toBe(429);
            expect(next2).not.toHaveBeenCalled();
        });

        it('should use custom windowSeconds for EXPIRE', async () => {
            const config: RateLimitConfig = { maxAttempts: 10, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(mockRedis, 'refresh', config);
            mockRedis.incr.mockResolvedValue(1);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);
            await flushPromises();

            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.any(String),
                60,
            );
        });
    });
});
