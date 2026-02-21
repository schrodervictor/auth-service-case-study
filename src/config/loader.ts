import fs from 'node:fs';

import { configSchema, type AppConfig } from './schema';

export function loadConfig(): AppConfig {
    const configPath = process.env.CONFIG_PATH;

    if (!configPath) {
        throw new Error(
            'CONFIG_PATH environment variable is not set or empty',
        );
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    return configSchema.parse(parsed);
}
