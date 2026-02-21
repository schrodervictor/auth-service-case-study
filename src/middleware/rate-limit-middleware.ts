import type { Request, Response, NextFunction } from 'express';
import type Redis from 'ioredis';

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
    redisClient: Redis | null,
    endpointKey: string,
    config: RateLimitConfig,
): RateLimitMiddlewareFunction {
    return ((req: Request, res: Response, next: NextFunction): void | Promise<void> => {
        if (redisClient == null) {
            next();
            return;
        }

        const ip = req.ip ?? 'unknown';
        const key = `rateLimit:${endpointKey}:${ip}`;

        return redisClient
            .incr(key)
            .then(async (count) => {
                if (count === 1) {
                    await redisClient.expire(key, config.windowSeconds);
                }

                if (count > config.maxAttempts) {
                    const ttl = await redisClient.ttl(key);
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
