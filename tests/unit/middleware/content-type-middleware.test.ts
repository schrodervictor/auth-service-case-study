import type { Request, Response, NextFunction } from 'express';

import { requireJsonContentType } from '../../../src/middleware/content-type-middleware';

const createMockRequest = (method: string, isJson: string | false): Partial<Request> => ({
    method,
    is: jest.fn().mockImplementation((type: string) => {
        if (type === 'json') return isJson;
        return false;
    }),
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

const createMockNext = (): jest.Mock<NextFunction> => jest.fn();

describe('requireJsonContentType', () => {
    describe('rejects non-JSON content types', () => {
        it('should return 415 for POST with non-JSON content type', () => {
            const req = createMockRequest('POST', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(res.statusCode).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 415 for PUT with non-JSON content type', () => {
            const req = createMockRequest('PUT', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(res.statusCode).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
            expect(next).not.toHaveBeenCalled();
        });

        it('should return 415 for POST with no Content-Type header', () => {
            const req = createMockRequest('POST', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(res.statusCode).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('passes through safe methods', () => {
        it('should call next() for GET requests', () => {
            const req = createMockRequest('GET', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should call next() for DELETE requests', () => {
            const req = createMockRequest('DELETE', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('passes through JSON content types', () => {
        it('should call next() for POST with application/json', () => {
            const req = createMockRequest('POST', 'application/json');
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should call next() for POST with application/json; charset=utf-8', () => {
            const req = createMockRequest('POST', 'application/json');
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('response format', () => {
        it('should return { message: "Content-Type must be application/json" } on 415', () => {
            const req = createMockRequest('POST', false);
            const res = createMockResponse();
            const next = createMockNext();

            requireJsonContentType(req as Request, res as Response, next);

            expect(res.statusCode).toBe(415);
            expect(res.body).toEqual({ message: 'Content-Type must be application/json' });
            expect(Object.keys(res.body as object)).toEqual(['message']);
        });
    });
});
