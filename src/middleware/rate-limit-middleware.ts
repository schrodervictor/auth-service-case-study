import type { Request, Response, NextFunction } from 'express';

export type RateLimitMiddlewareFunction = (
    req: Request,
    res: Response,
    next: NextFunction,
) => void;

export interface RateLimitConfig {
    maxAttempts: number;
    windowSeconds: number;
}

export interface RedisLike {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
}

export function createRateLimitMiddleware(
    redisClient: RedisLike | null,
    endpointKey: string,
    config: RateLimitConfig,
): RateLimitMiddlewareFunction {
    return ((req: Request, res: Response, next: NextFunction) => {
        if (redisClient == null) {
            next();
            return;
        }

        const ip = req.ip ?? 'unknown';
        const key = `rateLimit:${endpointKey}:${ip}`;

        return checkRateLimit(redisClient, key, config)
            .then((result) => {
                if (result.allowed) {
                    next();
                } else {
                    res.set('Retry-After', String(result.retryAfter));
                    res.status(429).json({
                        message: 'Too many requests. Please try again later.',
                    });
                }
            })
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`Rate limit Redis error: ${message}`);
                next();
            });
    }) as RateLimitMiddlewareFunction;
}

async function checkRateLimit(
    redis: RedisLike,
    key: string,
    config: RateLimitConfig,
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
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

    return { allowed: true };
}
