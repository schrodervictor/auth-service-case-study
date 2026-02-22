import { loadConfig } from '../config';
import type { KafkaClient } from './types';

export async function createKafkaClient(): Promise<KafkaClient> {
    const config = loadConfig();
    console.log('[EVENTBUS] Emulated Kafka client created');
    return { mode: 'emulated', outputPath: config.eventbus.outputPath };
}
