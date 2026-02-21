import { AppError } from './app-error';

export class ValidationError extends AppError {
    readonly statusCode = 422;
    constructor(message: string) {
        super(message);
    }
}
