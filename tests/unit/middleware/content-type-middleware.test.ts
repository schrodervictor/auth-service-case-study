import type { Request, Response } from 'express';

import { requireJsonContentType } from '../../../src/middleware/content-type-middleware';
import { createMockResponse, createMockNext } from '../../helpers/mock-express';

const createMockRequest = (isJson: string | false): Partial<Request> => ({
    is: jest.fn().mockImplementation((type: string) => {
        if (type === 'json') return isJson;
        return false;
    }),
});

describe('requireJsonContentType', () => {
    it('should return 415 when Content-Type is not JSON', () => {
        const req = createMockRequest(false);
        const res = createMockResponse();
        const next = createMockNext();

        requireJsonContentType(req as Request, res as Response, next);

        expect(res.statusCode).toBe(415);
        expect(res.body).toEqual({
            message: 'Content-Type must be application/json',
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('should call next() when Content-Type is application/json', () => {
        const req = createMockRequest('application/json');
        const res = createMockResponse();
        const next = createMockNext();

        requireJsonContentType(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when Content-Type is application/json with charset', () => {
        const req = createMockRequest('application/json');
        const res = createMockResponse();
        const next = createMockNext();

        requireJsonContentType(req as Request, res as Response, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return response with only a message field on 415', () => {
        const req = createMockRequest(false);
        const res = createMockResponse();
        const next = createMockNext();

        requireJsonContentType(req as Request, res as Response, next);

        expect(Object.keys(res.body as object)).toEqual(['message']);
    });
});
