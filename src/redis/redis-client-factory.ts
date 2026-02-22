import Redis from 'ioredis';

import type { AppConfig } from '../config/schema';
import { RedisClient } from './redis-client';

/**
 * Attempts to connect to Redis and returns a {@link RedisClient} facade.
 *
 * If the connection fails, a RedisClient backed by `null` is returned so
 * the service starts without rate limiting (fail-open). The failure is
 * logged as a warning for DevOps visibility.
 */
export async function createRedisClient(
    config: AppConfig,
): Promise<RedisClient> {
    let client: Redis | undefined;
    try {
        const options: { host: string; port: number; password?: string } = {
            host: config.redis.host,
            port: config.redis.port,
        };

        if (config.redis.password) {
            options.password = config.redis.password;
        }

        client = new Redis(options);

        await client.ping();

        return new RedisClient(client);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
            `[RATE-LIMIT DEGRADED] Redis connection failed at startup — ` +
                `rate limiting is DISABLED. Cause: ${message}`,
        );
        if (client) {
            client.quit().catch(() => {});
        }
        return new RedisClient(null);
    }
}
