import { AppError } from './app-error';

export class InvalidCredentialsError extends AppError {
    readonly statusCode = 401;
    constructor() {
        super('Invalid email or password');
    }
}
