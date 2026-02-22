import Redis from 'ioredis';

import type { AppConfig } from '../config/schema';

export async function createRedisClient(config: AppConfig): Promise<Redis | null> {
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

        return client;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Redis connection failed: ${message}`);
        if (client) {
            client.quit().catch(() => {});
        }
        return null;
    }
}
