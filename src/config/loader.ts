import fs from 'node:fs';

import { configSchema, type AppConfig } from './schema';

function deepFreeze<T extends object>(obj: T): Readonly<T> {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
        if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    }
    return obj;
}

export function loadConfig(): AppConfig {
    const configPath = process.env.CONFIG_PATH;

    if (!configPath) {
        throw new Error(
            'CONFIG_PATH environment variable is not set or empty',
        );
    }

    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    return deepFreeze(configSchema.parse(parsed));
}
