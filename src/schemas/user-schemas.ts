import { z } from 'zod';

export const RegisterRequestSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .min(1, 'Email is required'),
    password: z
        .string({ error: 'Password is required' })
        .min(1, 'Password is required'),
    firstName: z
        .string({ error: 'First name is required' })
        .trim()
        .min(1, 'First name is required'),
    lastName: z
        .string({ error: 'Last name is required' })
        .trim()
        .min(1, 'Last name is required'),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
    email: z
        .string({ error: 'Email is required' })
        .min(1, 'Email is required'),
    password: z
        .string({ error: 'Password is required' })
        .min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
    refreshToken: z
        .string({ error: 'Refresh token is required' })
        .min(1, 'Refresh token is required'),
});

export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const UpdateProfileRequestSchema = z
    .object({
        firstName: z.string().trim().min(1, 'First name cannot be empty').optional(),
        lastName: z.string().trim().min(1, 'Last name cannot be empty').optional(),
    })
    .refine(
        (data) => data.firstName !== undefined || data.lastName !== undefined,
        {
            message: 'At least one field (firstName or lastName) is required',
            path: ['_'],
        },
    );

export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
    currentPassword: z
        .string({ error: 'Current password is required' })
        .min(1, 'Current password is required'),
    newPassword: z
        .string({ error: 'New password is required' })
        .min(1, 'New password is required'),
});

export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;
