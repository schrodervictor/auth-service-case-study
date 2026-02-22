import type { KafkaClient, PublishPayload } from './types';

export class Producer {
    constructor(private readonly client: KafkaClient) {}

    async publish(payload: PublishPayload): Promise<void> {
        console.log(JSON.stringify({
            eventbus: this.client.mode,
            action: 'publish',
            topic: payload.topic,
            events: payload.events,
        }));
    }
}
