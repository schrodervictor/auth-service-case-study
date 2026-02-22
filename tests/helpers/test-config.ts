import type { AppConfig } from '../../src/config/schema';

type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge<T extends Record<string, unknown>>(
    base: T,
    overrides: Record<string, unknown>,
): T {
    const result = { ...base };
    for (const key of Object.keys(overrides)) {
        const baseVal = base[key];
        const overVal = overrides[key];
        if (
            baseVal !== null &&
            overVal !== null &&
            typeof baseVal === 'object' &&
            typeof overVal === 'object' &&
            !Array.isArray(baseVal)
        ) {
            (result as Record<string, unknown>)[key] = deepMerge(
                baseVal as Record<string, unknown>,
                overVal as Record<string, unknown>,
            );
        } else {
            (result as Record<string, unknown>)[key] = overVal;
        }
    }
    return result;
}

const BASE_CONFIG: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'testdb' },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
        resetKey: { expiresIn: '15m' },
    },
    redis: { host: 'redis', port: 6379 },
    rateLimit: {
        login: { maxAttempts: 5, windowSeconds: 900 },
        refresh: { maxAttempts: 10, windowSeconds: 900 },
        resetKey: { maxAttempts: 3, windowSeconds: 900 },
        validateResetKey: { maxAttempts: 10, windowSeconds: 900 },
        resetPassword: { maxAttempts: 5, windowSeconds: 900 },
    },
    eventbus: { mode: 'emulated' as const },
};

export function makeTestConfig(
    overrides?: DeepPartial<AppConfig>,
): AppConfig {
    if (!overrides) return { ...BASE_CONFIG };
    return deepMerge(BASE_CONFIG, overrides as Record<string, unknown>);
}
