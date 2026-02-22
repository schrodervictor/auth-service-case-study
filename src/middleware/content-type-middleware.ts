import type { Request, Response, NextFunction } from 'express';

export function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
    if (!req.is('json')) {
        res.status(415).json({ message: 'Content-Type must be application/json' });
        return;
    }
    next();
}
