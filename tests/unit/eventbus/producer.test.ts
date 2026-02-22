import fs from 'node:fs';

import {
    silenceConsole,
    type CapturedConsole,
} from '../../helpers/test-console';
import { Producer } from '../../../src/eventbus/producer';
import type { KafkaClient } from '../../../src/eventbus/types';

jest.mock('node:fs');

const mockedFs = jest.mocked(fs);

describe('Producer', () => {
    let captured: CapturedConsole;

    beforeEach(() => {
        captured = silenceConsole('log');
        mockedFs.appendFileSync.mockClear();
    });

    afterEach(() => {
        captured.restore();
    });

    describe('without outputPath', () => {
        let producer: Producer;

        beforeEach(() => {
            const client: KafkaClient = { mode: 'emulated' };
            producer = new Producer(client);
        });

        it('should log each event as a single-line JSON', async () => {
            const payload = {
                topic: 'test-topic',
                events: [{ type: 'TEST_EVENT', data: { key: 'value' } }],
            };

            await producer.publish(payload);

            expect(captured.log).toHaveLength(1);
            const logged = JSON.parse(captured.log[0]);
            expect(logged).toEqual({
                topic: 'test-topic',
                type: 'TEST_EVENT',
                data: { key: 'value' },
            });
        });

        it('should log each event separately for multiple events', async () => {
            const payload = {
                topic: 'multi-topic',
                events: [
                    { type: 'EVENT_A', data: 'a' },
                    { type: 'EVENT_B', data: 'b' },
                ],
            };

            await producer.publish(payload);

            expect(captured.log).toHaveLength(2);
            expect(JSON.parse(captured.log[0]).type).toBe('EVENT_A');
            expect(JSON.parse(captured.log[1]).type).toBe('EVENT_B');
        });

        it('should not write to file when outputPath is not set', async () => {
            await producer.publish({
                topic: 'any',
                events: [{ type: 'E', data: null }],
            });

            expect(mockedFs.appendFileSync).not.toHaveBeenCalled();
        });
    });

    describe('with outputPath', () => {
        let producer: Producer;

        beforeEach(() => {
            const client: KafkaClient = {
                mode: 'emulated',
                outputPath: '/tmp/eventbus.jsonl',
            };
            producer = new Producer(client);
        });

        it('should append each event as a line to the output file', async () => {
            const payload = {
                topic: 'test-topic',
                events: [{ type: 'TEST_EVENT', data: { key: 'value' } }],
            };

            await producer.publish(payload);

            expect(mockedFs.appendFileSync).toHaveBeenCalledTimes(1);
            const written = mockedFs.appendFileSync.mock.calls[0][1] as string;
            expect(written).toMatch(/\n$/);
            const parsed = JSON.parse(written.trim());
            expect(parsed).toEqual({
                topic: 'test-topic',
                type: 'TEST_EVENT',
                data: { key: 'value' },
            });
        });

        it('should write to the configured path', async () => {
            await producer.publish({
                topic: 'any',
                events: [{ type: 'E', data: null }],
            });

            expect(mockedFs.appendFileSync).toHaveBeenCalledWith(
                '/tmp/eventbus.jsonl',
                expect.any(String),
            );
        });

        it('should append one line per event for multiple events', async () => {
            const payload = {
                topic: 'multi',
                events: [
                    { type: 'A', data: 1 },
                    { type: 'B', data: 2 },
                ],
            };

            await producer.publish(payload);

            expect(mockedFs.appendFileSync).toHaveBeenCalledTimes(2);
        });

        it('should also log to console when writing to file', async () => {
            await producer.publish({
                topic: 'any',
                events: [{ type: 'E', data: null }],
            });

            expect(captured.log).toHaveLength(1);
            expect(mockedFs.appendFileSync).toHaveBeenCalledTimes(1);
        });
    });
});
