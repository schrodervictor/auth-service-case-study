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

    it('should throw when called with an empty string', () => {
        expect(() => createAuthMiddleware('')).toThrow();
    });

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

    const headerErrorCases = [
        { desc: 'missing', header: undefined },
        { desc: 'empty', header: '' },
        { desc: 'non-Bearer scheme', header: 'Basic abc123' },
        { desc: 'empty token after Bearer', header: 'Bearer ' },
    ];

    it.each(headerErrorCases)(
        'should return 401 when Authorization header is $desc',
        ({ header }) => {
            const req = createMockRequest(header);
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res, next);

            expect(res.statusCode).toBe(401);
            expect(res.body).toEqual({ message: 'Unauthorized' });
            expect(next).not.toHaveBeenCalled();
        },
    );

    const jwtErrorCases = [
        { desc: 'JsonWebTokenError', error: Object.assign(new Error('invalid signature'), { name: 'JsonWebTokenError' }) },
        { desc: 'TokenExpiredError', error: Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' }) },
        { desc: 'generic error', error: new Error('something went wrong') },
    ];

    it.each(jwtErrorCases)(
        'should return 401 when jwt.verify throws $desc',
        ({ error }) => {
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
        },
    );
});
