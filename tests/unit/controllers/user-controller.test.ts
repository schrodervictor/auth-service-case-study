import 'reflect-metadata';
import type { Request, Response } from 'express';

import { UserController } from '../../../src/controllers/user-controller';
import type { UserService, UserResponseDto } from '../../../src/services/user-service';
import {
    EmailAlreadyExistsError,
    InvalidCredentialsError,
    UserNotFoundError,
    ValidationError,
} from '../../../src/errors';

const createMockUserService = (): jest.Mocked<UserService> => ({
    register: jest.fn(),
    authenticate: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
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
    return res;
};

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

        it('should return 400 when email is missing', async () => {
            const req = createMockRequest({
                password: 'StrongPass1!',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 400 when password is missing', async () => {
            const req = createMockRequest({
                email: 'test@example.com',
                firstName: 'John',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 400 when firstName is missing', async () => {
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                lastName: 'Doe',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 400 when lastName is missing', async () => {
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
                firstName: 'John',
            });
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 400 when body is empty/undefined', async () => {
            const req = createMockRequest(undefined);
            const res = createMockResponse();

            await controller.register(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
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
                new ValidationError('Password is too weak'),
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
            expect(res.body).toEqual({ message: 'Password is too weak' });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.register.mockRejectedValue(new Error('DB connection lost'));
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
        it('should return 200 with token on successful authentication', async () => {
            mockService.authenticate.mockResolvedValue({ token: 'jwt-token-123' });
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'StrongPass1!',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ token: 'jwt-token-123' });
        });

        it('should call userService.authenticate with email and password from body', async () => {
            mockService.authenticate.mockResolvedValue({ token: 'jwt-token-123' });
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

        it('should return 400 when email is missing', async () => {
            const req = createMockRequest({ password: 'StrongPass1!' });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 400 when password is missing', async () => {
            const req = createMockRequest({ email: 'test@example.com' });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({ message: 'Missing required fields' });
        });

        it('should return 401 when service throws InvalidCredentialsError', async () => {
            mockService.authenticate.mockRejectedValue(new InvalidCredentialsError());
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
            mockService.authenticate.mockRejectedValue(new Error('Something broke'));
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

        it('should return 404 when service throws UserNotFoundError', async () => {
            mockService.getProfile.mockRejectedValue(new UserNotFoundError('uuid-1'));
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.getProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(404);
            expect(res.body).toEqual({ message: 'User not found: uuid-1' });
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
            const req = createMockRequest({ firstName: 'Jane' }, { id: 'uuid-1' });
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
            const req = createMockRequest({ lastName: 'Smith' }, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(200);
            expect(mockService.updateProfile).toHaveBeenCalledWith('uuid-1', {
                lastName: 'Smith',
            });
        });

        it('should return 400 when neither firstName nor lastName is provided', async () => {
            const req = createMockRequest({ age: 30 }, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({
                message: 'At least one field (firstName or lastName) is required',
            });
        });

        it('should return 400 when body is empty/undefined', async () => {
            const req = createMockRequest(undefined, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({
                message: 'At least one field (firstName or lastName) is required',
            });
        });

        it('should return 404 when service throws UserNotFoundError', async () => {
            mockService.updateProfile.mockRejectedValue(new UserNotFoundError('uuid-1'));
            const req = createMockRequest({ firstName: 'Jane' }, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(404);
            expect(res.body).toEqual({ message: 'User not found: uuid-1' });
        });

        it('should return 500 when service throws an unexpected error', async () => {
            mockService.updateProfile.mockRejectedValue(new Error('DB error'));
            const req = createMockRequest({ firstName: 'Jane' }, { id: 'uuid-1' });
            const res = createMockResponse();

            await controller.updateProfile(req as Request, res as Response);

            expect(res.statusCode).toBe(500);
            expect(res.body).toEqual({ message: 'Internal server error' });
        });
    });

    describe('Error response format', () => {
        it('should include a message field in all error responses', async () => {
            // Test with 400 (missing fields)
            const req400 = createMockRequest(undefined);
            const res400 = createMockResponse();
            await controller.register(req400 as Request, res400 as Response);
            expect(res400.body).toHaveProperty('message');

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
            mockService.authenticate.mockRejectedValue(new InvalidCredentialsError());
            const req = createMockRequest({
                email: 'test@example.com',
                password: 'wrong',
            });
            const res = createMockResponse();

            await controller.login(req as Request, res as Response);

            expect(res.body).toEqual({ message: 'Invalid email or password' });

            mockService.getProfile.mockRejectedValue(new UserNotFoundError('uuid-99'));
            const req2 = createMockRequest(undefined, { id: 'uuid-99' });
            const res2 = createMockResponse();

            await controller.getProfile(req2 as Request, res2 as Response);

            expect(res2.body).toEqual({ message: 'User not found: uuid-99' });
        });
    });
});
