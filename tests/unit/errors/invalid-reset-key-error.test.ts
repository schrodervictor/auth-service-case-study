import { InvalidResetKeyError } from '../../../src/errors/invalid-reset-key-error';
import { AppError } from '../../../src/errors/app-error';

describe('InvalidResetKeyError', () => {
    it('should extend AppError', () => {
        const error = new InvalidResetKeyError();

        expect(error).toBeInstanceOf(AppError);
    });

    it('should have statusCode 400', () => {
        const error = new InvalidResetKeyError();

        expect(error.statusCode).toBe(400);
    });

    it('should have message "Invalid or expired reset key"', () => {
        const error = new InvalidResetKeyError();

        expect(error.message).toBe('Invalid or expired reset key');
    });

    it('should have name "InvalidResetKeyError"', () => {
        const error = new InvalidResetKeyError();

        expect(error.name).toBe('InvalidResetKeyError');
    });
});
