import 'reflect-metadata';
import type { Request, Response } from 'express';

import { UserController } from '../../../src/controllers/user-controller';
import type {
    UserService,
    UserResponseDto,
} from '../../../src/services/user-service';
import {
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    ValidationError,
} from '../../../src/errors';
import { IncorrectPasswordError } from '../../../src/errors/incorrect-password-error';
import { InvalidRefreshTokenError } from '../../../src/errors/invalid-refresh-token-error';
import { TYPES } from '../../../src/lib/types';
import { validate } from '../../../src/middleware/validate-middleware';
import {
    RegisterRequestSchema,
    LoginRequestSchema,
    RefreshRequestSchema,
    UpdateProfileRequestSchema,
    ChangePasswordRequestSchema,
} from '../../../src/schemas/user-schemas';
import {
    createMockResponse,
    createMockRequest,
    createMockUserService,
} from '../../helpers/mock-express';

const sampleUser: UserResponseDto = {
    id: 'uuid-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
};

describe('UserController', () => {
    let mockService: jest.Mocked<UserService>;
    let controller: UserController;

    beforeEach(() => {
        mockService = createMockUserService();
        controller = new UserController(mockService);
    });

    describe('POST /register', () => {
        it('should return 201 with user data on successful registration', async () => {
            mockService.register.mockResolvedValue(sampleUser);
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(201);
            expect(res.body).toEqual(sampleUser);
        });

        it('should call userService.register with body fields', async () => {
            mockService.register.mockResolvedValue(sampleUser);
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(mockService.register).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
        });

        it('should pass req.body directly to service (middleware guarantees shape)', async () => {
            mockService.register.mockResolvedValue(sampleUser);
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(mockService.register).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
        });

        it('should return 409 when service throws EmailAlreadyExistsError', async () => {
            mockService.register.mockRejectedValue(
                new EmailAlreadyExistsError('test@example.com'),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(409);
            expect(res.body).toEqual({
                message: 'Email "test@example.com" is already registered',
            });
        });

        it('should return 422 when service throws ValidationError', async () => {
            mockService.register.mockRejectedValue(
                new ValidationError('Validation failed', {
                    password: [
                        'Must be at least 8 characters',
                        'Must contain uppercase',
                    ],
                    email: ['Invalid email format'],
                }),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'weak',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(422);
            expect(res.body).toEqual({
                message: 'Validation failed',
                errors: {
                    password: [
                        'Must be at least 8 characters',
                        'Must contain uppercase',
                    ],
                    email: ['Invalid email format'],
                },
            });
        });

        it('should include per-field errors in 422 response with field names as keys and string arrays as values', async () => {
            const fieldErrors = {
                firstName: ['Cannot be empty'],
                email: ['Invalid email format', 'Email domain not allowed'],
            };
            mockService.register.mockRejectedValue(
                new ValidationError('Validation failed', fieldErrors),
            );
            const req = createMockRequest({
                email: 'bad@blocked.com',
                password: 'StrongPass1!',
                firstName: '',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(422);
            expect(res.body).toHaveProperty('errors');
            const body = res.body as { errors: Record<string, string[]> };
            expect(typeof body.errors).toBe('object');
            expect(Array.isArray(body.errors)).toBe(false);
            for (const [field, messages] of Object.entries(body.errors)) {
                expect(typeof field).toBe('string');
                expect(Array.isArray(messages)).toBe(true);
                for (const msg of messages) {
                    expect(typeof msg).toBe('string');
                }
            }
            expect(body.errors).toEqual(fieldErrors);
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.register.mockRejectedValue(
                new Error('DB connection lost'),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('POST /login', () => {
        const authResponse = {
            accessToken: 'jwt-token-123',
            refreshToken: 'a'.repeat(64),
        };

        it('should return 200 with accessToken and refreshToken on successful authentication', async () => {
            mockService.authenticate.mockResolvedValue(authResponse);
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(authResponse);
        });

        it('should call userService.authenticate with email and password from body', async () => {
            mockService.authenticate.mockResolvedValue(authResponse);
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(mockService.authenticate).toHaveBeenCalledWith(
                'test@example.com',
                'StrongPass1!',
            );
        });

        it('should return 401 when service throws InvalidCredentialsError', async () => {
            mockService.authenticate.mockRejectedValue(
                new InvalidCredentialsError(),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'WrongPass!',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Invalid email or password' });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.authenticate.mockRejectedValue(
                new Error('Something broke'),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('GET /profile', () => {
        it('should return 200 with user data on success', async () => {
            mockService.getProfile.mockResolvedValue(sampleUser);
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.getProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(sampleUser);
        });

        it('should call userService.getProfile with the userId from req.user.id', async () => {
            mockService.getProfile.mockResolvedValue(sampleUser);
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.getProfile(req as Request, res as Response);

            expect(mockService.getProfile).toHaveBeenCalledWith('uuid-1');
        });

        it('should return 401 when service throws UserNotFoundError', async () => {
            mockService.getProfile.mockRejectedValue(
                new UserNotFoundError('uuid-1'),
            );
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.getProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.getProfile.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.getProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('PUT /profile', () => {
        it('should return 200 with updated user data on success', async () => {
            const updatedUser = { ...sampleUser, firstName: 'Jane' };
            mockService.updateProfile.mockResolvedValue(updatedUser);
            const req = createMockRequest(
                { firstName: 'Jane', lastName: 'Doe' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(updatedUser);
        });

        it('should call userService.updateProfile with userId and update data', async () => {
            mockService.updateProfile.mockResolvedValue(sampleUser);
            const req = createMockRequest(
                { firstName: 'Jane', lastName: 'Smith' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(mockService.updateProfile).toHaveBeenCalledWith('uuid-1', {
                firstName: 'Jane',
                lastName: 'Smith',
            });
        });

        it('should return 200 when only firstName is provided (partial update)', async () => {
            const updatedUser = { ...sampleUser, firstName: 'Jane' };
            mockService.updateProfile.mockResolvedValue(updatedUser);
            const req = createMockRequest(
                { firstName: 'Jane' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(mockService.updateProfile).toHaveBeenCalledWith('uuid-1', {
                firstName: 'Jane',
            });
        });

        it('should return 200 when only lastName is provided (partial update)', async () => {
            const updatedUser = { ...sampleUser, lastName: 'Smith' };
            mockService.updateProfile.mockResolvedValue(updatedUser);
            const req = createMockRequest(
                { lastName: 'Smith' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(mockService.updateProfile).toHaveBeenCalledWith('uuid-1', {
                lastName: 'Smith',
            });
        });

        it('should pass req.body directly to service (middleware guarantees at least one field)', async () => {
            const updatedUser = { ...sampleUser, firstName: 'Jane' };
            mockService.updateProfile.mockResolvedValue(updatedUser);
            const req = createMockRequest(
                { firstName: 'Jane' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(mockService.updateProfile).toHaveBeenCalledWith('uuid-1', {
                firstName: 'Jane',
            });
            expect(res.statusCode).toBe(200);
        });

        it('should return 401 when service throws UserNotFoundError', async () => {
            mockService.updateProfile.mockRejectedValue(
                new UserNotFoundError('uuid-1'),
            );
            const req = createMockRequest(
                { firstName: 'Jane' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.updateProfile.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest(
                { firstName: 'Jane' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('POST /refresh', () => {
        const refreshResponse = {
            accessToken: 'new-jwt-token',
            refreshToken: 'b'.repeat(64),
        };

        it('should return 200 with new accessToken and refreshToken on success', async () => {
            mockService.refreshAccessToken.mockResolvedValue(refreshResponse);
            const req = createMockRequest({ refreshToken: 'old-token-hex' });
            const res = createMockResponse();

            await controller.refresh(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual(refreshResponse);
        });

        it('should call userService.refreshAccessToken with refreshToken from body', async () => {
            mockService.refreshAccessToken.mockResolvedValue(refreshResponse);
            const req = createMockRequest({ refreshToken: 'old-token-hex' });
            const res = createMockResponse();

            await controller.refresh(req as Request, res as Response);

            expect(mockService.refreshAccessToken).toHaveBeenCalledWith(
                'old-token-hex',
            );
        });

        it('should return 401 when service throws InvalidRefreshTokenError', async () => {
            mockService.refreshAccessToken.mockRejectedValue(
                new InvalidRefreshTokenError(),
            );
            const req = createMockRequest({ refreshToken: 'bad-token' });
            const res = createMockResponse();

            await controller.refresh(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({
                message: 'Invalid or expired refresh token',
            });
        });

        it('should return 500 on unexpected error', async () => {
            mockService.refreshAccessToken.mockRejectedValue(
                new Error('DB error'),
            );
            const req = createMockRequest({ refreshToken: 'some-token' });
            const res = createMockResponse();

            await controller.refresh(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });

        it('should not require auth middleware (no Bearer token needed)', async () => {
            mockService.refreshAccessToken.mockResolvedValue(refreshResponse);
            // Request has no user property — simulates unauthenticated request
            const req = createMockRequest({ refreshToken: 'old-token-hex' });
            const res = createMockResponse();

            await controller.refresh(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
        });
    });

    describe('POST /logout', () => {
        it('should return 204 on success with no body', async () => {
            mockService.logout.mockResolvedValue(undefined);
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.logout(req as Request, res as Response);

            expect(res.statusCode).toBe(204);
            // 204 should not have a JSON body
            expect(res.body).toBeUndefined();
        });

        it('should call userService.logout with authenticated user ID', async () => {
            mockService.logout.mockResolvedValue(undefined);
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.logout(req as Request, res as Response);

            expect(mockService.logout).toHaveBeenCalledWith('uuid-1');
        });

        it('should require auth middleware (uses req.user.id)', async () => {
            mockService.logout.mockResolvedValue(undefined);
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.logout(req as Request, res as Response);

            // Verifies the endpoint reads from req.user.id (set by auth middleware)
            expect(mockService.logout).toHaveBeenCalledWith('uuid-1');
        });

        it('should return 500 on unexpected error', async () => {
            mockService.logout.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.logout(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('PUT /password', () => {
        it('should return 204 with no body on successful password change', async () => {
            mockService.changePassword.mockResolvedValue(undefined);
            const req = createMockRequest(
                { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss2' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(res.statusCode).toBe(204);
            expect(res.body).toBeUndefined();
        });

        it('should call userService.changePassword with userId and body fields', async () => {
            mockService.changePassword.mockResolvedValue(undefined);
            const req = createMockRequest(
                { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss2' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(mockService.changePassword).toHaveBeenCalledWith('uuid-1', {
                currentPassword: 'OldP@ss1',
                newPassword: 'NewP@ss2',
            });
        });

        it('should return 401 when service throws UserNotFoundError', async () => {
            mockService.changePassword.mockRejectedValue(
                new UserNotFoundError('uuid-1'),
            );
            const req = createMockRequest(
                { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss2' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
        });

        it('should return 401 when service throws IncorrectPasswordError', async () => {
            mockService.changePassword.mockRejectedValue(
                new IncorrectPasswordError(),
            );
            const req = createMockRequest(
                { currentPassword: 'WrongP@ss1', newPassword: 'NewP@ss2' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({
                message: 'Current password is incorrect',
            });
        });

        it('should return 422 when service throws ValidationError (business rules)', async () => {
            mockService.changePassword.mockRejectedValue(
                new ValidationError('Validation failed', {
                    newPassword: [
                        'Password must be at least 8 characters long',
                    ],
                }),
            );
            const req = createMockRequest(
                { currentPassword: 'OldP@ss1', newPassword: 'short' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(res.statusCode).toBe(422);
            expect(res.body).toEqual({
                message: 'Validation failed',
                errors: {
                    newPassword: [
                        'Password must be at least 8 characters long',
                    ],
                },
            });
        });

        it('should return 500 on unexpected error', async () => {
            mockService.changePassword.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest(
                { currentPassword: 'OldP@ss1', newPassword: 'NewP@ss2' },
                { id: 'uuid-1' },
            );
            const res = createMockResponse();

            await controller.changePassword(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('middleware decorator wiring', () => {
        type MethodMetadata = {
            key: string;
            method: string;
            path: string;
            middleware: (symbol | ((...args: unknown[]) => unknown))[];
        };

        const getMethodMetadata = (): MethodMetadata[] =>
            Reflect.getMetadata(
                'inversify-express-utils:controller-method',
                UserController,
            ) ?? [];

        it('should have TYPES.LoginRateLimiter applied to login endpoint', () => {
            const metadata = getMethodMetadata();
            const loginMeta = metadata.find(m => m.key === 'login');

            expect(loginMeta).toBeDefined();
            expect(loginMeta!.middleware).toContain(TYPES.LoginRateLimiter);
        });

        it('should have TYPES.RefreshRateLimiter applied to refresh endpoint', () => {
            const metadata = getMethodMetadata();
            const refreshMeta = metadata.find(m => m.key === 'refresh');

            expect(refreshMeta).toBeDefined();
            expect(refreshMeta!.middleware).toContain(TYPES.RefreshRateLimiter);
        });

        it('should NOT have rate limiter on register endpoint', () => {
            const metadata = getMethodMetadata();
            const registerMeta = metadata.find(m => m.key === 'register');

            expect(registerMeta).toBeDefined();
            expect(registerMeta!.middleware).not.toContain(
                TYPES.LoginRateLimiter,
            );
            expect(registerMeta!.middleware).not.toContain(
                TYPES.RefreshRateLimiter,
            );
        });

        it('should have TYPES.AuthMiddleware and TYPES.JsonContentType on changePassword', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'changePassword');

            expect(meta).toBeDefined();
            expect(meta!.middleware).toContain(TYPES.AuthMiddleware);
            expect(meta!.middleware).toContain(TYPES.JsonContentType);
        });

        it('should have TYPES.JsonContentType on register, login, refresh, and changePassword', () => {
            const metadata = getMethodMetadata();

            for (const key of [
                'register',
                'login',
                'refresh',
                'changePassword',
            ]) {
                const meta = metadata.find(m => m.key === key);
                expect(meta).toBeDefined();
                expect(meta!.middleware).toContain(TYPES.JsonContentType);
            }
        });

        it('should NOT have TYPES.JsonContentType on logout or getProfile', () => {
            const metadata = getMethodMetadata();

            for (const key of ['logout', 'getProfile']) {
                const meta = metadata.find(m => m.key === key);
                expect(meta).toBeDefined();
                expect(meta!.middleware).not.toContain(TYPES.JsonContentType);
            }
        });

        it('should have validate(RegisterRequestSchema) on register endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'register');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(RegisterRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                mw =>
                    typeof mw === 'function' &&
                    mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(LoginRequestSchema) on login endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'login');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(LoginRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                mw =>
                    typeof mw === 'function' &&
                    mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(RefreshRequestSchema) on refresh endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'refresh');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(RefreshRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                mw =>
                    typeof mw === 'function' &&
                    mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(UpdateProfileRequestSchema) on updateProfile endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'updateProfile');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(UpdateProfileRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                mw =>
                    typeof mw === 'function' &&
                    mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(ChangePasswordRequestSchema) on changePassword endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'changePassword');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(ChangePasswordRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                mw =>
                    typeof mw === 'function' &&
                    mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should NOT have validate middleware on logout endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find(m => m.key === 'logout');
            expect(meta).toBeDefined();

            // Logout has no body validation — only auth middleware
            const functionMiddleware = meta!.middleware.filter(
                mw => typeof mw === 'function',
            );
            expect(functionMiddleware.length).toBe(0);
        });
    });

    describe('Error response format', () => {
        it('should include a message field in all error responses', async () => {
            // Test with 422 (validation error from service)
            mockService.register.mockRejectedValue(
                new ValidationError('Validation failed', {
                    email: ['Email is required'],
                }),
            );
            const req422 = createMockRequest({});
            const res422 = createMockResponse();
            await controller.register(req422 as Request, res422 as Response);
            expect(res422.body).toHaveProperty('message');

            // Test with 409 (domain error)
            mockService.register.mockRejectedValue(
                new EmailAlreadyExistsError('a@b.com'),
            );
            const req409 = createMockRequest({
                email: 'a@b.com',
                password: 'Pass1!',
                firstName: 'A',
                lastName: 'B',
            });
            const res409 = createMockResponse();
            await controller.register(req409 as Request, res409 as Response);
            expect(res409.body).toHaveProperty('message');

            // Test with 500 (unexpected error)
            mockService.register.mockRejectedValue(new Error('boom'));
            const req500 = createMockRequest({
                email: 'a@b.com',
                password: 'Pass1!',
                firstName: 'A',
                lastName: 'B',
            });
            const res500 = createMockResponse();
            await controller.register(req500 as Request, res500 as Response);
            expect(res500.body).toHaveProperty('message');
        });

        it('should pass through domain error messages from the error class', async () => {
            mockService.authenticate.mockRejectedValue(
                new InvalidCredentialsError(),
            );
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'wrong',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.body).toEqual({ message: 'Invalid email or password' });

            mockService.getProfile.mockRejectedValue(
                new UserNotFoundError('uuid-99'),
            );
            const req2 = createMockRequest(undefined, { id: 'uuid-99' });
            const res2 = createMockResponse();

            await controller.getProfile(req2 as Request, res2 as Response);

            expect(res2.statusCode).toBe(401);
            expect(res2.body).toEqual({ message: 'Unauthorized' });
        });
    });
});
