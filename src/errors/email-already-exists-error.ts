import { AppError } from './app-error';

export class EmailAlreadyExistsError extends AppError {
    readonly statusCode = 409;
    constructor(email: string) {
        super(`Email "${email}" is already registered`);
    }
}
