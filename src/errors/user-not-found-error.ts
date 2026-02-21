import { AppError } from './app-error';

export class UserNotFoundError extends AppError {
    readonly statusCode = 404;
    constructor(userId: string) {
        super(`User not found: ${userId}`);
    }
}
