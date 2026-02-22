import { configSchema, type AppConfig } from '../../../src/config/schema';

const MINIMAL_CONFIG = {
    database: { host: 'localhost', name: 'mydb' },
};

describe('configSchema — auth.resetKey section', () => {
    describe('defaults', () => {
        it('should apply default resetKey config when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.auth.resetKey).toEqual({
                expiresIn: '15m',
            });
        });

        it('should default expiresIn to "15m"', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                auth: {},
            });

            expect(result.auth.resetKey.expiresIn).toBe('15m');
        });

        it('should default expiresIn to "15m" when resetKey is empty object', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                auth: { resetKey: {} },
            });

            expect(result.auth.resetKey.expiresIn).toBe('15m');
        });
    });

    describe('custom values', () => {
        it('should allow overriding expiresIn', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                auth: { resetKey: { expiresIn: '30m' } },
            });

            expect(result.auth.resetKey.expiresIn).toBe('30m');
        });
    });

    describe('type inference', () => {
        it('should include resetKey in AppConfig auth section', () => {
            const config: AppConfig = configSchema.parse(MINIMAL_CONFIG);

            const expiresIn: string = config.auth.resetKey.expiresIn;

            expect(expiresIn).toBe('15m');
        });
    });
});

describe('configSchema — rateLimit password-reset entries', () => {
    describe('defaults', () => {
        it('should apply default resetKey rate limit when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.rateLimit.resetKey).toEqual({
                maxAttempts: 3,
                windowSeconds: 900,
            });
        });

        it('should apply default validateResetKey rate limit when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.rateLimit.validateResetKey).toEqual({
                maxAttempts: 10,
                windowSeconds: 900,
            });
        });

        it('should apply default resetPassword rate limit when section is omitted', () => {
            const result = configSchema.parse(MINIMAL_CONFIG);

            expect(result.rateLimit.resetPassword).toEqual({
                maxAttempts: 5,
                windowSeconds: 900,
            });
        });

        it('should default resetKey rate limit when rateLimit is empty object', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {},
            });

            expect(result.rateLimit.resetKey).toEqual({
                maxAttempts: 3,
                windowSeconds: 900,
            });
        });

        it('should default validateResetKey rate limit when rateLimit is empty object', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {},
            });

            expect(result.rateLimit.validateResetKey).toEqual({
                maxAttempts: 10,
                windowSeconds: 900,
            });
        });

        it('should default resetPassword rate limit when rateLimit is empty object', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {},
            });

            expect(result.rateLimit.resetPassword).toEqual({
                maxAttempts: 5,
                windowSeconds: 900,
            });
        });
    });

    describe('custom values', () => {
        it('should allow overriding resetKey rate limit', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetKey: { maxAttempts: 5, windowSeconds: 600 },
                },
            });

            expect(result.rateLimit.resetKey).toEqual({
                maxAttempts: 5,
                windowSeconds: 600,
            });
        });

        it('should allow overriding validateResetKey rate limit', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    validateResetKey: { maxAttempts: 20, windowSeconds: 1800 },
                },
            });

            expect(result.rateLimit.validateResetKey).toEqual({
                maxAttempts: 20,
                windowSeconds: 1800,
            });
        });

        it('should allow overriding resetPassword rate limit', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetPassword: { maxAttempts: 10, windowSeconds: 300 },
                },
            });

            expect(result.rateLimit.resetPassword).toEqual({
                maxAttempts: 10,
                windowSeconds: 300,
            });
        });

        it('should keep existing login/refresh defaults when overriding password-reset entries', () => {
            const result = configSchema.parse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetKey: { maxAttempts: 5, windowSeconds: 600 },
                },
            });

            expect(result.rateLimit.login).toEqual({
                maxAttempts: 5,
                windowSeconds: 900,
            });
            expect(result.rateLimit.refresh).toEqual({
                maxAttempts: 10,
                windowSeconds: 900,
            });
        });
    });

    describe('validation', () => {
        it('should reject non-number maxAttempts for resetKey', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetKey: { maxAttempts: 'three', windowSeconds: 900 },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject non-number windowSeconds for validateResetKey', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    validateResetKey: { maxAttempts: 10, windowSeconds: '15m' },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject resetPassword missing maxAttempts', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetPassword: { windowSeconds: 900 },
                },
            });

            expect(result.success).toBe(false);
        });

        it('should reject resetPassword missing windowSeconds', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                rateLimit: {
                    resetPassword: { maxAttempts: 5 },
                },
            });

            expect(result.success).toBe(false);
        });
    });

    describe('type inference', () => {
        it('should include password-reset rate limit entries in AppConfig type', () => {
            const config: AppConfig = configSchema.parse(MINIMAL_CONFIG);

            const resetKeyMax: number = config.rateLimit.resetKey.maxAttempts;
            const resetKeyWindow: number = config.rateLimit.resetKey.windowSeconds;
            const validateMax: number = config.rateLimit.validateResetKey.maxAttempts;
            const validateWindow: number = config.rateLimit.validateResetKey.windowSeconds;
            const resetPasswordMax: number = config.rateLimit.resetPassword.maxAttempts;
            const resetPasswordWindow: number = config.rateLimit.resetPassword.windowSeconds;

            expect(resetKeyMax).toBe(3);
            expect(resetKeyWindow).toBe(900);
            expect(validateMax).toBe(10);
            expect(validateWindow).toBe(900);
            expect(resetPasswordMax).toBe(5);
            expect(resetPasswordWindow).toBe(900);
        });
    });
});
