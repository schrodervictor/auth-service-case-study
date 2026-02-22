import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { validate } from '../../../src/middleware/validate-middleware';

const createMockRequest = (body: unknown): Partial<Request> => ({
    body,
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

const testSchema = z.object({
    name: z.string({ error: 'Name is required' }).min(1, 'Name is required'),
    age: z.number({ error: 'Age is required' }),
});

describe('validate middleware', () => {
    describe('success path', () => {
        it('should call next() when body matches the schema', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({ name: 'Alice', age: 30 });
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should set req.body to the parsed data', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({ name: 'Alice', age: 30 });
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(req.body).toEqual({ name: 'Alice', age: 30 });
        });

        it('should strip extra fields not in the schema', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({ name: 'Alice', age: 30, extra: 'field', admin: true });
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalled();
            expect(req.body).toEqual({ name: 'Alice', age: 30 });
            expect(req.body).not.toHaveProperty('extra');
            expect(req.body).not.toHaveProperty('admin');
        });
    });

    describe('failure path', () => {
        it('should return 422 when validation fails', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({});
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(res.statusCode).toBe(422);
            expect(next).not.toHaveBeenCalled();
        });

        it('should return the correct error response shape', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({});
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(res.body).toHaveProperty('message', 'Validation failed');
            expect(res.body).toHaveProperty('errors');
            expect(typeof (res.body as Record<string, unknown>).errors).toBe('object');
        });

        it('should group errors by field name', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({});
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            const body = res.body as { message: string; errors: Record<string, string[]> };
            expect(body.errors.name).toEqual(expect.arrayContaining([expect.any(String)]));
            expect(body.errors.age).toEqual(expect.arrayContaining([expect.any(String)]));
        });

        it('should return multiple error messages for a single field', () => {
            const strictSchema = z.object({
                email: z
                    .string({ error: 'Email is required' })
                    .min(1, 'Email is required')
                    .email('Invalid email format'),
            });

            const middleware = validate(strictSchema);
            const req = createMockRequest({ email: '' });
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            const body = res.body as { message: string; errors: Record<string, string[]> };
            expect(body.errors.email.length).toBeGreaterThanOrEqual(1);
        });

        it('should return errors for multiple fields at once', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest({ name: '', age: 'not-a-number' });
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            const body = res.body as { message: string; errors: Record<string, string[]> };
            expect(body.errors).toHaveProperty('name');
            expect(body.errors).toHaveProperty('age');
        });
    });

    describe('empty path handling', () => {
        it('should use "_" as the key when issue path is empty', () => {
            const refinedSchema = z
                .object({
                    a: z.string().optional(),
                    b: z.string().optional(),
                })
                .refine((data) => data.a !== undefined || data.b !== undefined, {
                    message: 'At least one field is required',
                    path: [],
                });

            const middleware = validate(refinedSchema);
            const req = createMockRequest({});
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            const body = res.body as { message: string; errors: Record<string, string[]> };
            expect(body.errors).toHaveProperty('_');
            expect(body.errors['_']).toContain('At least one field is required');
        });

        it('should use the provided path when refine specifies one', () => {
            const refinedSchema = z
                .object({
                    a: z.string().optional(),
                    b: z.string().optional(),
                })
                .refine((data) => data.a !== undefined || data.b !== undefined, {
                    message: 'At least one field is required',
                    path: ['_'],
                });

            const middleware = validate(refinedSchema);
            const req = createMockRequest({});
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            const body = res.body as { message: string; errors: Record<string, string[]> };
            expect(body.errors).toHaveProperty('_');
            expect(body.errors['_']).toContain('At least one field is required');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined body gracefully', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest(undefined);
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(res.statusCode).toBe(422);
            expect(next).not.toHaveBeenCalled();
        });

        it('should handle null body gracefully', () => {
            const middleware = validate(testSchema);
            const req = createMockRequest(null);
            const res = createMockResponse();
            const next = createMockNext();

            middleware(req as Request, res as Response, next);

            expect(res.statusCode).toBe(422);
            expect(next).not.toHaveBeenCalled();
        });
    });
});
