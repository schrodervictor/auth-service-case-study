import { AppError } from './app-error';

export class ValidationError extends AppError {
    readonly statusCode = 422;
    constructor(
        message: string,
        public readonly errors: Record<string, string[]>,
    ) {
        super(message);
    }
}
