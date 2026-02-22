import { RateLimitError } from '../../../src/errors/rate-limit-error';
import { AppError } from '../../../src/errors/app-error';

describe('RateLimitError', () => {
    it('should extend AppError', () => {
        const error = new RateLimitError();

        expect(error).toBeInstanceOf(AppError);
    });

    it('should have statusCode 429', () => {
        const error = new RateLimitError();

        expect(error.statusCode).toBe(429);
    });

    it('should have message "Too many requests. Please try again later."', () => {
        const error = new RateLimitError();

        expect(error.message).toBe('Too many requests. Please try again later.');
    });

    it('should have name "RateLimitError"', () => {
        const error = new RateLimitError();

        expect(error.name).toBe('RateLimitError');
    });
});
