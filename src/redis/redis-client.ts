import type Redis from 'ioredis';

/**
 * Facade over ioredis that implements a fail-open strategy.
 *
 * Redis is used exclusively for rate limiting — a security enhancement, but
 * not mission-critical. When Redis is unreachable or unavailable, this facade
 * returns safe defaults (incr→0, expire→0, ttl→-1) so the application
 * gracefully degrades to "no rate limiting" rather than rejecting legitimate
 * users. Every failure is logged as a warning so DevOps can detect and
 * intervene promptly.
 */
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

    async quit(): Promise<void> {
        if (!this.client) return;

        try {
            await this.client.quit();
        } catch (error: unknown) {
            this.logWarning('quit', error);
        }
    }

    private logWarning(operation: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
            `[RATE-LIMIT DEGRADED] Redis ${operation} failed — ` +
            `rate limiting skipped for this request. Cause: ${message}`,
        );
    }
}
