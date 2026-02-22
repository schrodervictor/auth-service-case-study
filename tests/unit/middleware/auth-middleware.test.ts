import 'reflect-metadata';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';

import {
    createAuthMiddleware,
    type AuthenticatedRequest,
    type AuthMiddlewareFunction,
} from '../../../src/middleware/auth-middleware';
import { createMockResponse, createMockNext } from '../../helpers/mock-express';

jest.mock('jsonwebtoken');
const mockVerify = jwt.verify as jest.Mock;

const JWT_SECRET = 'test-jwt-secret';

const createMockRequest = (authHeader?: string): Partial<Request> => ({
    headers: authHeader !== undefined ? { authorization: authHeader } : {},
});

describe('createAuthMiddleware', () => {
    let middleware: AuthMiddlewareFunction;

    beforeEach(() => {
        middleware = createAuthMiddleware(JWT_SECRET);
        jest.clearAllMocks();
    });

    describe('factory validation', () => {
        it('should throw when called with an empty string', () => {
            expect(() => createAuthMiddleware('')).toThrow();
        });
    });

    describe('happy path', () => {
        it('should set req.user.id from token payload and call next()', () => {
            mockVerify.mockReturnValue({ userId: 'user-123' });
            const req = createMockRequest('Bearer valid-token');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(mockVerify).toHaveBeenCalledWith('valid-token', JWT_SECRET);
            expect((req as AuthenticatedRequest).user).toEqual({
                id: 'user-123',
            });
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('missing/malformed Authorization header', () => {
        it('should return 401 when Authorization header is missing', () => {
            const req = createMockRequest();
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when Authorization header is empty', () => {
            const req = createMockRequest('');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when Authorization header does not start with Bearer', () => {
            const req = createMockRequest('Basic abc123');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when token is empty after Bearer prefix', () => {
            const req = createMockRequest('Bearer ');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('invalid token', () => {
        it('should return 401 when jwt.verify throws JsonWebTokenError', () => {
            const error = new Error('invalid signature');
            error.name = 'JsonWebTokenError';
            mockVerify.mockImplementation(() => {
                throw error;
            });
            const req = createMockRequest('Bearer bad-token');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when jwt.verify throws TokenExpiredError', () => {
            const error = new Error('jwt expired');
            error.name = 'TokenExpiredError';
            mockVerify.mockImplementation(() => {
                throw error;
            });
            const req = createMockRequest('Bearer expired-token');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 401 when jwt.verify throws a generic error', () => {
            mockVerify.mockImplementation(() => {
                throw new Error('something went wrong');
            });
            const req = createMockRequest('Bearer malformed-token');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('response format consistency', () => {
        it('should always respond with { message: "Unauthorized" } for all error cases', () => {
            const errorCases = [
                { desc: 'no header', req: createMockRequest() },
                { desc: 'empty header', req: createMockRequest('') },
                { desc: 'non-Bearer', req: createMockRequest('Basic abc') },
                { desc: 'empty token', req: createMockRequest('Bearer ') },
            ];

            for (const { req } of errorCases) {
                const res = createMockResponse();
                const next = createMockNext();

                middleware(req as Request, res, next);

                expect(res.statusCode).toBe(401);
                expect(res.body).toEqual({ message: 'Unauthorized' });
                expect(next).not.toHaveBeenCalled();
            }
        });

        it('should not call next() on any error path', () => {
            // jwt.verify error path
            mockVerify.mockImplementation(() => {
                throw new Error('bad');
            });
            const req = createMockRequest('Bearer bad-token');
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(next).not.toHaveBeenCalled();
        });
    });
});
