import { AppError } from './app-error';

export class InvalidResetKeyError extends AppError {
    readonly statusCode = 400;
    constructor() {
        super('Invalid or expired reset key');
    }
}
