import { configSchema, type AppConfig } from '../../../src/config/schema';
import { makeTestConfig } from '../../helpers/test-config';

const VALID_CONFIG = makeTestConfig();

describe('configSchema — required sections', () => {
    it('should parse a valid full config', () => {
        const result = configSchema.safeParse(VALID_CONFIG);

        expect(result.success).toBe(true);
    });

    const requiredSections = [
        'server',
        'database',
        'auth',
        'redis',
        'rateLimit',
        'eventbus',
    ];

    it.each(requiredSections)(
        'should reject when %s section is missing',
        section => {
            const { [section]: _, ...config } =
                VALID_CONFIG as Record<string, unknown>;
            const result = configSchema.safeParse(config);

            expect(result.success).toBe(false);
        },
    );
});

describe('configSchema — ssm section', () => {
    const SSM_SECTION = {
        region: 'us-east-1',
        parameters: {
            jwtSecret: '/myapp/prod/jwt-secret',
            databaseUser: '/myapp/prod/db-user',
            databasePassword: '/myapp/prod/db-password',
        },
    };

    it('should accept config with ssm section', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            ssm: SSM_SECTION,
        });

        expect(result.ssm).toEqual(SSM_SECTION);
    });

    it('should allow ssm to be omitted (undefined)', () => {
        const result = configSchema.parse(VALID_CONFIG);

        expect(result.ssm).toBeUndefined();
    });

    it('should reject ssm without region', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            ssm: { parameters: SSM_SECTION.parameters },
        });

        expect(result.success).toBe(false);
    });

    it('should reject ssm without parameters', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            ssm: { region: 'us-east-1' },
        });

        expect(result.success).toBe(false);
    });

    it('should reject ssm with incomplete parameters', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            ssm: {
                region: 'us-east-1',
                parameters: { jwtSecret: '/myapp/prod/jwt-secret' },
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('configSchema — auth section', () => {
    it('should accept custom resetKey expiresIn', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            auth: { ...VALID_CONFIG.auth, resetKey: { expiresIn: '30m' } },
        });

        expect(result.auth.resetKey.expiresIn).toBe('30m');
    });

    it('should reject missing resetKey section', () => {
        const { resetKey: _, ...authWithoutResetKey } = VALID_CONFIG.auth;
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            auth: authWithoutResetKey,
        });

        expect(result.success).toBe(false);
    });
});

describe('configSchema — redis section', () => {
    it('should accept custom redis values', () => {
        const input = {
            ...VALID_CONFIG,
            redis: { host: 'custom-host', port: 6380, password: 'pass123' },
        };

        const result = configSchema.parse(input);

        expect(result.redis).toEqual({
            host: 'custom-host',
            port: 6380,
            password: 'pass123',
        });
    });

    it('should leave password undefined when not provided', () => {
        const result = configSchema.parse(VALID_CONFIG);

        expect(result.redis.password).toBeUndefined();
    });

    it('should reject non-string host', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            redis: { ...VALID_CONFIG.redis, host: 123 },
        });

        expect(result.success).toBe(false);
    });

    it('should reject non-number port', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            redis: { ...VALID_CONFIG.redis, port: 'not-a-number' },
        });

        expect(result.success).toBe(false);
    });
});

describe('configSchema — rateLimit section', () => {
    const rateLimitKeys = [
        { key: 'login', maxAttempts: 3, windowSeconds: 600 },
        { key: 'refresh', maxAttempts: 8, windowSeconds: 600 },
        { key: 'resetKey', maxAttempts: 5, windowSeconds: 600 },
        { key: 'validateResetKey', maxAttempts: 20, windowSeconds: 1800 },
        { key: 'resetPassword', maxAttempts: 10, windowSeconds: 300 },
    ];

    it.each(rateLimitKeys)(
        'should accept custom $key rate limit values',
        ({ key, maxAttempts, windowSeconds }) => {
            const result = configSchema.parse({
                ...VALID_CONFIG,
                rateLimit: {
                    ...VALID_CONFIG.rateLimit,
                    [key]: { maxAttempts, windowSeconds },
                },
            });

            expect(
                (result.rateLimit as Record<string, unknown>)[key],
            ).toEqual({ maxAttempts, windowSeconds });
        },
    );

    it('should reject non-number maxAttempts', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                login: { maxAttempts: 'five', windowSeconds: 900 },
            },
        });

        expect(result.success).toBe(false);
    });

    it('should reject missing maxAttempts', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                login: { windowSeconds: 900 },
            },
        });

        expect(result.success).toBe(false);
    });

    it('should reject missing windowSeconds', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                login: { maxAttempts: 5 },
            },
        });

        expect(result.success).toBe(false);
    });
});

describe('configSchema — eventbus section', () => {
    it('should accept emulated mode with outputPath', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            eventbus: { mode: 'emulated', outputPath: '/tmp/events.jsonl' },
        });

        expect(result.eventbus.mode).toBe('emulated');
        expect((result.eventbus as { outputPath?: string }).outputPath).toBe(
            '/tmp/events.jsonl',
        );
    });

    it('should accept real mode with kafka settings', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            eventbus: { mode: 'real', kafka: { brokers: 'localhost:9092' } },
        });

        expect(result.eventbus.mode).toBe('real');
        expect(
            (result.eventbus as { kafka: Record<string, unknown> }).kafka,
        ).toEqual({ brokers: 'localhost:9092' });
    });

    it('should reject invalid mode', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            eventbus: { mode: 'invalid' },
        });

        expect(result.success).toBe(false);
    });
});

describe('configSchema — AppConfig type inference', () => {
    it('should include all sections in AppConfig type', () => {
        const config: AppConfig = configSchema.parse(VALID_CONFIG);

        const serverPort: number = config.server.port;
        const redisHost: string = config.redis.host;
        const loginMax: number = config.rateLimit.login.maxAttempts;

        expect(serverPort).toBe(9000);
        expect(redisHost).toBe('redis');
        expect(loginMax).toBe(5);
    });
});
