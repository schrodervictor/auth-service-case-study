import 'reflect-metadata';
import type { Request, Response } from 'express';

import { UserController } from '../../../src/controllers/user-controller';
import type { UserService } from '../../../src/services/user-service';
import { ValidationError } from '../../../src/errors';
import { InvalidResetKeyError } from '../../../src/errors/invalid-reset-key-error';
import { TYPES } from '../../../src/lib/types';
import { validate } from '../../../src/middleware/validate-middleware';
import {
    ResetKeyRequestSchema,
    ValidateResetKeyRequestSchema,
    ResetPasswordRequestSchema,
} from '../../../src/schemas/user-schemas';

const createMockUserService = (): jest.Mocked<UserService> => ({
    register: jest.fn(),
    authenticate: jest.fn(),
    refreshAccessToken: jest.fn(),
    logout: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    requestPasswordReset: jest.fn(),
    validateResetKey: jest.fn(),
    resetPassword: jest.fn(),
});

const createMockRequest = (
    body?: Record<string, unknown>,
    user?: { id: string },
): Partial<Request> => ({
    body,
    ...(user ? { user } : {}),
});

const createMockResponse = (): Partial<Response> & {
    statusCode?: number;
    body?: unknown;
} => {
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
    res.status = jest.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn().mockImplementation((data: unknown) => {
        res.body = data;
        return res;
    });
    res.send = jest.fn().mockImplementation(() => res);
    res.end = jest.fn().mockImplementation(() => res);
    return res;
};

