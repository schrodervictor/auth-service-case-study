import 'reflect-metadata';
import { Container } from 'inversify';
import type { DataSource } from 'typeorm';

import { createContainer } from '../../../src/inversify.config';
import { TYPES } from '../../../src/lib/types';
import type { AppConfig } from '../../../src/config/schema';
import type { AppSecrets } from '../../../src/config/secrets-schema';
import { makeTestConfig } from '../../helpers/test-config';
import { PasswordManagerServiceImpl } from '../../../src/services/password-manager-service';
import { UserServiceImpl } from '../../../src/services/user-service';
import { UserRepositoryImpl } from '../../../src/repositories/user-repository';
import { RefreshTokenRepositoryImpl } from '../../../src/repositories/refresh-token-repository';
import { PasswordResetKeyRepositoryImpl } from '../../../src/repositories/password-reset-key-repository';
import { createAuthMiddleware } from '../../../src/middleware/auth-middleware';
import { createRateLimitMiddleware } from '../../../src/middleware/rate-limit-middleware';
import { RedisClient } from '../../../src/redis/redis-client';

jest.mock('../../../src/middleware/auth-middleware', () => ({
    createAuthMiddleware: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../src/middleware/rate-limit-middleware', () => ({
    createRateLimitMiddleware: jest.fn().mockReturnValue(jest.fn()),
}));

const MOCK_SECRETS: AppSecrets = {
    jwtSecret: 'test-secret',
    databaseUser: 'testuser',
    databasePassword: 'testpass',
};

const VALID_CONFIG = makeTestConfig();

const MOCK_DATA_SOURCE = {
    options: {},
    getRepository: jest.fn().mockReturnValue({
        findOneBy: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
    }),
} as unknown as DataSource;

const MOCK_REDIS_CLIENT = new RedisClient(null);

describe('DI container integration', () => {
    let container: Container;

    beforeEach(() => {
        jest.clearAllMocks();
        container = createContainer(
            VALID_CONFIG,
            MOCK_DATA_SOURCE,
            MOCK_SECRETS,
            MOCK_REDIS_CLIENT,
        );
        container.bind(TYPES.Producer).toConstantValue({});
    });

    it('should return a Container instance', () => {
        expect(container).toBeInstanceOf(Container);
    });

    const allBindings = [
        'Config',
        'DataSource',
        'Secrets',
        'RedisClient',
        'UserService',
        'PasswordManagerService',
        'UserRepository',
        'RefreshTokenRepository',
        'PasswordResetKeyRepository',
        'AuthMiddleware',
        'JsonContentType',
        'LoginRateLimiter',
        'RefreshRateLimiter',
        'ResetKeyRateLimiter',
        'ValidateResetKeyRateLimiter',
        'ResetPasswordRateLimiter',
    ];

    it.each(allBindings)('should bind TYPES.%s', name => {
        expect(
            container.isBound(TYPES[name as keyof typeof TYPES]),
        ).toBe(true);
    });

    describe('constant bindings', () => {
        it('should resolve Config to the provided config', () => {
            expect(container.get(TYPES.Config)).toEqual(VALID_CONFIG);
        });

        it('should resolve Secrets to the provided secrets', () => {
            expect(container.get(TYPES.Secrets)).toEqual(MOCK_SECRETS);
        });

        it('should resolve DataSource to the provided data source', () => {
            expect(container.get(TYPES.DataSource)).toBe(MOCK_DATA_SOURCE);
        });

        it('should resolve RedisClient to the provided client', () => {
            expect(container.get(TYPES.RedisClient)).toBe(MOCK_REDIS_CLIENT);
        });
    });

    const implBindings = [
        { name: 'UserService', impl: UserServiceImpl },
        { name: 'PasswordManagerService', impl: PasswordManagerServiceImpl },
        { name: 'UserRepository', impl: UserRepositoryImpl },
        { name: 'RefreshTokenRepository', impl: RefreshTokenRepositoryImpl },
        {
            name: 'PasswordResetKeyRepository',
            impl: PasswordResetKeyRepositoryImpl,
        },
    ];

    it.each(implBindings)(
        'should resolve $name to correct implementation',
        ({ name, impl }) => {
            expect(
                container.get(TYPES[name as keyof typeof TYPES]),
            ).toBeInstanceOf(impl);
        },
    );

    describe('middleware factory calls', () => {
        it('should pass jwtSecret to createAuthMiddleware', () => {
            expect(createAuthMiddleware).toHaveBeenCalledWith(
                MOCK_SECRETS.jwtSecret,
            );
        });

        const rateLimitCases = [
            'login',
            'refresh',
            'resetKey',
            'validateResetKey',
            'resetPassword',
        ];

        it.each(rateLimitCases)(
            'should call createRateLimitMiddleware for %s',
            key => {
                expect(createRateLimitMiddleware).toHaveBeenCalledWith(
                    MOCK_REDIS_CLIENT,
                    key,
                    VALID_CONFIG.rateLimit[
                        key as keyof typeof VALID_CONFIG.rateLimit
                    ],
                );
            },
        );
    });

    describe('invalid arguments', () => {
        it.each([
            { label: 'null config', config: null, secrets: MOCK_SECRETS },
            {
                label: 'undefined config',
                config: undefined,
                secrets: MOCK_SECRETS,
            },
            {
                label: 'undefined secrets',
                config: VALID_CONFIG,
                secrets: undefined,
            },
        ])('should throw with $label', ({ config, secrets }) => {
            expect(() =>
                createContainer(
                    config as unknown as AppConfig,
                    MOCK_DATA_SOURCE,
                    secrets as unknown as AppSecrets,
                    MOCK_REDIS_CLIENT,
                ),
            ).toThrow();
        });
    });
});
