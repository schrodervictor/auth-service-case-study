import { Consumer } from '../../../src/eventbus/consumer';
import type { KafkaClient } from '../../../src/eventbus/types';

describe('Consumer', () => {
    let consumer: Consumer;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        const client: KafkaClient = { mode: 'emulated' };
        consumer = new Consumer(client, 'test-group');
        logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('should log subscribed topic names', async () => {
        const handler = jest.fn();
        await consumer.subscribe([
            { topic: 'topic-a', eventHandler: handler },
            { topic: 'topic-b', eventHandler: handler },
        ]);

        expect(logSpy).toHaveBeenCalledWith(
            '[EVENTBUS] Emulated consumer (test-group) subscribed to: topic-a, topic-b',
        );
    });

    it('should include group ID in the log message', async () => {
        const customConsumer = new Consumer({ mode: 'emulated' }, 'my-group');
        await customConsumer.subscribe([
            { topic: 'some-topic', eventHandler: jest.fn() },
        ]);

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('my-group'),
        );
    });

    it('should handle empty topic list', async () => {
        await consumer.subscribe([]);

        expect(logSpy).toHaveBeenCalledWith(
            '[EVENTBUS] Emulated consumer (test-group) subscribed to: ',
        );
    });
});
