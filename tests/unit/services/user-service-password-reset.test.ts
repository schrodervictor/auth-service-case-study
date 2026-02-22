import 'reflect-metadata';
import crypto from 'node:crypto';

import type { UserRepository } from '../../../src/repositories/user-repository';
import type { RefreshTokenRepository } from '../../../src/repositories/refresh-token-repository';
import type { PasswordResetKeyRepository } from '../../../src/repositories/password-reset-key-repository';
import type { PasswordManagerService } from '../../../src/services/password-manager-service';
import type { AppConfig } from '../../../src/config/schema';
import type { AppSecrets } from '../../../src/config/secrets-schema';
import { UserServiceImpl } from '../../../src/services/user-service';
import { User } from '../../../src/entities/user';
import { PasswordResetKey } from '../../../src/entities/password-reset-key';
import { InvalidResetKeyError } from '../../../src/errors/invalid-reset-key-error';
import { ValidationError } from '../../../src/errors';
import { Producer } from '../../../src/eventbus/producer';
import { DomainEvents } from '../../../src/eventbus/domain-events';

const createMockUserRepository = (): jest.Mocked<UserRepository> => ({
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePasswordHash: jest.fn(),
});

const createMockPasswordManager = (): jest.Mocked<PasswordManagerService> => ({
    toHash: jest.fn(),
    compare: jest.fn(),
});

const createMockRefreshTokenRepository = (): jest.Mocked<RefreshTokenRepository> => ({
    save: jest.fn(),
    findByTokenHash: jest.fn(),
    deleteByTokenHash: jest.fn(),
    deleteAllByUserId: jest.fn(),
});

const createMockPasswordResetKeyRepository = (): jest.Mocked<PasswordResetKeyRepository> => ({
    save: jest.fn(),
    findByKeyHash: jest.fn(),
    deleteByKeyHash: jest.fn(),
    deleteAllByUserId: jest.fn(),
    deleteExpired: jest.fn(),
});

const createMockProducer = (): jest.Mocked<Pick<Producer, 'publish'>> => ({
    publish: jest.fn(),
});

const mockConfig: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'test' },
    auth: {
        accessToken: { expiresIn: '15m' },
        refreshToken: { expiresIn: '7d' },
        resetKey: { expiresIn: '15m' },
    },
    redis: { host: 'redis', port: 6379 },
    rateLimit: {
        login: { maxAttempts: 5, windowSeconds: 900 },
        refresh: { maxAttempts: 10, windowSeconds: 900 },
        resetKey: { maxAttempts: 3, windowSeconds: 900 },
        validateResetKey: { maxAttempts: 10, windowSeconds: 900 },
        resetPassword: { maxAttempts: 5, windowSeconds: 900 },
    },
    eventbus: { mode: 'emulated' as const },
};

const mockSecrets: AppSecrets = {
    jwtSecret: 'test-jwt-secret',
    databaseUser: 'testuser',
    databasePassword: 'testpass',
};

const createSampleUser = (overrides?: Partial<User>): User => {
    const user = new User();
    user.id = 'uuid-1';
    user.email = 'test@example.com';
    user.passwordHash = 'hashed-password';
    user.firstName = 'John';
    user.lastName = 'Doe';
    user.createdAt = new Date('2024-01-01');
    user.updatedAt = new Date('2024-01-01');
    Object.assign(user, overrides);
    return user;
};

const createSampleResetKey = (overrides?: Partial<PasswordResetKey>): PasswordResetKey => {
    const key = new PasswordResetKey();
    key.id = 'reset-key-uuid-1';
    key.keyHash = 'stored-key-hash';
    key.userId = 'uuid-1';
    key.expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
    key.createdAt = new Date('2024-01-01');
    Object.assign(key, overrides);
    return key;
};

/** Catches a rejected promise and returns the error for assertion. */
const catchError = async <T>(promise: Promise<T>): Promise<Error> => {
    let caught: unknown;
    try {
        await promise;
    } catch (err) {
        caught = err;
    }
    return caught as Error;
};

