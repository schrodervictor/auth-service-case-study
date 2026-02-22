import { AppError } from '../../../src/errors/app-error';
import { IncorrectPasswordError } from '../../../src/errors/incorrect-password-error';
import { InvalidCredentialsError } from '../../../src/errors/invalid-credentials-error';
import { InvalidRefreshTokenError } from '../../../src/errors/invalid-refresh-token-error';
import { InvalidResetKeyError } from '../../../src/errors/invalid-reset-key-error';
import { RateLimitError } from '../../../src/errors/rate-limit-error';

const errorCases = [
    {
        name: 'IncorrectPasswordError',
        error: new IncorrectPasswordError(),
        statusCode: 401,
        message: 'Current password is incorrect',
    },
    {
        name: 'InvalidCredentialsError',
        error: new InvalidCredentialsError(),
        statusCode: 401,
        message: 'Invalid email or password',
    },
    {
        name: 'InvalidRefreshTokenError',
        error: new InvalidRefreshTokenError(),
        statusCode: 401,
        message: 'Invalid or expired refresh token',
    },
    {
        name: 'InvalidResetKeyError',
        error: new InvalidResetKeyError(),
        statusCode: 400,
        message: 'Invalid or expired reset key',
    },
    {
        name: 'RateLimitError',
        error: new RateLimitError(),
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
    },
];

describe.each(errorCases)(
    '$name',
    ({ error, name, statusCode, message }) => {
        it('should extend AppError', () => {
            expect(error).toBeInstanceOf(AppError);
        });

        it(`should have statusCode ${statusCode}`, () => {
            expect(error.statusCode).toBe(statusCode);
        });

        it('should have the correct message', () => {
            expect(error.message).toBe(message);
        });

        it('should have the correct name', () => {
            expect(error.name).toBe(name);
        });
    },
);
