import { configSchema, type AppConfig } from '../../../src/config/schema';
import { makeTestConfig } from '../../helpers/test-config';

const VALID_CONFIG = makeTestConfig();

describe('configSchema — required fields', () => {
    it('should parse a valid full config', () => {
        const result = configSchema.safeParse(VALID_CONFIG);

        expect(result.success).toBe(true);
    });

    it('should reject when server section is missing', () => {
        const { server: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });

    it('should reject when database section is missing', () => {
        const { database: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });

    it('should reject when auth section is missing', () => {
        const { auth: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });

    it('should reject when redis section is missing', () => {
        const { redis: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });

    it('should reject when rateLimit section is missing', () => {
        const { rateLimit: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });

    it('should reject when eventbus section is missing', () => {
        const { eventbus: _, ...config } = VALID_CONFIG;
        const result = configSchema.safeParse(config);

        expect(result.success).toBe(false);
    });
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
    it('should accept custom rate limit values', () => {
        const input = {
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                login: { maxAttempts: 3, windowSeconds: 600 },
            },
        };

        const result = configSchema.parse(input);

        expect(result.rateLimit.login).toEqual({
            maxAttempts: 3,
            windowSeconds: 600,
        });
    });

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
