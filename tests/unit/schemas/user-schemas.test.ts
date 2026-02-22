import {
    RegisterRequestSchema,
    LoginRequestSchema,
    RefreshRequestSchema,
    UpdateProfileRequestSchema,
    ChangePasswordRequestSchema,
} from '../../../src/schemas/user-schemas';

/** Minimal shape of a Zod safeParse failure result, for casting. */
interface ParseFailure {
    error: { issues: Array<{ path: Array<string | number>; message: string }> };
}

/** Helper to extract field paths from Zod error issues. */
const getIssuePaths = (
    issues: Array<{ path: Array<string | number> }>,
): Array<string | number> => issues.map(i => i.path[0]);

/** Helper to check if any issue targets a specific field. */
const hasIssueForField = (
    issues: Array<{ path: Array<string | number> }>,
    field: string,
): boolean => issues.some(i => i.path.includes(field));

describe('RegisterRequestSchema', () => {
    const validInput = {
        email: 'user@example.com',
        password: 'SecurePass1!',
        firstName: 'John',
        lastName: 'Doe',
    };

    it('should accept valid input', () => {
        const result = RegisterRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when email is missing', () => {
        const { email: _email, ...input } = validInput;
        const result = RegisterRequestSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'email',
            ),
        ).toBe(true);
    });

    it('should reject when password is missing', () => {
        const { password: _password, ...input } = validInput;
        const result = RegisterRequestSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'password',
            ),
        ).toBe(true);
    });

    it('should reject when firstName is missing', () => {
        const { firstName: _firstName, ...input } = validInput;
        const result = RegisterRequestSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'firstName',
            ),
        ).toBe(true);
    });

    it('should reject when lastName is missing', () => {
        const { lastName: _lastName, ...input } = validInput;
        const result = RegisterRequestSchema.safeParse(input);
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'lastName',
            ),
        ).toBe(true);
    });

    it('should reject empty email string', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            email: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty password string', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            password: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty firstName string', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            firstName: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty lastName string', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            lastName: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject whitespace-only firstName', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            firstName: '   ',
        });
        expect(result.success).toBe(false);
    });

    it('should reject whitespace-only lastName', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            lastName: '   ',
        });
        expect(result.success).toBe(false);
    });

    it('should trim firstName and lastName', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            firstName: '  John  ',
            lastName: '  Doe  ',
        });
        expect(result.success).toBe(true);
        const data = (result as { data: typeof validInput }).data;
        expect(data.firstName).toBe('John');
        expect(data.lastName).toBe('Doe');
    });

    it('should strip extra fields', () => {
        const result = RegisterRequestSchema.safeParse({
            ...validInput,
            admin: true,
            role: 'superuser',
        });
        expect(result.success).toBe(true);
        const data = (result as { data: Record<string, unknown> }).data;
        expect(data).toEqual(validInput);
        expect(data).not.toHaveProperty('admin');
        expect(data).not.toHaveProperty('role');
    });

    it('should report all missing fields at once', () => {
        const result = RegisterRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        const paths = getIssuePaths(
            (result as unknown as ParseFailure).error.issues,
        );
        expect(paths).toContain('email');
        expect(paths).toContain('password');
        expect(paths).toContain('firstName');
        expect(paths).toContain('lastName');
    });
});

