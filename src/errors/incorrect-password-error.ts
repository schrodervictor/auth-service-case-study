import { AppError } from './app-error';

export class IncorrectPasswordError extends AppError {
    readonly statusCode = 401;
    constructor() {
        super('Current password is incorrect');
    }
}
