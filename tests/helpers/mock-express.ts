import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '../../src/services/user-service';

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

export function createMockRequest(
    body?: Record<string, unknown>,
    user?: { id: string },
): Partial<Request> {
    return { body, ...(user ? { user } : {}) };
}

export function createMockUserService(): jest.Mocked<UserService> {
    return {
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
    };
}
