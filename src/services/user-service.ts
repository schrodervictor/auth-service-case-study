import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { inject, injectable } from 'inversify';

import type { AppConfig } from '../config/schema';
import type { AppSecrets } from '../config/secrets-schema';
import type { User } from '../entities/user';
import {
    EmailAlreadyExistsError,
    IncorrectPasswordError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    UserNotFoundError,
    ValidationError,
} from '../errors';
import { TYPES } from '../lib/types';
import type { RefreshTokenRepository } from '../repositories/refresh-token-repository';
import type { UserRepository } from '../repositories/user-repository';
import type { PasswordManagerService } from './password-manager-service';

export type RegisterUserDto = {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
};

export type UpdateProfileDto = {
    firstName?: string;
    lastName?: string;
};

export type UserResponseDto = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
};

export type ChangePasswordDto = {
    currentPassword: string;
    newPassword: string;
};

export type AuthResponseDto = {
    accessToken: string;
    refreshToken: string;
};

export interface UserService {
    register(data: RegisterUserDto): Promise<UserResponseDto>;
    authenticate(email: string, password: string): Promise<AuthResponseDto>;
    refreshAccessToken(token: string): Promise<AuthResponseDto>;
    logout(userId: string): Promise<void>;
    getProfile(userId: string): Promise<UserResponseDto>;
    updateProfile(
        userId: string,
        data: UpdateProfileDto,
    ): Promise<UserResponseDto>;
    changePassword(userId: string, data: ChangePasswordDto): Promise<void>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@injectable()
export class UserServiceImpl implements UserService {
    constructor(
        @inject(TYPES.UserRepository) private readonly userRepository: UserRepository,
        @inject(TYPES.PasswordManagerService) private readonly passwordManager: PasswordManagerService,
        @inject(TYPES.Config) private readonly config: AppConfig,
        @inject(TYPES.Secrets) private readonly secrets: AppSecrets,
        @inject(TYPES.RefreshTokenRepository) private readonly refreshTokenRepository: RefreshTokenRepository,
    ) {}

    async register(data: RegisterUserDto): Promise<UserResponseDto> {
        const errors: Record<string, string[]> = {};

        // Validate email format
        if (!EMAIL_REGEX.test(data.email)) {
            errors.email = ['Invalid email format'];
        }

        // Validate password strength
        const passwordErrors = this.validatePasswordStrength(data.password);
        if (passwordErrors.length > 0) {
            errors.password = passwordErrors;
        }

        // Validate firstName
        if (!data.firstName || data.firstName.trim().length === 0) {
            errors.firstName = ['First name is required'];
        }

        // Validate lastName
        if (!data.lastName || data.lastName.trim().length === 0) {
            errors.lastName = ['Last name is required'];
        }

        if (Object.keys(errors).length > 0) {
            throw new ValidationError('Validation failed', errors);
        }

        // Check email uniqueness
        const existingUser = await this.userRepository.findByEmail(data.email);
        if (existingUser) {
            throw new EmailAlreadyExistsError(data.email);
        }

        // Hash password and create user
        const hashedPassword = await this.passwordManager.toHash(data.password);
        const { password: _password, ...userData } = data;
        const createdUser = await this.userRepository.create({
            ...userData,
            passwordHash: hashedPassword,
        });

        return this.toUserResponse(createdUser);
    }

    async authenticate(email: string, password: string): Promise<AuthResponseDto> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new InvalidCredentialsError();
        }

        const isMatch = await this.passwordManager.compare(user.passwordHash, password);
        if (!isMatch) {
            throw new InvalidCredentialsError();
        }

        return this.generateTokenPair(user.id);
    }

    async refreshAccessToken(token: string): Promise<AuthResponseDto> {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const stored = await this.refreshTokenRepository.findByTokenHash(tokenHash);

        if (!stored || stored.expiresAt < new Date()) {
            throw new InvalidRefreshTokenError();
        }

        const user = await this.userRepository.findById(stored.userId);
        if (!user) {
            throw new InvalidRefreshTokenError();
        }

        // Rotate: delete old token, create new pair
        await this.refreshTokenRepository.deleteByTokenHash(stored.tokenHash);

        return this.generateTokenPair(user.id);
    }

    async logout(userId: string): Promise<void> {
        await this.refreshTokenRepository.deleteAllByUserId(userId);
    }

    async getProfile(userId: string): Promise<UserResponseDto> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UserNotFoundError(userId);
        }

        return this.toUserResponse(user);
    }

    async updateProfile(userId: string, data: UpdateProfileDto): Promise<UserResponseDto> {
        const updatedUser = await this.userRepository.update(userId, data);
        if (!updatedUser) {
            throw new UserNotFoundError(userId);
        }

        return this.toUserResponse(updatedUser);
    }

    async changePassword(userId: string, data: ChangePasswordDto): Promise<void> {
        const passwordErrors = this.validatePasswordStrength(data.newPassword);
        if (passwordErrors.length > 0) {
            throw new ValidationError('Validation failed', { newPassword: passwordErrors });
        }

        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new UserNotFoundError(userId);
        }

        const isMatch = await this.passwordManager.compare(user.passwordHash, data.currentPassword);
        if (!isMatch) {
            throw new IncorrectPasswordError();
        }

        const hashedPassword = await this.passwordManager.toHash(data.newPassword);

        const updated = await this.userRepository.updatePasswordHash(userId, hashedPassword);
        if (!updated) {
            throw new UserNotFoundError(userId);
        }

        await this.refreshTokenRepository.deleteAllByUserId(userId);
    }

    private validatePasswordStrength(password: string): string[] {
        const errors: string[] = [];
        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        return errors;
    }

    private async generateTokenPair(userId: string): Promise<AuthResponseDto> {
        const accessToken = jwt.sign(
            { userId },
            this.secrets.jwtSecret,
            { expiresIn: this.config.auth.accessToken.expiresIn as jwt.SignOptions['expiresIn'] },
        );

        const rawRefreshToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
        await this.refreshTokenRepository.save(tokenHash, userId, this.computeRefreshExpiresAt());

        return { accessToken, refreshToken: rawRefreshToken };
    }

    private computeRefreshExpiresAt(): Date {
        const expiresIn = this.config.auth.refreshToken.expiresIn;
        const match = expiresIn.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid refreshToken.expiresIn format: ${expiresIn}`);
        }

        const value = parseInt(match[1], 10);
        const unit = match[2];
        const multipliers: Record<string, number> = {
            s: 1_000,
            m: 60_000,
            h: 3_600_000,
            d: 86_400_000,
        };

        return new Date(Date.now() + value * multipliers[unit]);
    }

    private toUserResponse(user: User): UserResponseDto {
        return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
}
