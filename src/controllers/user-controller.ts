import type { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from 'inversify-express-utils';

import { AppError, UserNotFoundError, ValidationError } from '../errors';
import { BaseController } from '../lib/base-controller';
import { TYPES } from '../lib/types';
import type { AuthenticatedRequest } from '../middleware/auth-middleware';
import { validate } from '../middleware/validate-middleware';
import {
    ChangePasswordRequestSchema,
    LoginRequestSchema,
    RefreshRequestSchema,
    RegisterRequestSchema,
    UpdateProfileRequestSchema,
} from '../schemas/user-schemas';
import type { UserService } from '../services/user-service';

@controller('/users')
export class UserController extends BaseController {
    constructor(
        @inject(TYPES.UserService) private readonly userService: UserService,
    ) {
        super();
    }

    @httpPost('/register', TYPES.JsonContentType, validate(RegisterRequestSchema))
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, firstName, lastName } = req.body;

            const user = await this.userService.register({
                email,
                password,
                firstName,
                lastName,
            });

            res.status(201).json(user);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    @httpPost('/login', TYPES.JsonContentType, validate(LoginRequestSchema), TYPES.LoginRateLimiter)
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            const result = await this.userService.authenticate(email, password);

            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    @httpPost('/refresh', TYPES.JsonContentType, validate(RefreshRequestSchema), TYPES.RefreshRateLimiter)
    async refresh(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;

            const result = await this.userService.refreshAccessToken(refreshToken);
            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    @httpPost('/logout', TYPES.AuthMiddleware)
    async logout(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as AuthenticatedRequest).user.id;
            await this.userService.logout(userId);
            res.status(204).send();
        } catch (error) {
            this.handleError(res, error);
        }
    }

    @httpGet('/profile', TYPES.AuthMiddleware)
    async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as AuthenticatedRequest).user.id;
            const user = await this.userService.getProfile(userId);

            res.status(200).json(user);
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            this.handleError(res, error);
        }
    }

    @httpPut('/profile', TYPES.AuthMiddleware, validate(UpdateProfileRequestSchema))
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as AuthenticatedRequest).user.id;

            const user = await this.userService.updateProfile(userId, req.body);

            res.status(200).json(user);
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            this.handleError(res, error);
        }
    }

    @httpPut('/password', TYPES.AuthMiddleware, TYPES.JsonContentType, validate(ChangePasswordRequestSchema))
    async changePassword(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as AuthenticatedRequest).user.id;
            const { currentPassword, newPassword } = req.body;

            await this.userService.changePassword(userId, {
                currentPassword,
                newPassword,
            });

            res.status(204).send();
        } catch (error) {
            if (error instanceof UserNotFoundError) {
                res.status(401).json({ message: 'Unauthorized' });
                return;
            }
            this.handleError(res, error);
        }
    }

    private handleError(res: Response, error: unknown): void {
        if (error instanceof ValidationError) {
            res.status(error.statusCode).json({ message: error.message, errors: error.errors });
        } else if (error instanceof AppError) {
            res.status(error.statusCode).json({ message: error.message });
        } else {
            res.status(500).json({ message: 'Internal server error' });
        }
    }
}
