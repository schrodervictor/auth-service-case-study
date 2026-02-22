import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { ZodError } from 'zod';

export function validate(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            const errors: Record<string, string[]> = {};
            for (const issue of (result.error as ZodError).issues) {
                const key = issue.path.length > 0 ? issue.path.join('.') : '_';
                if (!errors[key]) errors[key] = [];
                errors[key].push(issue.message);
            }
            res.status(422).json({ message: 'Validation failed', errors });
            return;
        }

        req.body = result.data;
        next();
    };
}