describe('UserController — Password Reset', () => {
    let mockService: jest.Mocked<UserService>;
    let controller: UserController;

    beforeEach(() => {
        mockService = createMockUserService();
        controller = new UserController(mockService);
    });

    describe('POST /reset-key', () => {
        it('should return 200 with generic message when user exists', async () => {
            mockService.requestPasswordReset.mockResolvedValue(undefined);
            const req = createMockRequest({ email: 'test@example.com' });
            const res = createMockResponse();

            await controller.requestResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                message: 'If an account with that email exists, a reset key has been generated.',
            });
        });

        it('should return 200 with the same generic message when user does not exist', async () => {
            mockService.requestPasswordReset.mockResolvedValue(undefined);
            const req = createMockRequest({ email: 'nonexistent@example.com' });
            const res = createMockResponse();

            await controller.requestResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                message: 'If an account with that email exists, a reset key has been generated.',
            });
        });

        it('should call userService.requestPasswordReset with email from body', async () => {
            mockService.requestPasswordReset.mockResolvedValue(undefined);
            const req = createMockRequest({ email: 'test@example.com' });
            const res = createMockResponse();

            await controller.requestResetKey(req as Request, res as Response);

            expect(mockService.requestPasswordReset).toHaveBeenCalledWith('test@example.com');
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.requestPasswordReset.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest({ email: 'test@example.com' });
            const res = createMockResponse();

            await controller.requestResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('POST /validate-reset-key', () => {
        it('should return 200 with { valid: true } when key is valid', async () => {
            mockService.validateResetKey.mockResolvedValue(true);
            const req = createMockRequest({ resetKey: 'valid-key' });
            const res = createMockResponse();

            await controller.validateResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ valid: true });
        });

        it('should return 200 with { valid: false } when key is invalid', async () => {
            mockService.validateResetKey.mockResolvedValue(false);
            const req = createMockRequest({ resetKey: 'invalid-key' });
            const res = createMockResponse();

            await controller.validateResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ valid: false });
        });

        it('should call userService.validateResetKey with resetKey from body', async () => {
            mockService.validateResetKey.mockResolvedValue(false);
            const req = createMockRequest({ resetKey: 'my-reset-key' });
            const res = createMockResponse();

            await controller.validateResetKey(req as Request, res as Response);

            expect(mockService.validateResetKey).toHaveBeenCalledWith('my-reset-key');
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.validateResetKey.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest({ resetKey: 'some-key' });
            const res = createMockResponse();

            await controller.validateResetKey(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('POST /password/reset', () => {
        it('should return 200 with success message on successful password reset', async () => {
            mockService.resetPassword.mockResolvedValue(undefined);
            const req = createMockRequest({ resetKey: 'valid-key', newPassword: 'NewStrong1' });
            const res = createMockResponse();

            await controller.resetPassword(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                message: 'Password has been reset successfully.',
            });
        });

        it('should call userService.resetPassword with resetKey and newPassword from body', async () => {
            mockService.resetPassword.mockResolvedValue(undefined);
            const req = createMockRequest({ resetKey: 'my-key', newPassword: 'NewStrong1' });
            const res = createMockResponse();

            await controller.resetPassword(req as Request, res as Response);

            expect(mockService.resetPassword).toHaveBeenCalledWith('my-key', 'NewStrong1');
        });

        it('should return 400 when service throws InvalidResetKeyError', async () => {
            mockService.resetPassword.mockRejectedValue(new InvalidResetKeyError());
            const req = createMockRequest({ resetKey: 'bad-key', newPassword: 'NewStrong1' });
            const res = createMockResponse();

            await controller.resetPassword(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Invalid or expired reset key' });
        });

        it('should return 422 when service throws ValidationError (weak password)', async () => {
            mockService.resetPassword.mockRejectedValue(
                new ValidationError('Validation failed', {
                    newPassword: ['Password must be at least 8 characters long'],
                }),
            );
            const req = createMockRequest({ resetKey: 'valid-key', newPassword: 'weak' });
            const res = createMockResponse();

            await controller.resetPassword(req as Request, res as Response);

            expect(res.statusCode).toBe(422);
            expect(res.body).toEqual({
                message: 'Validation failed',
                errors: {
                    newPassword: ['Password must be at least 8 characters long'],
                },
            });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.resetPassword.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest({ resetKey: 'valid-key', newPassword: 'NewStrong1' });
            const res = createMockResponse();

            await controller.resetPassword(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('middleware decorator wiring — password reset routes', () => {
        type MethodMetadata = {
            key: string;
            method: string;
            path: string;
            middleware: (symbol | ((...args: unknown[]) => unknown))[];
        };

        const getMethodMetadata = (): MethodMetadata[] =>
            Reflect.getMetadata('inversify-express-utils:controller-method', UserController) ?? [];

        it('should have TYPES.ResetKeyRateLimiter applied to requestResetKey endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'requestResetKey');

            expect(meta).toBeDefined();
            expect(meta!.middleware).toContain(TYPES.ResetKeyRateLimiter);
        });

        it('should have TYPES.ValidateResetKeyRateLimiter applied to validateResetKey endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'validateResetKey');

            expect(meta).toBeDefined();
            expect(meta!.middleware).toContain(TYPES.ValidateResetKeyRateLimiter);
        });

        it('should have TYPES.ResetPasswordRateLimiter applied to resetPassword endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'resetPassword');

            expect(meta).toBeDefined();
            expect(meta!.middleware).toContain(TYPES.ResetPasswordRateLimiter);
        });

        it('should have TYPES.JsonContentType on all three password-reset endpoints', () => {
            const metadata = getMethodMetadata();

            for (const key of ['requestResetKey', 'validateResetKey', 'resetPassword']) {
                const meta = metadata.find((m) => m.key === key);
                expect(meta).toBeDefined();
                expect(meta!.middleware).toContain(TYPES.JsonContentType);
            }
        });

        it('should NOT have TYPES.AuthMiddleware on any password-reset endpoint', () => {
            const metadata = getMethodMetadata();

            for (const key of ['requestResetKey', 'validateResetKey', 'resetPassword']) {
                const meta = metadata.find((m) => m.key === key);
                expect(meta).toBeDefined();
                expect(meta!.middleware).not.toContain(TYPES.AuthMiddleware);
            }
        });

        it('should have validate(ResetKeyRequestSchema) on requestResetKey endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'requestResetKey');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(ResetKeyRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                (mw) => typeof mw === 'function' && mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(ValidateResetKeyRequestSchema) on validateResetKey endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'validateResetKey');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(ValidateResetKeyRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                (mw) => typeof mw === 'function' && mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should have validate(ResetPasswordRequestSchema) on resetPassword endpoint', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'resetPassword');
            expect(meta).toBeDefined();

            const validateMiddleware = validate(ResetPasswordRequestSchema);
            const hasValidateMiddleware = meta!.middleware.some(
                (mw) => typeof mw === 'function' && mw.toString() === validateMiddleware.toString(),
            );
            expect(hasValidateMiddleware).toBe(true);
        });

        it('should wire requestResetKey as POST /reset-key', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'requestResetKey');

            expect(meta).toBeDefined();
            expect(meta!.method).toBe('post');
            expect(meta!.path).toBe('/reset-key');
        });

        it('should wire validateResetKey as POST /validate-reset-key', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'validateResetKey');

            expect(meta).toBeDefined();
            expect(meta!.method).toBe('post');
            expect(meta!.path).toBe('/validate-reset-key');
        });

        it('should wire resetPassword as POST /password/reset', () => {
            const metadata = getMethodMetadata();
            const meta = metadata.find((m) => m.key === 'resetPassword');

            expect(meta).toBeDefined();
            expect(meta!.method).toBe('post');
            expect(meta!.path).toBe('/password/reset');
        });
    });
});
