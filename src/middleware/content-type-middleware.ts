import type { Request, Response, NextFunction } from 'express';

export function requireJsonContentType(req: Request, res: Response, next: NextFunction): void {
    const hasBody = req.method === 'POST' || req.method === 'PUT';
    const hasContentType = Boolean(req.headers['content-type']);
    const isJson = Boolean(req.is('json'));

    if (hasBody && hasContentType && !isJson) {
        res.status(415).json({ message: 'Content-Type must be application/json' });
        return;
    }
    next();
}
