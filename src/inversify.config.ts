import type { RequestHandler } from 'express';
import { Container } from 'inversify';
import type { DataSource } from 'typeorm';

import './controllers/health-check-controller';
import './controllers/user-controller';

import type { AppConfig } from './config/schema';
import type { AppSecrets } from './config/secrets-schema';
import { TYPES } from './lib/types';

import { PasswordManagerService, PasswordManagerServiceImpl } from './services';
import type { UserService } from './services/user-service';
import { UserServiceImpl } from './services/user-service';
import {
    UserRepository,
    UserRepositoryImpl,
    RefreshTokenRepository,
    RefreshTokenRepositoryImpl,
    PasswordResetKeyRepository,
    PasswordResetKeyRepositoryImpl,
} from './repositories';
import { createAuthMiddleware } from './middleware/auth-middleware';
import type { AuthMiddlewareFunction } from './middleware/auth-middleware';
import { requireJsonContentType } from './middleware/content-type-middleware';
import { createRateLimitMiddleware } from './middleware/rate-limit-middleware';
import type { RateLimitMiddlewareFunction } from './middleware/rate-limit-middleware';
import type { RedisClient } from './redis/redis-client';

export function createContainer(
    config: AppConfig,
    dataSource: DataSource,
    secrets: AppSecrets,
    redisClient: RedisClient,
): Container {
    if (config == null) {
        throw new Error('Config is required to create the DI container');
    }
    if (secrets == null) {
        throw new Error('Secrets are required to create the DI container');
    }

    const container = new Container();

    container.bind<AppConfig>(TYPES.Config).toConstantValue(config);
    container.bind<DataSource>(TYPES.DataSource).toConstantValue(dataSource);

    // bind secrets
    container.bind<AppSecrets>(TYPES.Secrets).toConstantValue(secrets);

    // bind services
    container.bind<UserService>(TYPES.UserService).to(UserServiceImpl);
    container
        .bind<PasswordManagerService>(TYPES.PasswordManagerService)
        .to(PasswordManagerServiceImpl);

    // bind Redis client
    container.bind<RedisClient>(TYPES.RedisClient).toConstantValue(redisClient);

    // bind middleware
    container
        .bind<AuthMiddlewareFunction>(TYPES.AuthMiddleware)
        .toConstantValue(createAuthMiddleware(secrets.jwtSecret));

    container
        .bind<RequestHandler>(TYPES.JsonContentType)
        .toConstantValue(requireJsonContentType);

    container
        .bind<RateLimitMiddlewareFunction>(TYPES.LoginRateLimiter)
        .toConstantValue(
            createRateLimitMiddleware(
                redisClient,
                'login',
                config.rateLimit.login,
            ),
        );

    container
        .bind<RateLimitMiddlewareFunction>(TYPES.RefreshRateLimiter)
        .toConstantValue(
            createRateLimitMiddleware(
                redisClient,
                'refresh',
                config.rateLimit.refresh,
            ),
        );

    // bind repositories
    container.bind<UserRepository>(TYPES.UserRepository).to(UserRepositoryImpl);
    container
        .bind<RefreshTokenRepository>(TYPES.RefreshTokenRepository)
        .to(RefreshTokenRepositoryImpl);
    container
        .bind<PasswordResetKeyRepository>(TYPES.PasswordResetKeyRepository)
        .to(PasswordResetKeyRepositoryImpl);

    // bind rate limiters (password reset)
    container
        .bind<RateLimitMiddlewareFunction>(TYPES.ResetKeyRateLimiter)
        .toConstantValue(
            createRateLimitMiddleware(
                redisClient,
                'resetKey',
                config.rateLimit.resetKey,
            ),
        );

    container
        .bind<RateLimitMiddlewareFunction>(TYPES.ValidateResetKeyRateLimiter)
        .toConstantValue(
            createRateLimitMiddleware(
                redisClient,
                'validateResetKey',
                config.rateLimit.validateResetKey,
            ),
        );

    container
        .bind<RateLimitMiddlewareFunction>(TYPES.ResetPasswordRateLimiter)
        .toConstantValue(
            createRateLimitMiddleware(
                redisClient,
                'resetPassword',
                config.rateLimit.resetPassword,
            ),
        );

    return container;
}

// Keep backward-compatible default export for existing code
export const diContainer = new Container();
