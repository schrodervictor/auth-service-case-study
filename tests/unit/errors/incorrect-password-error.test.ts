import { IncorrectPasswordError } from '../../../src/errors/incorrect-password-error';
import { AppError } from '../../../src/errors/app-error';

describe('IncorrectPasswordError', () => {
    it('should extend AppError', () => {
        const error = new IncorrectPasswordError();

        expect(error).toBeInstanceOf(AppError);
    });

    it('should have statusCode 401', () => {
        const error = new IncorrectPasswordError();

        expect(error.statusCode).toBe(401);
    });

    it('should have message "Current password is incorrect"', () => {
        const error = new IncorrectPasswordError();

        expect(error.message).toBe('Current password is incorrect');
    });

    it('should have name "IncorrectPasswordError"', () => {
        const error = new IncorrectPasswordError();

        expect(error.name).toBe('IncorrectPasswordError');
    });
});
