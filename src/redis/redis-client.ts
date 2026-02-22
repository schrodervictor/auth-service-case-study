import type Redis from 'ioredis';

export class RedisClient {
    constructor(private readonly client: Redis | null) {}

    async incr(key: string): Promise<number> {
        if (!this.client) return 0;

        try {
            return await this.client.incr(key);
        } catch (error: unknown) {
            this.logWarning('incr', error);
            return 0;
        }
    }

    async expire(key: string, seconds: number): Promise<number> {
        if (!this.client) return 0;

        try {
            return await this.client.expire(key, seconds);
        } catch (error: unknown) {
            this.logWarning('expire', error);
            return 0;
        }
    }

    async ttl(key: string): Promise<number> {
        if (!this.client) return -1;

        try {
            return await this.client.ttl(key);
        } catch (error: unknown) {
            this.logWarning('ttl', error);
            return -1;
        }
    }

    private logWarning(operation: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Redis ${operation} failed: ${message}`);
    }
}
