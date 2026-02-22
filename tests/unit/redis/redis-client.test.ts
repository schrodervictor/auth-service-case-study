import { silenceConsole, type CapturedConsole } from '../../helpers/test-console';
import { RedisClient } from '../../../src/redis/redis-client';

const createMockIoredis = () => ({
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    quit: jest.fn(),
    ping: jest.fn(),
});

describe('RedisClient', () => {
    describe('with null client (no Redis connection)', () => {
        const client = new RedisClient(null);

        it('incr should return 0', async () => {
            expect(await client.incr('key')).toBe(0);
        });

        it('expire should return 0', async () => {
            expect(await client.expire('key', 60)).toBe(0);
        });

        it('ttl should return -1', async () => {
            expect(await client.ttl('key')).toBe(-1);
        });

        it('ping should return false', async () => {
            expect(await client.ping()).toBe(false);
        });
    });

    describe('with working client', () => {
        it('incr should delegate to underlying client', async () => {
            const mock = createMockIoredis();
            mock.incr.mockResolvedValue(3);
            const client = new RedisClient(mock as never);

            expect(await client.incr('mykey')).toBe(3);
            expect(mock.incr).toHaveBeenCalledWith('mykey');
        });

        it('expire should delegate to underlying client', async () => {
            const mock = createMockIoredis();
            mock.expire.mockResolvedValue(1);
            const client = new RedisClient(mock as never);

            expect(await client.expire('mykey', 900)).toBe(1);
            expect(mock.expire).toHaveBeenCalledWith('mykey', 900);
        });

        it('ttl should delegate to underlying client', async () => {
            const mock = createMockIoredis();
            mock.ttl.mockResolvedValue(450);
            const client = new RedisClient(mock as never);

            expect(await client.ttl('mykey')).toBe(450);
            expect(mock.ttl).toHaveBeenCalledWith('mykey');
        });

        it('ping should return true when client responds with PONG', async () => {
            const mock = createMockIoredis();
            mock.ping.mockResolvedValue('PONG');
            const client = new RedisClient(mock as never);

            expect(await client.ping()).toBe(true);
            expect(mock.ping).toHaveBeenCalled();
        });
    });

    describe('error handling (fail-open)', () => {
        let captured: CapturedConsole;

        beforeEach(() => { captured = silenceConsole('error'); });
        afterEach(() => { captured.restore(); });

        it('incr should return 0 and log error on failure', async () => {
            const mock = createMockIoredis();
            mock.incr.mockRejectedValue(new Error('ECONNREFUSED'));
            const client = new RedisClient(mock as never);

            expect(await client.incr('key')).toBe(0);
            expect(captured.error).toContainEqual(expect.stringContaining('ECONNREFUSED'));
        });

        it('expire should return 0 and log error on failure', async () => {
            const mock = createMockIoredis();
            mock.expire.mockRejectedValue(new Error('timeout'));
            const client = new RedisClient(mock as never);

            expect(await client.expire('key', 60)).toBe(0);
            expect(captured.error).toContainEqual(expect.stringContaining('timeout'));
        });

        it('ttl should return -1 and log error on failure', async () => {
            const mock = createMockIoredis();
            mock.ttl.mockRejectedValue(new Error('connection lost'));
            const client = new RedisClient(mock as never);

            expect(await client.ttl('key')).toBe(-1);
            expect(captured.error).toContainEqual(expect.stringContaining('connection lost'));
        });

        it('ping should return false and log warning on failure', async () => {
            const mock = createMockIoredis();
            mock.ping.mockRejectedValue(new Error('ECONNREFUSED'));
            const client = new RedisClient(mock as never);

            expect(await client.ping()).toBe(false);
            expect(captured.error).toContainEqual(expect.stringContaining('ECONNREFUSED'));
        });
    });

    describe('quit()', () => {
        it('should resolve without error when client is null', async () => {
            const client = new RedisClient(null);

            await expect(client.quit()).resolves.toBeUndefined();
        });

        it('should delegate to underlying client quit()', async () => {
            const mock = createMockIoredis();
            mock.quit.mockResolvedValue('OK');
            const client = new RedisClient(mock as never);

            await client.quit();

            expect(mock.quit).toHaveBeenCalled();
        });

        it('should swallow errors and log warning on failure', async () => {
            const captured = silenceConsole('error');
            const mock = createMockIoredis();
            mock.quit.mockRejectedValue(new Error('ECONNRESET'));
            const client = new RedisClient(mock as never);

            await expect(client.quit()).resolves.toBeUndefined();
            expect(captured.error).toContainEqual(expect.stringContaining('ECONNRESET'));

            captured.restore();
        });
    });
});
