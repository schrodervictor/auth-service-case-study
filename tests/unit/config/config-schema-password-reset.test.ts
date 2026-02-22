import { configSchema } from '../../../src/config/schema';
import { makeTestConfig } from '../../helpers/test-config';

const VALID_CONFIG = makeTestConfig();

describe('configSchema — auth.resetKey section', () => {
    it('should accept custom expiresIn', () => {
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

describe('configSchema — rateLimit password-reset entries', () => {
    it('should accept custom resetKey rate limit', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                resetKey: { maxAttempts: 5, windowSeconds: 600 },
            },
        });

        expect(result.rateLimit.resetKey).toEqual({
            maxAttempts: 5,
            windowSeconds: 600,
        });
    });

    it('should accept custom validateResetKey rate limit', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                validateResetKey: { maxAttempts: 20, windowSeconds: 1800 },
            },
        });

        expect(result.rateLimit.validateResetKey).toEqual({
            maxAttempts: 20,
            windowSeconds: 1800,
        });
    });

    it('should accept custom resetPassword rate limit', () => {
        const result = configSchema.parse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                resetPassword: { maxAttempts: 10, windowSeconds: 300 },
            },
        });

        expect(result.rateLimit.resetPassword).toEqual({
            maxAttempts: 10,
            windowSeconds: 300,
        });
    });

    it('should reject non-number maxAttempts for resetKey', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                resetKey: { maxAttempts: 'three', windowSeconds: 900 },
            },
        });

        expect(result.success).toBe(false);
    });

    it('should reject resetPassword missing maxAttempts', () => {
        const result = configSchema.safeParse({
            ...VALID_CONFIG,
            rateLimit: {
                ...VALID_CONFIG.rateLimit,
                resetPassword: { windowSeconds: 900 },
            },
        });

        expect(result.success).toBe(false);
    });
});
