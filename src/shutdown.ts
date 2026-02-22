export interface ShutdownDeps {
    server: { close(cb?: (err?: Error) => void): void };
    dataSource: { isInitialized: boolean; destroy(): Promise<void> };
    redisClient: { quit(): Promise<void> };
    drainTimeoutMs?: number;
    logger?: Pick<Console, 'log' | 'error'>;
    exit?: (code: number) => void;
}

export function createShutdownHandler(deps: ShutdownDeps): () => Promise<void> {
    const {
        server,
        dataSource,
        redisClient,
        drainTimeoutMs = 10_000,
        logger = console,
        exit = process.exit,
    } = deps;

    let shuttingDown = false;

    return async () => {
        if (shuttingDown) return;
        shuttingDown = true;

        logger.log('Shutdown signal received — closing server...');

        server.close();

        const forceTimer = setTimeout(() => {
            logger.error('Drain timeout exceeded — forcing exit');
            exit(1);
        }, drainTimeoutMs);
        if (typeof forceTimer.unref === 'function') forceTimer.unref();

        try {
            if (dataSource.isInitialized) {
                await dataSource.destroy();
                logger.log('Database connection closed');
            }

            await redisClient.quit();
            logger.log('Redis connection closed');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`Error during shutdown: ${msg}`);
        }

        clearTimeout(forceTimer);
        logger.log('Shutdown complete');
        exit(0);
    };
}