describe('UserServiceImpl — Password Reset', () => {
    let mockUserRepo: jest.Mocked<UserRepository>;
    let mockPasswordManager: jest.Mocked<PasswordManagerService>;
    let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
    let mockResetKeyRepo: jest.Mocked<PasswordResetKeyRepository>;
    let mockProducer: jest.Mocked<Pick<Producer, 'publish'>>;
    let service: UserServiceImpl;

    beforeEach(() => {
        mockUserRepo = createMockUserRepository();
        mockPasswordManager = createMockPasswordManager();
        mockRefreshTokenRepo = createMockRefreshTokenRepository();
        mockResetKeyRepo = createMockPasswordResetKeyRepository();
        mockProducer = createMockProducer();
        service = new UserServiceImpl(
            mockUserRepo,
            mockPasswordManager,
            mockConfig,
            mockSecrets,
            mockRefreshTokenRepo,
            mockResetKeyRepo as unknown as PasswordResetKeyRepository,
            mockProducer as unknown as Producer,
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('requestPasswordReset', () => {
        it('should return void (resolve silently) when user is found', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            const result = await service.requestPasswordReset('test@example.com');

            expect(result).toBeUndefined();
        });

        it('should return void (resolve silently) when user is not found — no error thrown', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(null);

            const result = await service.requestPasswordReset('nonexistent@example.com');

            expect(result).toBeUndefined();
        });

        it('should call userRepository.findByEmail with the given email', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(null);

            await service.requestPasswordReset('someone@example.com');

            expect(mockUserRepo.findByEmail).toHaveBeenCalledWith('someone@example.com');
        });

        it('should call passwordResetKeyRepository.save when user is found', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            await service.requestPasswordReset('test@example.com');

            expect(mockResetKeyRepo.save).toHaveBeenCalledTimes(1);
        });

        it('should save the reset key with SHA-256 hash of the generated key', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            await service.requestPasswordReset('test@example.com');

            const [savedHash] = mockResetKeyRepo.save.mock.calls[0];
            // SHA-256 hex digest is 64 characters
            expect(savedHash).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should save the reset key with the correct userId', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser({ id: 'user-42' }));
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            await service.requestPasswordReset('test@example.com');

            const [, savedUserId] = mockResetKeyRepo.save.mock.calls[0];
            expect(savedUserId).toBe('user-42');
        });

        it('should save the reset key with a future expiresAt based on config', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            const beforeCall = Date.now();
            await service.requestPasswordReset('test@example.com');

            const [, , savedExpiresAt] = mockResetKeyRepo.save.mock.calls[0];
            expect(savedExpiresAt).toBeInstanceOf(Date);
            // Should be roughly 15 minutes in the future (config.auth.resetKey.expiresIn = '15m')
            expect(savedExpiresAt.getTime()).toBeGreaterThanOrEqual(beforeCall + 14 * 60 * 1000);
            expect(savedExpiresAt.getTime()).toBeLessThanOrEqual(beforeCall + 16 * 60 * 1000);
        });

        it('should publish PASSWORD_RESET_REQUESTED event when user is found', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            await service.requestPasswordReset('test@example.com');

            expect(mockProducer.publish).toHaveBeenCalledTimes(1);
            const payload = mockProducer.publish.mock.calls[0][0];
            expect(payload.topic).toBe('user-events');
            expect(payload.events).toHaveLength(1);
            expect(payload.events[0].type).toBe(DomainEvents.PASSWORD_RESET_REQUESTED);
        });

        it('should publish event with email and plain (unhashed) reset key in the data', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(createSampleUser());
            mockResetKeyRepo.save.mockResolvedValue(createSampleResetKey());

            await service.requestPasswordReset('test@example.com');

            const payload = mockProducer.publish.mock.calls[0][0];
            const eventData = payload.events[0].data as { email: string; resetKey: string };
            expect(eventData.email).toBe('test@example.com');
            // The plain key should be a base64url string (not the hash)
            expect(typeof eventData.resetKey).toBe('string');
            expect(eventData.resetKey.length).toBeGreaterThan(0);
            // Verify it's NOT the hash that was saved (plain key ≠ stored hash)
            const [savedHash] = mockResetKeyRepo.save.mock.calls[0];
            expect(eventData.resetKey).not.toBe(savedHash);
        });

        it('should NOT call passwordResetKeyRepository.save when user is not found', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(null);

            await service.requestPasswordReset('nonexistent@example.com');

            expect(mockResetKeyRepo.save).not.toHaveBeenCalled();
        });

        it('should NOT publish any event when user is not found', async () => {
            mockUserRepo.findByEmail.mockResolvedValue(null);

            await service.requestPasswordReset('nonexistent@example.com');

            expect(mockProducer.publish).not.toHaveBeenCalled();
        });
    });

    describe('validateResetKey', () => {
        it('should return true for a valid non-expired key', async () => {
            const plainKey = crypto.randomBytes(32).toString('base64url');
            const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            const storedKey = createSampleResetKey({
                keyHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(storedKey);

            const result = await service.validateResetKey(plainKey);

            expect(result).toBe(true);
        });

        it('should hash the incoming key with SHA-256 before looking up', async () => {
            const plainKey = 'test-plain-key';
            const expectedHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(null);

            await service.validateResetKey(plainKey);

            expect(mockResetKeyRepo.findByKeyHash).toHaveBeenCalledWith(expectedHash);
        });

        it('should return false when key hash is not found in DB', async () => {
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(null);

            const result = await service.validateResetKey('nonexistent-key');

            expect(result).toBe(false);
        });

        it('should return false when key is expired', async () => {
            const plainKey = 'expired-key';
            const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            const expiredKey = createSampleResetKey({
                keyHash,
                expiresAt: new Date(Date.now() - 1000), // 1 second in the past
            });
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(expiredKey);

            const result = await service.validateResetKey(plainKey);

            expect(result).toBe(false);
        });
    });

    describe('resetPassword', () => {
        const strongPassword = 'NewStrongP1';

        const setupValidReset = () => {
            const plainKey = crypto.randomBytes(32).toString('base64url');
            const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            const storedKey = createSampleResetKey({
                keyHash,
                userId: 'uuid-1',
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            });
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(storedKey);
            mockUserRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockUserRepo.updatePasswordHash.mockResolvedValue(true);
            return { plainKey, keyHash, storedKey };
        };

        it('should validate password strength before checking key (throws ValidationError for weak password)', async () => {
            const err = await catchError(
                service.resetPassword('some-key', 'weak'),
            );

            expect(err).toBeInstanceOf(ValidationError);
            const validationErr = err as unknown as ValidationError;
            expect(validationErr.errors).toHaveProperty('newPassword');
            // Should not have attempted to look up the key
            expect(mockResetKeyRepo.findByKeyHash).not.toHaveBeenCalled();
        });

        it('should throw ValidationError for password missing uppercase letter', async () => {
            const err = await catchError(
                service.resetPassword('some-key', 'lowercase1'),
            );

            expect(err).toBeInstanceOf(ValidationError);
        });

        it('should throw ValidationError for password missing lowercase letter', async () => {
            const err = await catchError(
                service.resetPassword('some-key', 'UPPERCASE1'),
            );

            expect(err).toBeInstanceOf(ValidationError);
        });

        it('should throw ValidationError for password missing number', async () => {
            const err = await catchError(
                service.resetPassword('some-key', 'NoNumbersHere'),
            );

            expect(err).toBeInstanceOf(ValidationError);
        });

        it('should throw InvalidResetKeyError when key hash is not found in DB', async () => {
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(null);

            await expect(
                service.resetPassword('nonexistent-key', strongPassword),
            ).rejects.toThrow(InvalidResetKeyError);
        });

        it('should throw InvalidResetKeyError when key is expired', async () => {
            const plainKey = 'expired-key';
            const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            const expiredKey = createSampleResetKey({
                keyHash,
                expiresAt: new Date(Date.now() - 1000),
            });
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(expiredKey);

            await expect(
                service.resetPassword(plainKey, strongPassword),
            ).rejects.toThrow(InvalidResetKeyError);
        });

        it('should throw InvalidResetKeyError when user no longer exists', async () => {
            const { plainKey } = setupValidReset();
            mockUserRepo.findById.mockResolvedValue(null);

            await expect(
                service.resetPassword(plainKey, strongPassword),
            ).rejects.toThrow(InvalidResetKeyError);
        });

        it('should hash the new password via passwordManager.toHash', async () => {
            const { plainKey } = setupValidReset();

            await service.resetPassword(plainKey, strongPassword);

            expect(mockPasswordManager.toHash).toHaveBeenCalledWith(strongPassword);
        });

        it('should call userRepository.updatePasswordHash with userId and new hash', async () => {
            const { plainKey } = setupValidReset();

            await service.resetPassword(plainKey, strongPassword);

            expect(mockUserRepo.updatePasswordHash).toHaveBeenCalledWith('uuid-1', 'new-hashed-pw');
        });

        it('should delete the used reset key via deleteByKeyHash', async () => {
            const { plainKey, keyHash } = setupValidReset();

            await service.resetPassword(plainKey, strongPassword);

            expect(mockResetKeyRepo.deleteByKeyHash).toHaveBeenCalledWith(keyHash);
        });

        it('should revoke all refresh tokens for the user', async () => {
            const { plainKey } = setupValidReset();

            await service.resetPassword(plainKey, strongPassword);

            expect(mockRefreshTokenRepo.deleteAllByUserId).toHaveBeenCalledWith('uuid-1');
        });

        it('should return void on success', async () => {
            const { plainKey } = setupValidReset();

            const result = await service.resetPassword(plainKey, strongPassword);

            expect(result).toBeUndefined();
        });

        it('should hash the incoming key with SHA-256 before looking up', async () => {
            const plainKey = 'my-reset-key';
            const expectedHash = crypto.createHash('sha256').update(plainKey).digest('hex');
            mockResetKeyRepo.findByKeyHash.mockResolvedValue(null);

            await catchError(service.resetPassword(plainKey, strongPassword));

            expect(mockResetKeyRepo.findByKeyHash).toHaveBeenCalledWith(expectedHash);
        });
    });
});
