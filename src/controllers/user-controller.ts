import type { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost, httpPut } from 'inversify-express-utils';

import { AppError, UserNotFoundError, ValidationError } from '../errors';
import { BaseController } from '../lib/base-controller';
import { TYPES } from '../lib/types';
import type { AuthenticatedRequest } from '../middleware/auth-middleware';
import type { UserService } from '../services/user-service';

@controller('/users')
export class UserController extends BaseController {
    constructor(
        @inject(TYPES.UserService) private readonly userService: UserService,
    ) {
        super();
    }

    @httpPost('/register')
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, firstName, lastName } = req.body ?? {};

            if (email == null || password == null || firstName == null || lastName == null) {
                res.status(400).json({ message: 'Missing required fields' });
                return;
            }

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

    @httpPost('/login')
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body ?? {};

            if (!email || !password) {
                res.status(400).json({ message: 'Missing required fields' });
                return;
            }

            const result = await this.userService.authenticate(email, password);

            res.status(200).json(result);
        } catch (error) {
            this.handleError(res, error);
        }
    }

    @httpPost('/refresh')
    async refresh(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body ?? {};

            if (!refreshToken) {
                res.status(400).json({ message: 'Missing required fields' });
                return;
            }

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

    @httpPut('/profile', TYPES.AuthMiddleware)
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as AuthenticatedRequest).user.id;
            const { firstName, lastName } = req.body ?? {};

            if (!firstName && !lastName) {
                res.status(400).json({
                    message: 'At least one field (firstName or lastName) is required',
                });
                return;
            }

            const updateData: { firstName?: string; lastName?: string } = {};
            if (firstName) updateData.firstName = firstName;
            if (lastName) updateData.lastName = lastName;

            const user = await this.userService.updateProfile(userId, updateData);

            res.status(200).json(user);
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
