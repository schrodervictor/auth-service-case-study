import type { Request, Response, NextFunction } from 'express';

import {
    createRateLimitMiddleware,
    type RateLimitMiddlewareFunction,
    type RateLimitConfig,
} from '../../../src/middleware/rate-limit-middleware';

const createMockRedisClient = () => ({
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
});

type MockRedisClient = ReturnType<typeof createMockRedisClient>;

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
    describe('null Redis client (no-op passthrough)', () => {
        it('should call next() immediately when redisClient is null', () => {
            const middleware = createRateLimitMiddleware(null, 'login', DEFAULT_CONFIG);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should not send any response when redisClient is null', () => {
            const middleware = createRateLimitMiddleware(null, 'login', DEFAULT_CONFIG);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(res.json).not.toHaveBeenCalled();
        });
    });

    describe('under rate limit', () => {
        let mockRedis: MockRedisClient;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);
            middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
        });

        it('should call next() when request count is under the limit', async () => {
            mockRedis.incr.mockResolvedValue(3);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should call next() when request count equals maxAttempts (still allowed)', async () => {
            mockRedis.incr.mockResolvedValue(5);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should not modify req or res on the happy path', async () => {
            mockRedis.incr.mockResolvedValue(2);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
            expect(res.set).not.toHaveBeenCalled();
        });
    });

    describe('over rate limit', () => {
        let mockRedis: MockRedisClient;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
        });

        it('should respond with 429 when count exceeds maxAttempts', async () => {
            mockRedis.incr.mockResolvedValue(6);
            mockRedis.ttl.mockResolvedValue(800);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(res.statusCode).toBe(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should respond with correct error message', async () => {
            mockRedis.incr.mockResolvedValue(6);
            mockRedis.ttl.mockResolvedValue(800);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

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

            await middleware(req as Request, res as Response, next);

            expect(res.set).toHaveBeenCalledWith('Retry-After', '450');
        });

        it('should fall back to windowSeconds for Retry-After when TTL is unavailable', async () => {
            mockRedis.incr.mockResolvedValue(10);
            mockRedis.ttl.mockResolvedValue(-1); // key exists but no TTL
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
        });

        it('should fall back to windowSeconds for Retry-After when TTL is -2 (key expired)', async () => {
            mockRedis.incr.mockResolvedValue(10);
            mockRedis.ttl.mockResolvedValue(-2);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(res.set).toHaveBeenCalledWith('Retry-After', '900');
        });
    });

    describe('EXPIRE on first request', () => {
        let mockRedis: MockRedisClient;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.expire.mockResolvedValue(1);
            middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
        });

        it('should call EXPIRE when count is 1 (first request in window)', async () => {
            mockRedis.incr.mockResolvedValue(1);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

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

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.expire).not.toHaveBeenCalled();
        });
    });

    describe('Redis key format', () => {
        let mockRedis: MockRedisClient;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockResolvedValue(1);
        });

        it('should use key format rateLimit:{endpointKey}:{ip}', async () => {
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
            const req = createMockRequest('10.0.0.1');
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:login:10.0.0.1');
        });

        it('should use the correct endpointKey for refresh', async () => {
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'refresh',
                DEFAULT_CONFIG,
            );
            const req = createMockRequest('10.0.0.2');
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:refresh:10.0.0.2');
        });

        it('should handle IPv6 addresses in the key', async () => {
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
            const req = createMockRequest('::1');
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.incr).toHaveBeenCalledWith('rateLimit:login:::1');
        });

        it('should use fallback key when req.ip is undefined', async () => {
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
            const req = createMockRequest(undefined as unknown as string);
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.incr).toHaveBeenCalledWith(
                expect.stringMatching(/^rateLimit:login:.+$/),
            );
            // Should not contain "undefined" literally
            const calledKey = mockRedis.incr.mock.calls[0][0] as string;
            expect(calledKey).not.toContain('undefined');
        });
    });

    describe('Redis error handling (fail-open)', () => {
        let mockRedis: MockRedisClient;
        let middleware: RateLimitMiddlewareFunction;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                DEFAULT_CONFIG,
            );
        });

        it('should call next() when Redis INCR fails (fail-open)', async () => {
            mockRedis.incr.mockRejectedValue(new Error('Redis connection lost'));
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should log a warning when Redis INCR fails', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockRedis.incr.mockRejectedValue(new Error('Redis connection lost'));
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(warnSpy).toHaveBeenCalled();

            warnSpy.mockRestore();
        });

        it('should include the error message in the warning log', async () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockRedis.incr.mockRejectedValue(new Error('ECONNREFUSED'));
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            const warnMessage = warnSpy.mock.calls.map(c => c.join(' ')).join(' ');
            expect(warnMessage).toContain('ECONNREFUSED');

            warnSpy.mockRestore();
        });

        it('should call next() when Redis EXPIRE fails (fail-open)', async () => {
            mockRedis.incr.mockResolvedValue(1);
            mockRedis.expire.mockRejectedValue(new Error('Redis error'));
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
        });
    });

    describe('different configs', () => {
        let mockRedis: MockRedisClient;

        beforeEach(() => {
            mockRedis = createMockRedisClient();
            mockRedis.expire.mockResolvedValue(1);
        });

        it('should respect custom maxAttempts', async () => {
            const config: RateLimitConfig = { maxAttempts: 3, windowSeconds: 600 };
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'login',
                config,
            );

            // Count 3 = at limit, should pass
            mockRedis.incr.mockResolvedValue(3);
            const req1 = createMockRequest();
            const res1 = createMockResponse();
            const next1 = createMockNext();
            await middleware(req1 as Request, res1 as Response, next1);
            expect(next1).toHaveBeenCalled();

            // Count 4 = over limit, should block
            mockRedis.incr.mockResolvedValue(4);
            mockRedis.ttl.mockResolvedValue(500);
            const req2 = createMockRequest();
            const res2 = createMockResponse();
            const next2 = createMockNext();
            await middleware(req2 as Request, res2 as Response, next2);
            expect(res2.statusCode).toBe(429);
            expect(next2).not.toHaveBeenCalled();
        });

        it('should use custom windowSeconds for EXPIRE', async () => {
            const config: RateLimitConfig = { maxAttempts: 10, windowSeconds: 60 };
            const middleware = createRateLimitMiddleware(
                mockRedis as never,
                'refresh',
                config,
            );
            mockRedis.incr.mockResolvedValue(1);
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            await middleware(req as Request, res as Response, next);

            expect(mockRedis.expire).toHaveBeenCalledWith(
                expect.any(String),
                60,
            );
        });
    });
});
