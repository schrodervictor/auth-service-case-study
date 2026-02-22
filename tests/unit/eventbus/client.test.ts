import { createKafkaClient } from '../../../src/eventbus/client';

describe('createKafkaClient', () => {
    it('should return a KafkaClient with mode "emulated"', async () => {
        const client = await createKafkaClient();

        expect(client).toEqual({ mode: 'emulated' });
    });

    it('should log creation message', async () => {
        const spy = jest.spyOn(console, 'log').mockImplementation();

        await createKafkaClient();

        expect(spy).toHaveBeenCalledWith('[EVENTBUS] Emulated Kafka client created');
        spy.mockRestore();
    });
});
