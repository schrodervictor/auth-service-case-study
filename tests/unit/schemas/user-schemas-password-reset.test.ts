import {
    ResetKeyRequestSchema,
    ValidateResetKeyRequestSchema,
    ResetPasswordRequestSchema,
} from '../../../src/schemas/user-schemas';

/** Minimal shape of a Zod safeParse failure result, for casting. */
interface ParseFailure {
    error: { issues: Array<{ path: Array<string | number>; message: string }> };
}

/** Helper to check if any issue targets a specific field. */
const hasIssueForField = (
    issues: Array<{ path: Array<string | number> }>,
    field: string,
): boolean => issues.some((i) => i.path.includes(field));

/** Helper to extract field paths from Zod error issues. */
const getIssuePaths = (issues: Array<{ path: Array<string | number> }>): Array<string | number> =>
    issues.map((i) => i.path[0]);

describe('ResetKeyRequestSchema', () => {
    const validInput = { email: 'user@example.com' };

    it('should accept valid input', () => {
        const result = ResetKeyRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when email is missing', () => {
        const result = ResetKeyRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(hasIssueForField((result as unknown as ParseFailure).error.issues, 'email')).toBe(
            true,
        );
    });

    it('should reject empty email string', () => {
        const result = ResetKeyRequestSchema.safeParse({ email: '' });
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const result = ResetKeyRequestSchema.safeParse({ ...validInput, extra: 'data' });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});

describe('ValidateResetKeyRequestSchema', () => {
    const validInput = { resetKey: 'some-reset-key-value' };

    it('should accept valid input', () => {
        const result = ValidateResetKeyRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when resetKey is missing', () => {
        const result = ValidateResetKeyRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        expect(
            hasIssueForField((result as unknown as ParseFailure).error.issues, 'resetKey'),
        ).toBe(true);
    });

    it('should reject empty resetKey string', () => {
        const result = ValidateResetKeyRequestSchema.safeParse({ resetKey: '' });
        expect(result.success).toBe(false);
    });

    it('should strip extra fields', () => {
        const result = ValidateResetKeyRequestSchema.safeParse({ ...validInput, extra: true });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});

describe('ResetPasswordRequestSchema', () => {
    const validInput = {
        resetKey: 'some-reset-key-value',
        newPassword: 'NewSecure1!',
    };

    it('should accept valid input', () => {
        const result = ResetPasswordRequestSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });

    it('should reject when resetKey is missing', () => {
        const result = ResetPasswordRequestSchema.safeParse({ newPassword: 'NewSecure1!' });
        expect(result.success).toBe(false);
        expect(
            hasIssueForField((result as unknown as ParseFailure).error.issues, 'resetKey'),
        ).toBe(true);
    });

    it('should reject when newPassword is missing', () => {
        const result = ResetPasswordRequestSchema.safeParse({ resetKey: 'some-key' });
        expect(result.success).toBe(false);
        expect(
            hasIssueForField((result as unknown as ParseFailure).error.issues, 'newPassword'),
        ).toBe(true);
    });

    it('should reject empty resetKey string', () => {
        const result = ResetPasswordRequestSchema.safeParse({
            ...validInput,
            resetKey: '',
        });
        expect(result.success).toBe(false);
    });

    it('should reject empty newPassword string', () => {
        const result = ResetPasswordRequestSchema.safeParse({
            ...validInput,
            newPassword: '',
        });
        expect(result.success).toBe(false);
    });

    it('should report both missing fields at once', () => {
        const result = ResetPasswordRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        const paths = getIssuePaths((result as unknown as ParseFailure).error.issues);
        expect(paths).toContain('resetKey');
        expect(paths).toContain('newPassword');
    });

    it('should strip extra fields', () => {
        const result = ResetPasswordRequestSchema.safeParse({
            ...validInput,
            confirmPassword: 'NewSecure1!',
        });
        expect(result.success).toBe(true);
        expect((result as { data: unknown }).data).toEqual(validInput);
    });
});
