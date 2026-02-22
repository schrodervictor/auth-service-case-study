import { appendFileSync } from 'node:fs';

import type { KafkaClient, PublishPayload } from './types';

export class Producer {
    constructor(private readonly client: KafkaClient) {}

    async publish(payload: PublishPayload): Promise<void> {
        for (const event of payload.events) {
            const line = JSON.stringify({
                topic: payload.topic,
                type: event.type,
                data: event.data,
            });

            if (this.client.outputPath) {
                appendFileSync(this.client.outputPath, line + '\n');
            }

            console.log(line);
        }
    }
}
