import type { AppConfig } from '../../../src/config/schema';
import { TYPES } from '../../../src/lib/types';
import { createRedisClient } from '../../../src/redis/redis-client-factory';
import { RedisClient } from '../../../src/redis/redis-client';

jest.mock('ioredis');

const MOCK_CONFIG: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'testdb' },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    },
    redis: { host: 'redis', port: 6379 },
    rateLimit: {
        login: { maxAttempts: 5, windowSeconds: 900 },
        refresh: { maxAttempts: 10, windowSeconds: 900 },
    },
};

describe('TYPES.RedisClient', () => {
    it('should have a RedisClient symbol defined in TYPES', () => {
        expect(TYPES.RedisClient).toBeDefined();
        expect(typeof TYPES.RedisClient).toBe('symbol');
    });
});

describe('createRedisClient', () => {
    let Redis: jest.Mock;
    let mockRedisInstance: {
        ping: jest.Mock;
        on: jest.Mock;
        quit: jest.Mock;
        status: string;
    };

    beforeEach(async () => {
        jest.clearAllMocks();

        mockRedisInstance = {
            ping: jest.fn().mockResolvedValue('PONG'),
            on: jest.fn().mockReturnThis(),
            quit: jest.fn().mockResolvedValue('OK'),
            status: 'ready',
        };

        const ioredis = await import('ioredis');
        Redis = ioredis.default as unknown as jest.Mock;
        Redis.mockImplementation(() => mockRedisInstance);
    });

    it('should return a RedisClient instance on successful connection', async () => {
        const client = await createRedisClient(MOCK_CONFIG);

        expect(client).toBeInstanceOf(RedisClient);
    });

    it('should pass host and port from config to Redis constructor', async () => {
        await createRedisClient(MOCK_CONFIG);

        expect(Redis).toHaveBeenCalledWith(
            expect.objectContaining({
                host: 'redis',
                port: 6379,
            }),
        );
    });

    it('should pass custom host and port from config', async () => {
        const customConfig: AppConfig = {
            ...MOCK_CONFIG,
            redis: { host: 'custom-redis', port: 6380 },
        };

        await createRedisClient(customConfig);

        expect(Redis).toHaveBeenCalledWith(
            expect.objectContaining({
                host: 'custom-redis',
                port: 6380,
            }),
        );
    });

    it('should pass password to Redis constructor when provided', async () => {
        const configWithPassword: AppConfig = {
            ...MOCK_CONFIG,
            redis: { host: 'redis', port: 6379, password: 's3cret' },
        };

        await createRedisClient(configWithPassword);

        expect(Redis).toHaveBeenCalledWith(
            expect.objectContaining({
                password: 's3cret',
            }),
        );
    });

    it('should not pass password when not provided in config', async () => {
        await createRedisClient(MOCK_CONFIG);

        const constructorArgs = Redis.mock.calls[0][0];
        expect(constructorArgs.password).toBeUndefined();
    });

    it('should return a RedisClient when Redis connection fails (fail-open)', async () => {
        mockRedisInstance.ping.mockRejectedValue(new Error('Connection refused'));

        const client = await createRedisClient(MOCK_CONFIG);

        expect(client).toBeInstanceOf(RedisClient);
    });

    it('should log a warning when Redis connection fails', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        mockRedisInstance.ping.mockRejectedValue(new Error('Connection refused'));

        await createRedisClient(MOCK_CONFIG);

        expect(warnSpy).toHaveBeenCalled();
        expect(warnSpy.mock.calls[0][0]).toMatch(/redis/i);

        warnSpy.mockRestore();
    });

    it('should include the error message in the warning log', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        mockRedisInstance.ping.mockRejectedValue(new Error('ECONNREFUSED'));

        await createRedisClient(MOCK_CONFIG);

        const warnMessage = warnSpy.mock.calls.map(c => c.join(' ')).join(' ');
        expect(warnMessage).toContain('ECONNREFUSED');

        warnSpy.mockRestore();
    });

    it('should return a RedisClient when Redis constructor throws (fail-open)', async () => {
        Redis.mockImplementation(() => {
            throw new Error('Invalid host');
        });

        const client = await createRedisClient(MOCK_CONFIG);

        expect(client).toBeInstanceOf(RedisClient);
    });

    it('should log a warning when Redis constructor throws', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        Redis.mockImplementation(() => {
            throw new Error('Invalid host');
        });

        await createRedisClient(MOCK_CONFIG);

        expect(warnSpy).toHaveBeenCalled();

        warnSpy.mockRestore();
    });
});
