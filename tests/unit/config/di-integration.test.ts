import 'reflect-metadata';
import { Container } from 'inversify';
import type { DataSource } from 'typeorm';

import { createContainer } from '../../../src/inversify.config';
import { TYPES } from '../../../src/lib/types';
import type { AppConfig } from '../../../src/config/schema';
import type { AppSecrets } from '../../../src/config/secrets-schema';
import { PasswordManagerServiceImpl } from '../../../src/services/password-manager-service';
import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import { RefreshTokenRepositoryImpl } from '../../../src/repositories/refresh-token-repository';
import { createAuthMiddleware } from '../../../src/middleware/auth-middleware';

jest.mock('../../../src/middleware/auth-middleware', () => ({
    createAuthMiddleware: jest.fn().mockReturnValue(jest.fn()),
}));

const MOCK_SECRETS: AppSecrets = {
    jwtSecret: 'test-secret',
    databaseUser: 'testuser',
    databasePassword: 'testpass',
};

const VALID_CONFIG: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'testdb' },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
    },
    redis: { host: 'redis', port: 6379 },
    rateLimit: {
        login: { maxAttempts: 5, windowSeconds: 900 },
        refresh: { maxAttempts: 10, windowSeconds: 900 },
    },
};

const MOCK_DATA_SOURCE = {
    options: {},
    getRepository: jest.fn().mockReturnValue({
        findOneBy: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
    }),
} as unknown as DataSource;

describe('DI container config integration', () => {
    describe('config binding', () => {
        it('should return a Container instance', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container).toBeInstanceOf(Container);
        });

        it('should bind config under TYPES.Config', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container.isBound(TYPES.Config)).toBe(true);
        });

        it('should retrieve the config object with correct values', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const config = container.get<AppConfig>(TYPES.Config);

            expect(config).toEqual(VALID_CONFIG);
        });

        it('should bind config as a constant (same reference on multiple gets)', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const first = container.get<AppConfig>(TYPES.Config);
            const second = container.get<AppConfig>(TYPES.Config);

            expect(first).toBe(second);
        });
    });

    describe('PasswordManagerService binding', () => {
        it('should bind TYPES.PasswordManagerService in the container', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container.isBound(TYPES.PasswordManagerService)).toBe(true);
        });

        it('should resolve PasswordManagerService to a PasswordManagerServiceImpl instance', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const service = container.get(TYPES.PasswordManagerService);

            expect(service).toBeInstanceOf(PasswordManagerServiceImpl);
        });
    });

    describe('UserRepository binding', () => {
        it('should bind TYPES.UserRepository in the container', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container.isBound(TYPES.UserRepository)).toBe(true);
        });

        it('should resolve UserRepository to a UserRepositoryImpl instance', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const repository = container.get(TYPES.UserRepository);

            expect(repository).toBeInstanceOf(UserRepositoryImpl);
        });
    });

    describe('RefreshTokenRepository binding', () => {
        it('should bind TYPES.RefreshTokenRepository in the container', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container.isBound(TYPES.RefreshTokenRepository)).toBe(true);
        });

        it('should resolve RefreshTokenRepository to a RefreshTokenRepositoryImpl instance', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const repository = container.get(TYPES.RefreshTokenRepository);

            expect(repository).toBeInstanceOf(RefreshTokenRepositoryImpl);
        });
    });

    describe('secrets binding', () => {
        it('should have TYPES.Secrets symbol defined', () => {
            expect(TYPES.Secrets).toBeDefined();
            expect(typeof TYPES.Secrets).toBe('symbol');
        });

        it('should require secrets as 3rd parameter to createContainer', () => {
            // secrets is required — calling without it should throw
            expect(() =>
                createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, undefined as unknown as AppSecrets),
            ).toThrow();
        });

        it('should bind secrets under TYPES.Secrets', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(container.isBound(TYPES.Secrets)).toBe(true);
        });

        it('should retrieve the secrets object with correct values', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const secrets = container.get<AppSecrets>(TYPES.Secrets);

            expect(secrets).toEqual(MOCK_SECRETS);
        });

        it('should bind secrets as a constant (same reference on multiple gets)', () => {
            const container = createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            const first = container.get<AppSecrets>(TYPES.Secrets);
            const second = container.get<AppSecrets>(TYPES.Secrets);

            expect(first).toBe(second);
        });

        it('should pass secrets.jwtSecret to createAuthMiddleware', () => {
            createContainer(VALID_CONFIG, MOCK_DATA_SOURCE, MOCK_SECRETS);

            expect(createAuthMiddleware).toHaveBeenCalledWith(MOCK_SECRETS.jwtSecret);
        });
    });

    describe('invalid config', () => {
        it('should throw when config is null', () => {
            expect(() => createContainer(null as unknown as AppConfig, MOCK_DATA_SOURCE, MOCK_SECRETS)).toThrow();
        });

        it('should throw when config is undefined', () => {
            expect(() => createContainer(undefined as unknown as AppConfig, MOCK_DATA_SOURCE, MOCK_SECRETS)).toThrow();
        });
    });
});
