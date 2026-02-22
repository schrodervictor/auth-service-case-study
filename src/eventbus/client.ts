import { loadConfig } from '../config';
import type { KafkaClient } from './types';

export async function createKafkaClient(): Promise<KafkaClient> {
    const config = loadConfig();
    const eventbus = config.eventbus;
    const outputPath = eventbus.mode === 'emulated' ? eventbus.outputPath : undefined;

    console.log('[EVENTBUS] Emulated Kafka client created');
    return { mode: 'emulated', outputPath };
}
