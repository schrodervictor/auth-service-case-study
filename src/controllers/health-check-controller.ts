import type { Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import type { DataSource } from 'typeorm';

import { BaseController } from '../lib/base-controller';
import { TYPES } from '../lib/types';
import type { RedisClient } from '../redis/redis-client';

@controller('/health-check')
export class HealthCheckController extends BaseController {
    constructor(
        @inject(TYPES.DataSource) private readonly dataSource: DataSource,
        @inject(TYPES.RedisClient) private readonly redisClient: RedisClient,
    ) {
        super();
    }

    @httpGet('/')
    async healthCheck(res: Response): Promise<void> {
        const [dbUp, cacheUp] = await Promise.all([
            this.checkDatabase(),
            this.redisClient.ping(),
        ]);

        if (dbUp && cacheUp) {
            res.status(200).json({ status: 'healthy' });
        } else if (dbUp) {
            res.status(200).json({ status: 'degraded' });
        } else {
            res.status(503).json({ status: 'unhealthy' });
        }
    }

    private async checkDatabase(): Promise<boolean> {
        try {
            await this.dataSource.query('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }
}
