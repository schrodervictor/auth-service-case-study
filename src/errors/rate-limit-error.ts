import { AppError } from './app-error';

export class RateLimitError extends AppError {
    readonly statusCode = 429;
    constructor() {
        super('Too many requests. Please try again later.');
    }
}