describe('LoginRequestSchema', () => {
    const validInput = {
        email: 'user@example.com',
        password: 'Password123!',
    };

    it('should accept valid input', () => {
        const result = LoginRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when email is missing', () => {
        const result = LoginRequestSchema.safeParse({
            password: 'Password123!',
        });
        expect(result.success).toBe(false);
    });

    it('should reject when password is missing', () => {
        const result = LoginRequestSchema.safeParse({
            email: 'user@example.com',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty email string', () => {
        const result = LoginRequestSchema.safeParse({
            ...validInput,
            email: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty password string', () => {
        const result = LoginRequestSchema.safeParse({
            ...validInput,
            password: '',
        });
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const result = LoginRequestSchema.safeParse({
            ...validInput,
            extra: 'data',
        });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});

describe('RefreshRequestSchema', () => {
    const validInput = { refreshToken: 'some-refresh-token-value' };

    it('should accept valid input', () => {
        const result = RefreshRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when refreshToken is missing', () => {
        const result = RefreshRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'refreshToken',
            ),
        ).toBe(true);
    });

    it('should reject empty refreshToken string', () => {
        const result = RefreshRequestSchema.safeParse({ refreshToken: '' });
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const result = RefreshRequestSchema.safeParse({
            ...validInput,
            extra: true,
        });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});

describe('UpdateProfileRequestSchema', () => {
    it('should accept valid input with both fields', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            firstName: 'Jane',
            lastName: 'Smith',
        });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual({
            firstName: 'Jane',
            lastName: 'Smith',
        });
    });

    it('should accept valid input with only firstName', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            firstName: 'Jane',
        });
        expect(result.success).toBe(true);
        expect((result as { data: { firstName: string } }).data.firstName).toBe(
            'Jane',
        );
    });

    it('should accept valid input with only lastName', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            lastName: 'Smith',
        });
        expect(result.success).toBe(true);
        expect((result as { data: { lastName: string } }).data.lastName).toBe(
            'Smith',
        );
    });

    it('should reject when both fields are missing (refine fails)', () => {
        const result = UpdateProfileRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        const messages = (result as unknown as ParseFailure).error.issues.map(
            i => i.message,
        );
        expect(messages).toContain(
            'At least one field (firstName or lastName) is required',
        );
    });

    it('should reject empty firstName string', () => {
        const result = UpdateProfileRequestSchema.safeParse({ firstName: '' });
        expect(result.success).toBe(false);
    });

    it('should reject empty lastName string', () => {
        const result = UpdateProfileRequestSchema.safeParse({ lastName: '' });
        expect(result.success).toBe(false);
    });

    it('should reject whitespace-only firstName', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            firstName: '   ',
        });
        expect(result.success).toBe(false);
    });

    it('should reject whitespace-only lastName', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            lastName: '   ',
        });
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            firstName: 'Jane',
            extra: 'field',
        });
        expect(result.success).toBe(true);
        expect(
            (result as { data: Record<string, unknown> }).data,
        ).not.toHaveProperty('extra');
    });

    it('should trim firstName and lastName', () => {
        const result = UpdateProfileRequestSchema.safeParse({
            firstName: '  Jane  ',
            lastName: '  Smith  ',
        });
        expect(result.success).toBe(true);
        const data = (
            result as { data: { firstName: string; lastName: string } }
        ).data;
        expect(data.firstName).toBe('Jane');
        expect(data.lastName).toBe('Smith');
    });
});

describe('ChangePasswordRequestSchema', () => {
    const validInput = {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
    };

    it('should accept valid input', () => {
        const result = ChangePasswordRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when currentPassword is missing', () => {
        const result = ChangePasswordRequestSchema.safeParse({
            newPassword: 'NewPass456!',
        });
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'currentPassword',
            ),
        ).toBe(true);
    });

    it('should reject when newPassword is missing', () => {
        const result = ChangePasswordRequestSchema.safeParse({
            currentPassword: 'OldPass123!',
        });
        expect(result.success).toBe(false);
        expect(
            hasIssueForField(
                (result as unknown as ParseFailure).error.issues,
                'newPassword',
            ),
        ).toBe(true);
    });

    it('should reject empty currentPassword string', () => {
        const result = ChangePasswordRequestSchema.safeParse({
            ...validInput,
            currentPassword: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty newPassword string', () => {
        const result = ChangePasswordRequestSchema.safeParse({
            ...validInput,
            newPassword: '',
        });
        expect(result.success).toBe(false);
    });

    it('should report both missing fields at once', () => {
        const result = ChangePasswordRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        const paths = getIssuePaths(
            (result as unknown as ParseFailure).error.issues,
        );
        expect(paths).toContain('currentPassword');
        expect(paths).toContain('newPassword');
    });

    it('should strip extra fields', () => {
        const result = ChangePasswordRequestSchema.safeParse({
            ...validInput,
            confirmPassword: 'NewPass456!',
        });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});
