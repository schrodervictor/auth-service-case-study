import 'reflect-metadata';

import { json } from 'body-parser';
import { InversifyExpressServer } from 'inversify-express-utils';

import { createKafkaClient, Producer, Consumer } from './eventbus';

import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

import { loadConfig } from './config';
import { loadSecrets } from './config/secrets-loader';
import { createContainer } from './inversify.config';
import { createDataSource } from './database';
import { openApiSpec } from './openapi';
import { createRedisClient } from './redis/redis-client-factory';
import { createShutdownHandler } from './shutdown';
import { TYPES } from './lib/types';

(async () => {
    try {
        const config = loadConfig();
        const secrets = await loadSecrets(config);
        const credentials = {
            username: secrets.databaseUser,
            password: secrets.databasePassword,
        };
        const dataSource = createDataSource(config, credentials);

        await dataSource.initialize();
        console.log('Database connection established');

        await dataSource.runMigrations();
        console.log('Database migrations executed');

        const redisClient = await createRedisClient(config);

        const diContainer = createContainer(
            config,
            dataSource,
            secrets,
            redisClient,
        );

        // Create eventbus producer and consumer
        const kafkaClient = await createKafkaClient();
        const producer = new Producer(kafkaClient);
        const consumer = new Consumer(kafkaClient, 'test-service-group');

        // Subscribe to topics when handlers are available
        // await consumer.subscribe([
        //     { topic: 'test-topic', eventHandler: exampleEventHandler },
        // ]);

        diContainer.bind(TYPES.Producer).toConstantValue(producer);

        // Create app server
        const app = new InversifyExpressServer(diContainer, null, {
            rootPath: '/partner-app/api',
        });
        app.setConfig(app => {
            app.use(json());
            app.get('/partner-app/api/docs/spec.json', (_req, res) => {
                res.json(openApiSpec);
            });
            app.get('/partner-app/api/docs/spec.yaml', (_req, res) => {
                res.type('text/yaml').send(yaml.dump(openApiSpec));
            });
            app.use(
                '/partner-app/api/docs',
                swaggerUi.serve,
                swaggerUi.setup(openApiSpec),
            );
        });

        const server = app.build();

        const httpServer = server.listen(config.server.port, () => {
            console.log(`Server listening on port ${config.server.port}`);
        });

        const shutdown = createShutdownHandler({
            server: httpServer,
            dataSource,
            redisClient,
        });

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    } catch (err) {
        console.error('Failed to start application:', err);
        process.exit(1);
    }
})();
