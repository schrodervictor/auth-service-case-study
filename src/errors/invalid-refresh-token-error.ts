import { AppError } from './app-error';

export class InvalidRefreshTokenError extends AppError {
    readonly statusCode = 401;
    constructor() {
        super('Invalid or expired refresh token');
    }
}
