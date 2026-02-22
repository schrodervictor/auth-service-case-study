import { silenceConsole, type CapturedConsole } from '../../helpers/test-console';
import { Consumer } from '../../../src/eventbus/consumer';
import type { KafkaClient } from '../../../src/eventbus/types';

describe('Consumer', () => {
    let consumer: Consumer;
    let captured: CapturedConsole;

    beforeEach(() => {
        const client: KafkaClient = { mode: 'emulated' };
        consumer = new Consumer(client, 'test-group');
        captured = silenceConsole('log');
    });

    afterEach(() => { captured.restore(); });

    it('should log subscribed topic names', async () => {
        const handler = jest.fn();
        await consumer.subscribe([
            { topic: 'topic-a', eventHandler: handler },
            { topic: 'topic-b', eventHandler: handler },
        ]);

        expect(captured.log).toContainEqual(
            '[EVENTBUS] Emulated consumer (test-group) subscribed to: topic-a, topic-b',
        );
    });

    it('should include group ID in the log message', async () => {
        const customConsumer = new Consumer({ mode: 'emulated' }, 'my-group');
        await customConsumer.subscribe([
            { topic: 'some-topic', eventHandler: jest.fn() },
        ]);

        expect(captured.log).toContainEqual(
            expect.stringContaining('my-group'),
        );
    });

    it('should handle empty topic list', async () => {
        await consumer.subscribe([]);

        expect(captured.log).toContainEqual(
            '[EVENTBUS] Emulated consumer (test-group) subscribed to: ',
        );
    });
});
