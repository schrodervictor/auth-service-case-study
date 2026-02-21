import { InvalidRefreshTokenError } from '../../../src/errors/invalid-refresh-token-error';
import { AppError } from '../../../src/errors/app-error';

describe('InvalidRefreshTokenError', () => {
    it('should extend AppError', () => {
        const error = new InvalidRefreshTokenError();

        expect(error).toBeInstanceOf(AppError);
    });

    it('should have statusCode 401', () => {
        const error = new InvalidRefreshTokenError();

        expect(error.statusCode).toBe(401);
    });

    it('should have message "Invalid or expired refresh token"', () => {
        const error = new InvalidRefreshTokenError();

        expect(error.message).toBe('Invalid or expired refresh token');
    });

    it('should have name "InvalidRefreshTokenError"', () => {
        const error = new InvalidRefreshTokenError();

        expect(error.name).toBe('InvalidRefreshTokenError');
    });
});
