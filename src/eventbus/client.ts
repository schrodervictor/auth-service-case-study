import type { KafkaClient } from './types';

export async function createKafkaClient(): Promise<KafkaClient> {
    console.log('[EVENTBUS] Emulated Kafka client created');
    return { mode: 'emulated' };
}
