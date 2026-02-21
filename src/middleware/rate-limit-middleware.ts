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

interface RedisLike {
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
    ttl(key: string): Promise<number>;
}

export function createRateLimitMiddleware(
    redisClient: RedisLike | null | unknown,
    endpointKey: string,
    config: RateLimitConfig,
): RateLimitMiddlewareFunction {
    const client = redisClient as RedisLike | null;

    return ((req: Request, res: Response, next: NextFunction): void | Promise<void> => {
        if (client == null) {
            next();
            return;
        }

        const ip = req.ip ?? 'unknown';
        const key = `rateLimit:${endpointKey}:${ip}`;

        return client
            .incr(key)
            .then(async (count) => {
                if (count === 1) {
                    await client.expire(key, config.windowSeconds);
                }

                if (count > config.maxAttempts) {
                    const ttl = await client.ttl(key);
                    const retryAfter = ttl > 0 ? ttl : config.windowSeconds;
                    res.set('Retry-After', String(retryAfter));
                    res.status(429).json({
                        message: 'Too many requests. Please try again later.',
                    });
                    return;
                }

                next();
            })
            .catch((error: unknown) => {
                const message = error instanceof Error ? error.message : String(error);
                console.warn(`Rate limit Redis error: ${message}`);
                next();
            });
    }) as RateLimitMiddlewareFunction;
}
