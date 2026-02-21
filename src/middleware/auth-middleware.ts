import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

export type AuthenticatedRequest = Request & {
    user: { id: string };
};

export type AuthMiddlewareFunction = (
    req: Request,
    res: Response,
    next: NextFunction,
) => void;

interface JwtPayload {
    userId: string;
}

export function createAuthMiddleware(_jwtSecret?: string): AuthMiddlewareFunction {
    return (req: Request, res: Response, next: NextFunction): void => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const token = authHeader.slice(7);

        if (!token) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            res.status(500).json({ message: 'Internal server error' });
            return;
        }

        try {
            const decoded = jwt.verify(token, secret) as JwtPayload;

            (req as AuthenticatedRequest).user = { id: decoded.userId };
            next();
        } catch {
            res.status(401).json({ message: 'Unauthorized' });
        }
    };
}
