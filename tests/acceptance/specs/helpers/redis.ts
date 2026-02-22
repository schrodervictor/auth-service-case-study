import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://redis:6379';

/**
 * Flush all rate-limit keys from Redis.
 * Call this in `beforeAll` for test suites that hit rate-limited endpoints.
 */
export async function flushRateLimitKeys(): Promise<void> {
    const redis = new Redis(REDIS_URL, { lazyConnect: true });
    try {
        await redis.connect();
        const keys = await redis.keys('rateLimit:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    } finally {
        redis.disconnect();
    }
}
