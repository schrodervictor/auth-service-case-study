import {
    silenceConsole,
    type CapturedConsole,
} from '../../helpers/test-console';
import { createKafkaClient } from '../../../src/eventbus/client';

jest.mock('../../../src/config', () => ({
    loadConfig: jest.fn().mockReturnValue({
        eventbus: { mode: 'emulated', outputPath: '/tmp/test-eventbus.jsonl' },
    }),
}));

describe('createKafkaClient', () => {
    let captured: CapturedConsole;

    beforeEach(() => {
        captured = silenceConsole('log');
    });
    afterEach(() => {
        captured.restore();
    });

    it('should return a KafkaClient with mode "emulated"', async () => {
        const client = await createKafkaClient();

        expect(client.mode).toBe('emulated');
    });

    it('should include outputPath from config', async () => {
        const client = await createKafkaClient();

        expect(client.outputPath).toBe('/tmp/test-eventbus.jsonl');
    });

    it('should log creation message', async () => {
        await createKafkaClient();

        expect(captured.log).toContainEqual(
            expect.stringContaining('[EVENTBUS] Emulated Kafka client created'),
        );
    });
});
