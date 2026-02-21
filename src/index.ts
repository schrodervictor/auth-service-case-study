import { json } from 'body-parser';

import 'reflect-metadata';
import { InversifyExpressServer } from 'inversify-express-utils';

// import { createKafkaClient, Producer, Consumer } from '@marta/eventbus/dist';

// import { getDataSource } from './typeormconfig';

import { loadConfig } from './config';
import { createContainer } from './inversify.config';
// import { TYPES } from './lib';
// import { exampleEventHandler } from './events/handlers';

(async () => {
    try {
        const config = loadConfig();
        const diContainer = createContainer(config);

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

        // DB setup
        // const dataSource = await getDataSource();
        // await dataSource.initialize();
        // diContainer.bind(TYPES.DB).toConstantValue(dataSource);

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
        console.error(err);
    }
})();
