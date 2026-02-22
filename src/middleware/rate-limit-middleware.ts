import type { Request, Response, NextFunction } from 'express';

import type { RedisClient } from '../redis/redis-client';

export type RateLimitMiddlewareFunction = (
    req: Request,
    res: Response,
    next: NextFunction,
) => void;

export interface RateLimitConfig {
    maxAttempts: number;
    windowSeconds: number;
}

export function createRateLimitMiddleware(
    redisClient: RedisClient,
    endpointKey: string,
    config: RateLimitConfig,
): RateLimitMiddlewareFunction {
    return (req: Request, res: Response, next: NextFunction): void => {
        const ip = req.ip ?? 'unknown';
        const key = `rateLimit:${endpointKey}:${ip}`;

        checkRateLimit(redisClient, key, config)
            .then(({ allowed, retryAfter }) => {
                if (!allowed) {
                    res.set('Retry-After', String(retryAfter));
                    res.status(429).json({
                        message: 'Too many requests. Please try again later.',
                    });
                    return;
                }

                next();
            });
    };
}

async function checkRateLimit(
    redis: RedisClient,
    key: string,
    config: RateLimitConfig,
): Promise<{ allowed: boolean; retryAfter: number }> {
    const count = await redis.incr(key);

    // INCR creates the key without expiration — set TTL on the first request
    // so the counter resets automatically after the window elapses.
    if (count === 1) {
        await redis.expire(key, config.windowSeconds);
    }

    if (count > config.maxAttempts) {
        const ttl = await redis.ttl(key);
        const retryAfter = ttl > 0 ? ttl : config.windowSeconds;
        return { allowed: false, retryAfter };
    }

    return { allowed: true, retryAfter: 0 };
}
