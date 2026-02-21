import type { Request, Response, NextFunction } from 'express';

export type AuthenticatedRequest = Request & {
    user: { id: string };
};

export type AuthMiddlewareFunction = (
    req: Request,
    res: Response,
    next: NextFunction,
) => void;
