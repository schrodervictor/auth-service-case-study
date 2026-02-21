import { configSchema } from '../../../src/config/schema';

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
        it('should parse config without secretsPath or ssm (existing configs unchanged)', () => {
            const result = configSchema.safeParse(MINIMAL_CONFIG);

            expect(result.success).toBe(true);
        });

        it('should parse full config without secretsPath or ssm', () => {
            const result = configSchema.safeParse(FULL_CONFIG);

            expect(result.success).toBe(true);
        });
    });

    describe('secretsPath field', () => {
        it('should accept config with secretsPath string', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                secretsPath: '/run/secrets/app-secrets.json',
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.secretsPath).toBe('/run/secrets/app-secrets.json');
            }
        });

        it('should allow secretsPath to be omitted (undefined)', () => {
            const result = configSchema.safeParse(MINIMAL_CONFIG);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.secretsPath).toBeUndefined();
            }
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
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                ssm: SSM_SECTION,
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ssm).toEqual(SSM_SECTION);
            }
        });

        it('should allow ssm to be omitted (undefined)', () => {
            const result = configSchema.safeParse(MINIMAL_CONFIG);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.ssm).toBeUndefined();
            }
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

    describe('secretsPath and ssm coexistence', () => {
        it('should accept config with both secretsPath and ssm', () => {
            const result = configSchema.safeParse({
                ...MINIMAL_CONFIG,
                secretsPath: '/run/secrets/app-secrets.json',
                ssm: {
                    region: 'us-east-1',
                    parameters: {
                        jwtSecret: '/myapp/prod/jwt-secret',
                        databaseUser: '/myapp/prod/db-user',
                        databasePassword: '/myapp/prod/db-password',
                    },
                },
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.secretsPath).toBe('/run/secrets/app-secrets.json');
                expect(result.data.ssm).toBeDefined();
            }
        });
    });
});
