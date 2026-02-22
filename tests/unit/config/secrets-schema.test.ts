import { secretsSchema } from '../../../src/config/secrets-schema';
import type { AppSecrets } from '../../../src/config/secrets-schema';

const VALID_SECRETS = {
    jwtSecret: 'super-secret-key-256-bits-long',
    databaseUser: 'app_user',
    databasePassword: 'p@ssw0rd!',
};

describe('secretsSchema', () => {
    describe('valid input', () => {
        it('should parse successfully with all three fields', () => {
            const result = secretsSchema.parse(VALID_SECRETS);

            expect(result).toEqual(VALID_SECRETS);
        });

        it('should return the correct type shape', () => {
            const result: AppSecrets = secretsSchema.parse(VALID_SECRETS);

            expect(result.jwtSecret).toBe(VALID_SECRETS.jwtSecret);
            expect(result.databaseUser).toBe(VALID_SECRETS.databaseUser);
            expect(result.databasePassword).toBe(
                VALID_SECRETS.databasePassword,
            );
        });
    });

    describe('missing fields', () => {
        it('should reject when jwtSecret is missing', () => {
            const { jwtSecret: _, ...withoutJwt } = VALID_SECRETS;

            const result = secretsSchema.safeParse(withoutJwt);

            expect(result.success).toBe(false);
        });

        it('should reject when databaseUser is missing', () => {
            const { databaseUser: _, ...withoutUser } = VALID_SECRETS;

            const result = secretsSchema.safeParse(withoutUser);

            expect(result.success).toBe(false);
        });

        it('should reject when databasePassword is missing', () => {
            const { databasePassword: _, ...withoutPass } = VALID_SECRETS;

            const result = secretsSchema.safeParse(withoutPass);

            expect(result.success).toBe(false);
        });

        it('should reject an empty object', () => {
            const result = secretsSchema.safeParse({});

            expect(result.success).toBe(false);
        });
    });

    describe('empty strings rejected', () => {
        it('should reject empty string for jwtSecret', () => {
            const result = secretsSchema.safeParse({
                ...VALID_SECRETS,
                jwtSecret: '',
            });

            expect(result.success).toBe(false);
        });

        it('should reject empty string for databaseUser', () => {
            const result = secretsSchema.safeParse({
                ...VALID_SECRETS,
                databaseUser: '',
            });

            expect(result.success).toBe(false);
        });

        it('should reject empty string for databasePassword', () => {
            const result = secretsSchema.safeParse({
                ...VALID_SECRETS,
                databasePassword: '',
            });

            expect(result.success).toBe(false);
        });
    });

    describe('extra fields', () => {
        it('should strip unknown fields', () => {
            const result = secretsSchema.parse({
                ...VALID_SECRETS,
                extraField: 'should-be-stripped',
                anotherExtra: 123,
            });

            expect(result).toEqual(VALID_SECRETS);
            expect(result).not.toHaveProperty('extraField');
            expect(result).not.toHaveProperty('anotherExtra');
        });
    });

    describe('wrong types', () => {
        it('should reject a number for jwtSecret', () => {
            const result = secretsSchema.safeParse({
                ...VALID_SECRETS,
                jwtSecret: 12345,
            });

            expect(result.success).toBe(false);
        });

        it('should reject null values', () => {
            const result = secretsSchema.safeParse({
                jwtSecret: null,
                databaseUser: null,
                databasePassword: null,
            });

            expect(result.success).toBe(false);
        });
    });
});
