import type { Response, NextFunction } from 'express';

export type MockResponse = Response & {
    statusCode?: number;
    body?: unknown;
};

export function createMockResponse(): MockResponse {
    const res: Record<string, unknown> = {};
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
    return res as unknown as MockResponse;
}

export function createMockNext(): jest.Mock<NextFunction> {
    return jest.fn();
}
