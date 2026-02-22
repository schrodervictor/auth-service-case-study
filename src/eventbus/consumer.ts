import type { KafkaClient, TopicSubscription } from './types';

export class Consumer {
    constructor(
        private readonly client: KafkaClient,
        private readonly groupId: string,
    ) {}

    async subscribe(topics: TopicSubscription[]): Promise<void> {
        const names = topics.map(t => t.topic);
        console.log(
            `[EVENTBUS] Emulated consumer (${this.groupId}) subscribed to: ${names.join(', ')}`,
        );
    }
}
