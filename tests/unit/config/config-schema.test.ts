import { configSchema, type AppConfig } from '../../../src/config/schema';

const MINIMAL_CONFIG = {
    database: { host: 'localhost', name: 'mydb' },
};

const FULL_CONFIG = {
    server: { port: 3000 },
    database: { host: 'localhost', port: 5433, name: 'mydb' },
    auth: {
        accessToken: { expiresIn: '30m' },
        refreshToken: { expiresIn: '14d' },
    },
};

describe('configSchema — secrets injection fields', () => {
    describe('backward compatibility', () => {
        it('should parse config without ssm (existing configs unchanged)', () => {
            const result = configSchema.safeParse(MINIMAL_CONFIG);

            expect(result.success).toBe(true);
        });

        it('should parse full config without ssm', () => {
            const result = configSchema.safeParse(FULL_CONFIG);

            expect(result.success).toBe(true);
        });
    });

    describe('secretsPath field removed', () => {
        it('should strip secretsPath from parsed output (field no longer in schema)', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                secretsPath: '/run/secrets/app-secrets.json',
            });

            expect(result).not.toHaveProperty('secretsPath');
        });
    });

    describe('ssm field', () => {
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
                ...MINIMAL_CONFIG,
                ssm: SSM_SECTION,
            });

            expect(result.ssm).toEqual(SSM_SECTION);
        });

        it('should allow ssm to be omitted (undefined)', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.ssm).toBeUndefined();
        });

        it('should reject ssm without region', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                ssm: {
                    parameters: SSM_SECTION.parameters,
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject ssm without parameters', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                ssm: {
                    region: 'us-east-1',
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject ssm with incomplete parameters', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                ssm: {
                    region: 'us-east-1',
                    parameters: {
                        jwtSecret: '/myapp/prod/jwt-secret',
                        // missing databaseUser and databasePassword
                    },
                },
            });

            expect(result.success).toBe(false);
        });
    });
});

describe('configSchema — redis section', () => {
    describe('defaults', () => {
        it('should apply default redis config when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.redis).toEqual({
                host: 'redis',
                port: 6379,
            });
        });

        it('should default host to "redis"', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: {},
            });

            expect(result.redis.host).toBe('redis');
        });

        it('should default port to 6379', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: {},
            });

            expect(result.redis.port).toBe(6379);
        });

        it('should leave password undefined when not provided', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: {},
            });

            expect(result.redis.password).toBeUndefined();
        });
    });

    describe('custom values', () => {
        it('should accept custom host', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: { host: 'my-redis-host' },
            });

            expect(result.redis.host).toBe('my-redis-host');
        });

        it('should accept custom port', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: { port: 6380 },
            });

            expect(result.redis.port).toBe(6380);
        });

        it('should accept password', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: { password: 's3cret' },
            });

            expect(result.redis.password).toBe('s3cret');
        });

        it('should accept all custom values together', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                redis: { host: 'custom-host', port: 6380, password: 'pass123' },
            });

            expect(result.redis).toEqual({
                host: 'custom-host',
                port: 6380,
                password: 'pass123',
            });
        });
    });

    describe('validation', () => {
        it('should reject non-string host', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                redis: { host: 123 },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-number port', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                redis: { port: 'not-a-number' },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-string password', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                redis: { password: 42 },
            });

            expect(result.success).toBe(false);
        });
    });
});

describe('configSchema — rateLimit section', () => {
    describe('defaults', () => {
        it('should apply default rateLimit config when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.rateLimit).toEqual({
                login: { maxAttempts: 5, windowSeconds: 900 },
                refresh: { maxAttempts: 10, windowSeconds: 900 },
            });
        });

        it('should default login to maxAttempts=5, windowSeconds=900', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {},
            });

            expect(result.rateLimit.login).toEqual({
                maxAttempts: 5,
                windowSeconds: 900,
            });
        });

        it('should default refresh to maxAttempts=10, windowSeconds=900', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {},
            });

            expect(result.rateLimit.refresh).toEqual({
                maxAttempts: 10,
                windowSeconds: 900,
            });
        });
    });

    describe('custom values', () => {
        it('should allow overriding login rate limit', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 3, windowSeconds: 600 },
                },
            });

            expect(result.rateLimit.login).toEqual({
                maxAttempts: 3,
                windowSeconds: 600,
            });
        });

        it('should allow overriding refresh rate limit', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    refresh: { maxAttempts: 20, windowSeconds: 1800 },
                },
            });

            expect(result.rateLimit.refresh).toEqual({
                maxAttempts: 20,
                windowSeconds: 1800,
            });
        });

        it('should allow overriding both login and refresh', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 10, windowSeconds: 300 },
                    refresh: { maxAttempts: 25, windowSeconds: 60 },
                },
            });

            expect(result.rateLimit.login).toEqual({
                maxAttempts: 10,
                windowSeconds: 300,
            });
            expect(result.rateLimit.refresh).toEqual({
                maxAttempts: 25,
                windowSeconds: 60,
            });
        });

        it('should keep default for refresh when only login is overridden', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 3, windowSeconds: 600 },
                },
            });

            expect(result.rateLimit.refresh).toEqual({
                maxAttempts: 10,
                windowSeconds: 900,
            });
        });
    });

    describe('validation', () => {
        it('should reject non-number maxAttempts for login', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 'five', windowSeconds: 900 },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-number windowSeconds for login', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 5, windowSeconds: '15m' },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-number maxAttempts for refresh', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    refresh: { maxAttempts: true, windowSeconds: 900 },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-number windowSeconds for refresh', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    refresh: { maxAttempts: 10, windowSeconds: null },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject login missing maxAttempts', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { windowSeconds: 900 },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject login missing windowSeconds', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    login: { maxAttempts: 5 },
                },
            });

            expect(result.success).toBe(false);
        });
    });
});

describe('configSchema — AppConfig type inference', () => {
    it('should include redis section in AppConfig type', () => {
        const config: AppConfig = configSchema.parse(MINIMAL_CONFIG);

        const redisHost: string = config.redis.host;
        const redisPort: number = config.redis.port;
        const redisPassword: string | undefined = config.redis.password;

        expect(redisHost).toBe('redis');
        expect(redisPort).toBe(6379);
        expect(redisPassword).toBeUndefined();
    });

    it('should include rateLimit section in AppConfig type', () => {
        const config: AppConfig = configSchema.parse(MINIMAL_CONFIG);

        const loginMax: number = config.rateLimit.login.maxAttempts;
        const loginWindow: number = config.rateLimit.login.windowSeconds;
        const refreshMax: number = config.rateLimit.refresh.maxAttempts;
        const refreshWindow: number = config.rateLimit.refresh.windowSeconds;

        expect(loginMax).toBe(5);
        expect(loginWindow).toBe(900);
        expect(refreshMax).toBe(10);
        expect(refreshWindow).toBe(900);
    });
});
