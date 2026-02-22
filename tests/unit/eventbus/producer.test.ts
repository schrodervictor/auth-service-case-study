import { Producer } from '../../../src/eventbus/producer';
import type { KafkaClient } from '../../../src/eventbus/types';

describe('Producer', () => {
    let producer: Producer;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        const client: KafkaClient = { mode: 'emulated' };
        producer = new Producer(client);
        logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('should log published message as JSON', async () => {
        const payload = {
            topic: 'test-topic',
            events: [{ type: 'TEST_EVENT', data: { key: 'value' } }],
        };

        await producer.publish(payload);

        expect(logSpy).toHaveBeenCalledTimes(1);
        const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
        expect(logged).toEqual({
            eventbus: 'emulated',
            action: 'publish',
            topic: 'test-topic',
            events: [{ type: 'TEST_EVENT', data: { key: 'value' } }],
        });
    });

    it('should include the client mode in the log', async () => {
        await producer.publish({ topic: 'any', events: [] });

        const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
        expect(logged.eventbus).toBe('emulated');
    });

    it('should handle multiple events in a single publish', async () => {
        const payload = {
            topic: 'multi-topic',
            events: [
                { type: 'EVENT_A', data: 'a' },
                { type: 'EVENT_B', data: 'b' },
            ],
        };

        await producer.publish(payload);

        const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
        expect(logged.events).toHaveLength(2);
    });
});
