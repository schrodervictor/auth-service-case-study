import { json } from 'body-parser';

import 'reflect-metadata';
import { InversifyExpressServer } from 'inversify-express-utils';

// import { createKafkaClient, Producer, Consumer } from '@marta/eventbus/dist';

import { loadConfig } from './config';
import { createContainer } from './inversify.config';
import { createDataSource } from './database';
// import { exampleEventHandler } from './events/handlers';

(async () => {
    try {
        const config = loadConfig();
        const dataSource = createDataSource(config, { username: '', password: '' });

        await dataSource.initialize();
        console.log('Database connection established');

        await dataSource.runMigrations();
        console.log('Database migrations executed');

        const diContainer = createContainer(config, dataSource);

        // Create Kafka producer and consumer instance
        // const kafkaClient = await createKafkaClient();
        // const producer = new Producer(kafkaClient);
        // const consumer = new Consumer(kafkaClient, 'test-service-group');

        // Subscribe to all the topics the service is interested in
        // await consumer.subscribe([
        //     { topic: 'test-topic', eventHandler: exampleEventHandler },
        // ]);

        // Bind producer instance to the DI container so it can be accessed from anywhere
        // diContainer.bind(TYPES.producer).toConstantValue(producer);

        // Create app server
        const app = new InversifyExpressServer(diContainer, null, {
            rootPath: '/partner-app/api',
        });
        app.setConfig(app => {
            app.use(json());
        });

        const server = app.build();

        server.listen(config.server.port, () => {
            console.log(`Server listening on port ${config.server.port}`);
        });
    } catch (err) {
        console.error('Failed to start application:', err);
        process.exit(1);
    }
})();
