import 'reflect-metadata';
import jwt from 'jsonwebtoken';

import type { UserRepository } from '../../../src/repositories/user-repository';
import type { RefreshTokenRepository } from '../../../src/repositories/refresh-token-repository';
import type { PasswordManagerService } from '../../../src/services/password-manager-service';
import type { AppConfig } from '../../../src/config/schema';
import type { AppSecrets } from '../../../src/config/secrets-schema';
import type { UserResponseDto } from '../../../src/services/user-service';
import { UserServiceImpl } from '../../../src/services/user-service';
import { User } from '../../../src/entities/user';
import {
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    ValidationError,
} from '../../../src/errors';
import { IncorrectPasswordError } from '../../../src/errors/incorrect-password-error';
import { InvalidRefreshTokenError } from '../../../src/errors/invalid-refresh-token-error';
import { RefreshToken } from '../../../src/entities/refresh-token';

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
}));

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

const mockConfig: AppConfig = {
    server: { port: 9000 },
    database: { host: 'localhost', port: 5432, name: 'test' },
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

const sampleUserResponse: UserResponseDto = {
    id: 'uuid-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

/** Catches a rejected promise and returns the error for assertion. */
const catchError = async <T>(promise: Promise<T>): Promise<ValidationError> => {
    let caught: unknown;
    try {
        await promise;
    } catch (err) {
        caught = err;
    }
    return caught as ValidationError;
};

describe('UserServiceImpl', () => {
    let mockRepo: jest.Mocked<UserRepository>;
    let mockPasswordManager: jest.Mocked<PasswordManagerService>;
    let mockRefreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
    let service: UserServiceImpl;

    beforeEach(() => {
        mockRepo = createMockUserRepository();
        mockPasswordManager = createMockPasswordManager();
        mockRefreshTokenRepo = createMockRefreshTokenRepository();
        service = new UserServiceImpl(mockRepo, mockPasswordManager, mockConfig, mockSecrets, mockRefreshTokenRepo);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        const validRegisterData = {
            email: 'test@example.com',
            password: 'StrongPass1',
            firstName: 'John',
            lastName: 'Doe',
        };

        it('should return UserResponseDto without passwordHash on successful registration', async () => {
            const createdUser = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(null);
            mockPasswordManager.toHash.mockResolvedValue('hashed-password');
            mockRepo.create.mockResolvedValue(createdUser);

            const result = await service.register(validRegisterData);

            expect(result).toEqual(sampleUserResponse);
            expect(result).not.toHaveProperty('passwordHash');
        });

        it('should call passwordManager.toHash with the raw password', async () => {
            mockRepo.findByEmail.mockResolvedValue(null);
            mockPasswordManager.toHash.mockResolvedValue('hashed-password');
            mockRepo.create.mockResolvedValue(createSampleUser());

            await service.register(validRegisterData);

            expect(mockPasswordManager.toHash).toHaveBeenCalledWith('StrongPass1');
        });

        it('should call userRepository.create with the hashed password, not raw', async () => {
            mockRepo.findByEmail.mockResolvedValue(null);
            mockPasswordManager.toHash.mockResolvedValue('the-hashed-pw');
            mockRepo.create.mockResolvedValue(createSampleUser());

            await service.register(validRegisterData);

            expect(mockRepo.create).toHaveBeenCalledWith({
                email: 'test@example.com',
                passwordHash: 'the-hashed-pw',
                firstName: 'John',
                lastName: 'Doe',
            });
        });

        it('should throw ValidationError for invalid email format', async () => {
            const data = { ...validRegisterData, email: 'not-an-email' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('email');
            expect(err.errors.email).toContain('Invalid email format');
        });

        it('should throw ValidationError for password shorter than 8 characters', async () => {
            const data = { ...validRegisterData, password: 'Ab1' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('password');
            expect(err.errors.password).toContain(
                'Password must be at least 8 characters long',
            );
        });

        it('should throw ValidationError for password missing uppercase letter', async () => {
            const data = { ...validRegisterData, password: 'lowercase1' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('password');
            expect(err.errors.password).toContain(
                'Password must contain at least one uppercase letter',
            );
        });

        it('should throw ValidationError for password missing lowercase letter', async () => {
            const data = { ...validRegisterData, password: 'UPPERCASE1' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('password');
            expect(err.errors.password).toContain(
                'Password must contain at least one lowercase letter',
            );
        });

        it('should throw ValidationError for password missing number', async () => {
            const data = { ...validRegisterData, password: 'NoNumbersHere' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('password');
            expect(err.errors.password).toContain(
                'Password must contain at least one number',
            );
        });

        it('should collect multiple validation errors across fields into a single ValidationError', async () => {
            const data = {
                email: 'bad-email',
                password: 'short',
                firstName: '',
                lastName: '   ',
            };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('email');
            expect(err.errors).toHaveProperty('password');
            expect(err.errors).toHaveProperty('firstName');
            expect(err.errors).toHaveProperty('lastName');
        });

        it('should throw EmailAlreadyExistsError when email is already registered', async () => {
            mockRepo.findByEmail.mockResolvedValue(createSampleUser());

            await expect(service.register(validRegisterData)).rejects.toThrow(
                EmailAlreadyExistsError,
            );
        });

        it('should not call passwordManager or create when validation fails', async () => {
            const data = { ...validRegisterData, email: 'bad' };

            await expect(service.register(data)).rejects.toThrow(ValidationError);

            expect(mockPasswordManager.toHash).not.toHaveBeenCalled();
            expect(mockRepo.create).not.toHaveBeenCalled();
        });

        it('should not call create when email already exists', async () => {
            mockRepo.findByEmail.mockResolvedValue(createSampleUser());

            await expect(service.register(validRegisterData)).rejects.toThrow(
                EmailAlreadyExistsError,
            );

            expect(mockRepo.create).not.toHaveBeenCalled();
        });

        it('should collect multiple password errors in a single array', async () => {
            const data = { ...validRegisterData, password: '!!!' };

            const err = await catchError(service.register(data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors.password.length).toBeGreaterThanOrEqual(3);
            expect(err.errors.password).toContain(
                'Password must be at least 8 characters long',
            );
            expect(err.errors.password).toContain(
                'Password must contain at least one uppercase letter',
            );
            expect(err.errors.password).toContain(
                'Password must contain at least one lowercase letter',
            );
            expect(err.errors.password).toContain(
                'Password must contain at least one number',
            );
        });
    });

    describe('authenticate', () => {
        it('should return AuthResponseDto with accessToken and refreshToken on successful authentication', async () => {
            const user = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);

            const result = await service.authenticate('test@example.com', 'StrongPass1');

            expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
            expect(result).toHaveProperty('refreshToken');
            expect(typeof result.refreshToken).toBe('string');
        });

        it('should return refreshToken as a 64-character hex string (32 bytes)', async () => {
            const user = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);

            const result = await service.authenticate('test@example.com', 'StrongPass1');

            expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should call refreshTokenRepository.save with hashed token, userId, and future expiresAt', async () => {
            const user = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);

            const beforeCall = new Date();
            await service.authenticate('test@example.com', 'StrongPass1');

            expect(mockRefreshTokenRepo.save).toHaveBeenCalledTimes(1);
            const [tokenHash, userId, expiresAt] = mockRefreshTokenRepo.save.mock.calls[0];

            // tokenHash should be a non-empty string (hashed, not the raw token)
            expect(typeof tokenHash).toBe('string');
            expect(tokenHash.length).toBeGreaterThan(0);

            // userId should match the authenticated user
            expect(userId).toBe('uuid-1');

            // expiresAt should be in the future
            expect(expiresAt).toBeInstanceOf(Date);
            expect(expiresAt.getTime()).toBeGreaterThan(beforeCall.getTime());
        });

        it('should throw InvalidCredentialsError when email is not found', async () => {
            mockRepo.findByEmail.mockResolvedValue(null);

            await expect(
                service.authenticate('nonexistent@example.com', 'SomePass1'),
            ).rejects.toThrow(InvalidCredentialsError);
        });

        it('should throw InvalidCredentialsError when password does not match', async () => {
            const user = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(false);

            await expect(
                service.authenticate('test@example.com', 'WrongPass1'),
            ).rejects.toThrow(InvalidCredentialsError);
        });

        it('should call jwt.sign with correct payload, secret, and expiresIn', async () => {
            const user = createSampleUser();
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);

            await service.authenticate('test@example.com', 'StrongPass1');

            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: 'uuid-1' },
                'test-jwt-secret',
                { expiresIn: '15m' },
            );
        });

        it('should call passwordManager.compare with stored hash and supplied password', async () => {
            const user = createSampleUser({ passwordHash: 'stored-hash' });
            mockRepo.findByEmail.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);

            await service.authenticate('test@example.com', 'supplied-pw');

            expect(mockPasswordManager.compare).toHaveBeenCalledWith(
                'stored-hash',
                'supplied-pw',
            );
        });

    });

    describe('refreshAccessToken', () => {
        const rawToken = 'a'.repeat(64); // 32-byte hex token

        const createStoredRefreshToken = (overrides?: Partial<RefreshToken>): RefreshToken => {
            const token = new RefreshToken();
            token.id = 'rt-uuid-1';
            token.tokenHash = 'stored-hash';
            token.userId = 'uuid-1';
            token.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
            token.createdAt = new Date('2024-01-01');
            Object.assign(token, overrides);
            return token;
        };

        it('should return new accessToken and refreshToken when given a valid refresh token', async () => {
            const storedToken = createStoredRefreshToken();
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(storedToken);
            mockRepo.findById.mockResolvedValue(createSampleUser());

            const result = await service.refreshAccessToken(rawToken);

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('refreshToken');
            expect(typeof result.accessToken).toBe('string');
            expect(typeof result.refreshToken).toBe('string');
        });

        it('should throw InvalidRefreshTokenError when token hash is not found in DB', async () => {
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(null);

            await expect(
                service.refreshAccessToken(rawToken),
            ).rejects.toThrow(InvalidRefreshTokenError);
        });

        it('should throw InvalidRefreshTokenError when token is expired', async () => {
            const expiredToken = createStoredRefreshToken({
                expiresAt: new Date(Date.now() - 1000), // 1 second in the past
            });
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(expiredToken);

            await expect(
                service.refreshAccessToken(rawToken),
            ).rejects.toThrow(InvalidRefreshTokenError);
        });

        it('should throw InvalidRefreshTokenError when user no longer exists', async () => {
            const storedToken = createStoredRefreshToken();
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(storedToken);
            mockRepo.findById.mockResolvedValue(null);

            await expect(
                service.refreshAccessToken(rawToken),
            ).rejects.toThrow(InvalidRefreshTokenError);
        });

        it('should perform token rotation: delete old hash and save new hash', async () => {
            const storedToken = createStoredRefreshToken();
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(storedToken);
            mockRepo.findById.mockResolvedValue(createSampleUser());

            await service.refreshAccessToken(rawToken);

            // Old token should be deleted
            expect(mockRefreshTokenRepo.deleteByTokenHash).toHaveBeenCalledWith(storedToken.tokenHash);

            // New token should be saved
            expect(mockRefreshTokenRepo.save).toHaveBeenCalledTimes(1);
            const [newHash] = mockRefreshTokenRepo.save.mock.calls[0];

            // New hash should differ from old hash
            expect(newHash).not.toBe(storedToken.tokenHash);
        });

        it('should sign a new access token with jwt.sign for the correct userId', async () => {
            const storedToken = createStoredRefreshToken();
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(storedToken);
            mockRepo.findById.mockResolvedValue(createSampleUser());

            await service.refreshAccessToken(rawToken);

            expect(jwt.sign).toHaveBeenCalledWith(
                { userId: 'uuid-1' },
                'test-jwt-secret',
                { expiresIn: '15m' },
            );
        });

        it('should return refreshToken as a 64-character hex string', async () => {
            const storedToken = createStoredRefreshToken();
            mockRefreshTokenRepo.findByTokenHash.mockResolvedValue(storedToken);
            mockRepo.findById.mockResolvedValue(createSampleUser());

            const result = await service.refreshAccessToken(rawToken);

            expect(result.refreshToken).toMatch(/^[0-9a-f]{64}$/);
        });

    });

    describe('getProfile', () => {
        it('should return UserResponseDto for an existing user', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());

            const result = await service.getProfile('uuid-1');

            expect(result).toEqual(sampleUserResponse);
        });

        it('should throw UserNotFoundError when user does not exist', async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(service.getProfile('nonexistent-id')).rejects.toThrow(
                UserNotFoundError,
            );
        });

        it('should not include passwordHash field in the response', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());

            const result = await service.getProfile('uuid-1');

            expect(result).not.toHaveProperty('passwordHash');
        });

        it('should call userRepository.findById with the correct userId', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());

            await service.getProfile('uuid-1');

            expect(mockRepo.findById).toHaveBeenCalledWith('uuid-1');
        });
    });

    describe('updateProfile', () => {
        it('should return updated UserResponseDto on success', async () => {
            const updatedUser = createSampleUser({ firstName: 'Jane' });
            mockRepo.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile('uuid-1', {
                firstName: 'Jane',
            });

            expect(result).toEqual({
                ...sampleUserResponse,
                firstName: 'Jane',
            });
        });

        it('should throw UserNotFoundError when user does not exist', async () => {
            mockRepo.update.mockResolvedValue(null);

            await expect(
                service.updateProfile('nonexistent-id', { firstName: 'Jane' }),
            ).rejects.toThrow(UserNotFoundError);
        });

        it('should pass only provided fields to the repository', async () => {
            const updatedUser = createSampleUser({ firstName: 'Jane' });
            mockRepo.update.mockResolvedValue(updatedUser);

            await service.updateProfile('uuid-1', { firstName: 'Jane' });

            expect(mockRepo.update).toHaveBeenCalledWith('uuid-1', {
                firstName: 'Jane',
            });
        });

        it('should not include lastName when only firstName is provided', async () => {
            const updatedUser = createSampleUser({ firstName: 'Jane' });
            mockRepo.update.mockResolvedValue(updatedUser);

            await service.updateProfile('uuid-1', { firstName: 'Jane' });

            const callArgs = mockRepo.update.mock.calls[0][1];
            expect(callArgs).not.toHaveProperty('lastName');
        });

        it('should not include passwordHash in the response', async () => {
            const updatedUser = createSampleUser({ firstName: 'Jane' });
            mockRepo.update.mockResolvedValue(updatedUser);

            const result = await service.updateProfile('uuid-1', {
                firstName: 'Jane',
            });

            expect(result).not.toHaveProperty('passwordHash');
        });

    });

    describe('changePassword', () => {
        const validChangePasswordData = {
            currentPassword: 'OldP@ss1',
            newPassword: 'NewP@ss2',
        };

        it('should throw ValidationError when newPassword is too short', async () => {
            const data = { currentPassword: 'OldP@ss1', newPassword: 'Ab1' };

            const err = await catchError(service.changePassword('uuid-1', data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('newPassword');
            expect(err.errors.newPassword).toContain(
                'Password must be at least 8 characters long',
            );
        });

        it('should throw ValidationError when newPassword has no uppercase letter', async () => {
            const data = { currentPassword: 'OldP@ss1', newPassword: 'lowercase1' };

            const err = await catchError(service.changePassword('uuid-1', data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('newPassword');
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one uppercase letter',
            );
        });

        it('should throw ValidationError when newPassword has no lowercase letter', async () => {
            const data = { currentPassword: 'OldP@ss1', newPassword: 'UPPERCASE1' };

            const err = await catchError(service.changePassword('uuid-1', data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('newPassword');
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one lowercase letter',
            );
        });

        it('should throw ValidationError when newPassword has no digit', async () => {
            const data = { currentPassword: 'OldP@ss1', newPassword: 'NoDigitsHere' };

            const err = await catchError(service.changePassword('uuid-1', data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors).toHaveProperty('newPassword');
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one number',
            );
        });

        it('should collect multiple password strength errors in a single array', async () => {
            const data = { currentPassword: 'OldP@ss1', newPassword: '!!!' };

            const err = await catchError(service.changePassword('uuid-1', data));

            expect(err).toBeInstanceOf(ValidationError);
            expect(err.errors.newPassword.length).toBeGreaterThanOrEqual(3);
            expect(err.errors.newPassword).toContain(
                'Password must be at least 8 characters long',
            );
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one uppercase letter',
            );
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one lowercase letter',
            );
            expect(err.errors.newPassword).toContain(
                'Password must contain at least one number',
            );
        });

        it('should throw UserNotFoundError when user does not exist', async () => {
            mockRepo.findById.mockResolvedValue(null);

            await expect(
                service.changePassword('nonexistent-id', validChangePasswordData),
            ).rejects.toThrow(UserNotFoundError);
        });

        it('should throw IncorrectPasswordError when current password does not match', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(false);

            await expect(
                service.changePassword('uuid-1', validChangePasswordData),
            ).rejects.toThrow(IncorrectPasswordError);
        });

        it('should call passwordManager.compare with stored hash and currentPassword', async () => {
            const user = createSampleUser({ passwordHash: 'stored-hash' });
            mockRepo.findById.mockResolvedValue(user);
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(true);

            await service.changePassword('uuid-1', validChangePasswordData);

            expect(mockPasswordManager.compare).toHaveBeenCalledWith(
                'stored-hash',
                'OldP@ss1',
            );
        });

        it('should call passwordManager.toHash with the new password', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(true);

            await service.changePassword('uuid-1', validChangePasswordData);

            expect(mockPasswordManager.toHash).toHaveBeenCalledWith('NewP@ss2');
        });

        it('should call userRepository.updatePasswordHash with userId and new hash', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(true);

            await service.changePassword('uuid-1', validChangePasswordData);

            expect(mockRepo.updatePasswordHash).toHaveBeenCalledWith('uuid-1', 'new-hashed-pw');
        });

        it('should call refreshTokenRepository.deleteAllByUserId to revoke all tokens', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(true);

            await service.changePassword('uuid-1', validChangePasswordData);

            expect(mockRefreshTokenRepo.deleteAllByUserId).toHaveBeenCalledWith('uuid-1');
        });

        it('should return void on success', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(true);

            const result = await service.changePassword('uuid-1', validChangePasswordData);

            expect(result).toBeUndefined();
        });

        it('should throw UserNotFoundError when updatePasswordHash returns false', async () => {
            mockRepo.findById.mockResolvedValue(createSampleUser());
            mockPasswordManager.compare.mockResolvedValue(true);
            mockPasswordManager.toHash.mockResolvedValue('new-hashed-pw');
            mockRepo.updatePasswordHash.mockResolvedValue(false);

            await expect(
                service.changePassword('uuid-1', validChangePasswordData),
            ).rejects.toThrow(UserNotFoundError);
        });

    });

    describe('logout', () => {
        it('should call refreshTokenRepository.deleteAllByUserId with the given userId', async () => {
            await service.logout('uuid-1');

            expect(mockRefreshTokenRepo.deleteAllByUserId).toHaveBeenCalledWith('uuid-1');
        });

        it('should not throw', async () => {
            await expect(service.logout('uuid-1')).resolves.toBeUndefined();
        });

        it('should not throw even if no tokens exist for the user', async () => {
            mockRefreshTokenRepo.deleteAllByUserId.mockResolvedValue(undefined);

            await expect(service.logout('uuid-1')).resolves.toBeUndefined();
        });
    });
});
