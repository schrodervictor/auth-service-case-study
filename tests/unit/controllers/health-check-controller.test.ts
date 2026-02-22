import 'reflect-metadata';
import type { Request, Response } from 'express';

import { HealthCheckController } from '../../../src/controllers/health-check-controller';
import type { RedisClient } from '../../../src/redis/redis-client';
import type { DataSource } from 'typeorm';

const createMockDataSource = (): jest.Mocked<Pick<DataSource, 'query'>> => ({
    query: jest.fn(),
});

const createMockRedisClient = (): jest.Mocked<Pick<RedisClient, 'ping'>> => ({
    ping: jest.fn(),
});

const createMockResponse = (): Partial<Response> & {
    statusCode?: number;
    body?: unknown;
} => {
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
    res.status = jest.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn().mockImplementation((data: unknown) => {
        res.body = data;
        return res;
    });
    return res;
};

describe('HealthCheckController', () => {
    let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;
    let mockRedisClient: jest.Mocked<Pick<RedisClient, 'ping'>>;
    let controller: HealthCheckController;

    beforeEach(() => {
        mockDataSource = createMockDataSource();
        mockRedisClient = createMockRedisClient();
        controller = new HealthCheckController(
            mockDataSource as unknown as DataSource,
            mockRedisClient as unknown as RedisClient,
        );
    });

    describe('GET /health-check', () => {
        it('should return 200 with status "healthy" when all dependencies are up', async () => {
            mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
            mockRedisClient.ping.mockResolvedValue(true);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ status: 'healthy' });
        });

        it('should return 200 with status "degraded" when cache is down but DB is up', async () => {
            mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
            mockRedisClient.ping.mockResolvedValue(false);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ status: 'degraded' });
        });

        it('should return 503 with status "unhealthy" when DB is down but cache is up', async () => {
            mockDataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));
            mockRedisClient.ping.mockResolvedValue(true);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(res.statusCode).toBe(503);
            expect(res.body).toEqual({ status: 'unhealthy' });
        });

        it('should return 503 with status "unhealthy" when both dependencies are down', async () => {
            mockDataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));
            mockRedisClient.ping.mockResolvedValue(false);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(res.statusCode).toBe(503);
            expect(res.body).toEqual({ status: 'unhealthy' });
        });

        it('should treat DB query throwing as "down"', async () => {
            mockDataSource.query.mockRejectedValue(new Error('connection terminated'));
            mockRedisClient.ping.mockResolvedValue(true);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(res.statusCode).toBe(503);
            expect(res.body).toEqual({ status: 'unhealthy' });
        });

        it('should contain only the status field in the response body', async () => {
            mockDataSource.query.mockResolvedValue([{ '?column?': 1 }]);
            mockRedisClient.ping.mockResolvedValue(true);
            const res = createMockResponse();

            await controller.healthCheck({} as Request, res as Response);

            expect(Object.keys(res.body as object)).toEqual(['status']);
        });

        it('should run both dependency checks in parallel', async () => {
            const callOrder: string[] = [];

            mockDataSource.query.mockImplementation(async () => {
                callOrder.push('db-start');
                await new Promise((r) => setTimeout(r, 10));
                callOrder.push('db-end');
                return [{ '?column?': 1 }];
            });

            mockRedisClient.ping.mockImplementation(async () => {
                callOrder.push('redis-start');
                await new Promise((r) => setTimeout(r, 10));
                callOrder.push('redis-end');
                return true;
            });

            const res = createMockResponse();
            await controller.healthCheck({} as Request, res as Response);

            // Both should start before either ends (parallel execution)
            expect(callOrder.indexOf('db-start')).toBeLessThan(callOrder.indexOf('db-end'));
            expect(callOrder.indexOf('redis-start')).toBeLessThan(callOrder.indexOf('redis-end'));
            // Both starts should happen before any end
            const firstEnd = Math.min(callOrder.indexOf('db-end'), callOrder.indexOf('redis-end'));
            expect(callOrder.indexOf('db-start')).toBeLessThan(firstEnd);
            expect(callOrder.indexOf('redis-start')).toBeLessThan(firstEnd);
        });
    });
});
