import { createShutdownHandler, type ShutdownDeps } from '../../src/shutdown';

interface MockDeps {
    server: { close: jest.Mock };
    dataSource: { isInitialized: boolean; destroy: jest.Mock };
    redisClient: { quit: jest.Mock };
    exit: jest.Mock;
    logger: { log: jest.Mock; error: jest.Mock };
}

const createMockDeps = (): MockDeps => ({
    server: { close: jest.fn((cb?: () => void) => cb?.()) },
    dataSource: {
        isInitialized: true,
        destroy: jest.fn().mockResolvedValue(undefined),
    },
    redisClient: { quit: jest.fn().mockResolvedValue(undefined) },
    exit: jest.fn(),
    logger: { log: jest.fn(), error: jest.fn() },
});

const toShutdownDeps = (deps: MockDeps): ShutdownDeps =>
    deps as unknown as ShutdownDeps;

describe('createShutdownHandler', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should call server.close(), dataSource.destroy(), redisClient.quit(), then exit(0)', async () => {
        const deps = createMockDeps();
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.server.close).toHaveBeenCalled();
        expect(deps.dataSource.destroy).toHaveBeenCalled();
        expect(deps.redisClient.quit).toHaveBeenCalled();
        expect(deps.exit).toHaveBeenCalledWith(0);
    });

    it('should call server.close() before dataSource.destroy() and redisClient.quit()', async () => {
        const deps = createMockDeps();
        const callOrder: string[] = [];

        deps.server.close.mockImplementation((cb?: () => void) => {
            callOrder.push('server.close');
            cb?.();
        });
        deps.dataSource.destroy.mockImplementation(() => {
            callOrder.push('dataSource.destroy');
            return Promise.resolve();
        });
        deps.redisClient.quit.mockImplementation(() => {
            callOrder.push('redisClient.quit');
            return Promise.resolve();
        });

        const handler = createShutdownHandler(toShutdownDeps(deps));
        await handler();

        expect(callOrder.indexOf('server.close')).toBeLessThan(
            callOrder.indexOf('dataSource.destroy'),
        );
        expect(callOrder.indexOf('server.close')).toBeLessThan(
            callOrder.indexOf('redisClient.quit'),
        );
    });

    it('should be idempotent — second invocation is a no-op', async () => {
        const deps = createMockDeps();
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();
        await handler();

        expect(deps.server.close).toHaveBeenCalledTimes(1);
        expect(deps.dataSource.destroy).toHaveBeenCalledTimes(1);
        expect(deps.redisClient.quit).toHaveBeenCalledTimes(1);
        expect(deps.exit).toHaveBeenCalledTimes(1);
    });

    it('should skip dataSource.destroy() when dataSource.isInitialized is false', async () => {
        const deps = createMockDeps();
        deps.dataSource.isInitialized = false;
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.dataSource.destroy).not.toHaveBeenCalled();
        expect(deps.exit).toHaveBeenCalledWith(0);
    });

    it('should log error and still exit(0) when dataSource.destroy() rejects', async () => {
        const deps = createMockDeps();
        deps.dataSource.destroy.mockRejectedValue(new Error('destroy failed'));
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('destroy failed'),
        );
        expect(deps.exit).toHaveBeenCalledWith(0);
    });

    it('should log error and still exit(0) when redisClient.quit() rejects', async () => {
        const deps = createMockDeps();
        deps.redisClient.quit.mockRejectedValue(new Error('quit failed'));
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('quit failed'),
        );
        expect(deps.exit).toHaveBeenCalledWith(0);
    });

    it('should log errors and still exit(0) when both destroy and quit reject', async () => {
        const deps = createMockDeps();
        deps.dataSource.destroy.mockRejectedValue(new Error('db error'));
        deps.redisClient.quit.mockRejectedValue(new Error('redis error'));
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.logger.error).toHaveBeenCalled();
        expect(deps.exit).toHaveBeenCalledWith(0);
    });

    it('should log shutdown lifecycle messages via the injected logger', async () => {
        const deps = createMockDeps();
        const handler = createShutdownHandler(toShutdownDeps(deps));

        await handler();

        expect(deps.logger.log).toHaveBeenCalledWith(
            expect.stringContaining('Shutdown signal received'),
        );
        expect(deps.logger.log).toHaveBeenCalledWith(
            expect.stringContaining('Database connection closed'),
        );
        expect(deps.logger.log).toHaveBeenCalledWith(
            expect.stringContaining('Redis connection closed'),
        );
        expect(deps.logger.log).toHaveBeenCalledWith(
            expect.stringContaining('Shutdown complete'),
        );
    });

    it('should set a force timer that calls exit(1) when drain timeout is exceeded', async () => {
        const deps = createMockDeps();
        deps.dataSource.destroy.mockReturnValue(new Promise(() => {}));
        const handler = createShutdownHandler({
            ...toShutdownDeps(deps),
            drainTimeoutMs: 5000,
        });

        // Start the handler but don't await (it will hang on destroy)
        const _handlerPromise = handler();

        // Advance timers past the drain timeout
        jest.advanceTimersByTime(5000);

        expect(deps.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('timeout'),
        );
        expect(deps.exit).toHaveBeenCalledWith(1);

        // Clean up — avoid unhandled promise warning
        await Promise.resolve();
    });
});
