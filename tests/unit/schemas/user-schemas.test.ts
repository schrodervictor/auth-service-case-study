import {
    RegisterRequestSchema,
    LoginRequestSchema,
    RefreshRequestSchema,
    UpdateProfileRequestSchema,
    ChangePasswordRequestSchema,
    ResetKeyRequestSchema,
    ValidateResetKeyRequestSchema,
    ResetPasswordRequestSchema,
} from '../../../src/schemas/user-schemas';

/** Minimal shape of a Zod safeParse failure result, for casting. */
interface ParseFailure {
    error: { issues: Array<{ path: Array<string | number>; message: string }> };
}

const hasIssueForField = (
    issues: Array<{ path: Array<string | number> }>,
    field: string,
): boolean => issues.some(i => i.path.includes(field));

const getIssuePaths = (
    issues: Array<{ path: Array<string | number> }>,
): Array<string | number> => issues.map(i => i.path[0]);

const schemas = [
    {
        name: 'RegisterRequestSchema',
        schema: RegisterRequestSchema,
        validInput: {
            email: 'user@example.com',
            password: 'SecurePass1!',
            firstName: 'John',
            lastName: 'Doe',
        },
        requiredFields: ['email', 'password', 'firstName', 'lastName'],
        emptyStringFields: ['email', 'password', 'firstName', 'lastName'],
        whitespaceFields: ['firstName', 'lastName'],
        trimFields: [
            { field: 'firstName', raw: '  John  ', trimmed: 'John' },
            { field: 'lastName', raw: '  Doe  ', trimmed: 'Doe' },
        ],
    },
    {
        name: 'LoginRequestSchema',
        schema: LoginRequestSchema,
        validInput: { email: 'user@example.com', password: 'Password123!' },
        requiredFields: ['email', 'password'],
        emptyStringFields: ['email', 'password'],
        whitespaceFields: [],
        trimFields: [],
    },
    {
        name: 'RefreshRequestSchema',
        schema: RefreshRequestSchema,
        validInput: { refreshToken: 'some-refresh-token-value' },
        requiredFields: ['refreshToken'],
        emptyStringFields: ['refreshToken'],
        whitespaceFields: [],
        trimFields: [],
    },
    {
        name: 'ChangePasswordRequestSchema',
        schema: ChangePasswordRequestSchema,
        validInput: {
            currentPassword: 'OldPass123!',
            newPassword: 'NewPass456!',
        },
        requiredFields: ['currentPassword', 'newPassword'],
        emptyStringFields: ['currentPassword', 'newPassword'],
        whitespaceFields: [],
        trimFields: [],
    },
    {
        name: 'ResetKeyRequestSchema',
        schema: ResetKeyRequestSchema,
        validInput: { email: 'user@example.com' },
        requiredFields: ['email'],
        emptyStringFields: ['email'],
        whitespaceFields: [],
        trimFields: [],
    },
    {
        name: 'ValidateResetKeyRequestSchema',
        schema: ValidateResetKeyRequestSchema,
        validInput: { resetKey: 'some-reset-key-value' },
        requiredFields: ['resetKey'],
        emptyStringFields: ['resetKey'],
        whitespaceFields: [],
        trimFields: [],
    },
    {
        name: 'ResetPasswordRequestSchema',
        schema: ResetPasswordRequestSchema,
        validInput: {
            resetKey: 'some-reset-key-value',
            newPassword: 'NewSecure1!',
        },
        requiredFields: ['resetKey', 'newPassword'],
        emptyStringFields: ['resetKey', 'newPassword'],
        whitespaceFields: [],
        trimFields: [],
    },
];

describe.each(schemas)(
    '$name',
    ({
        schema,
        validInput,
        requiredFields,
        emptyStringFields,
        whitespaceFields,
        trimFields,
    }) => {
        it('should accept valid input', () => {
            const result = schema.safeParse(validInput);
            expect(result.success).toBe(true);
            expect((result as { data: unknown }).data).toEqual(validInput);
        });

        it.each(requiredFields)(
            'should reject when %s is missing',
            field => {
                const { [field]: _, ...rest } =
                    validInput as Record<string, unknown>;
                const result = schema.safeParse(rest);
                expect(result.success).toBe(false);
                expect(
                    hasIssueForField(
                        (result as unknown as ParseFailure).error.issues,
                        field,
                    ),
                ).toBe(true);
            },
        );

        it.each(emptyStringFields)(
            'should reject empty %s string',
            field => {
                const result = schema.safeParse({ ...validInput, [field]: '' });
                expect(result.success).toBe(false);
            },
        );

        if (whitespaceFields.length > 0) {
            it.each(whitespaceFields)(
                'should reject whitespace-only %s',
                field => {
                    const result = schema.safeParse({
                        ...validInput,
                        [field]: '   ',
                    });
                    expect(result.success).toBe(false);
                },
            );
        }

        if (trimFields.length > 0) {
            it('should trim name fields', () => {
                const input: Record<string, unknown> = { ...validInput };
                for (const { field, raw } of trimFields) {
                    input[field] = raw;
                }
                const result = schema.safeParse(input);
                expect(result.success).toBe(true);
                const data = (result as { data: Record<string, unknown> }).data;
                for (const { field, trimmed } of trimFields) {
                    expect(data[field]).toBe(trimmed);
                }
            });
        }

        it('should strip extra fields', () => {
            const result = schema.safeParse({ ...validInput, extra: 'data' });
            expect(result.success).toBe(true);
            expect((result as { data: unknown }).data).toEqual(validInput);
        });

        if (requiredFields.length > 1) {
            it('should report all missing fields at once', () => {
                const result = schema.safeParse({});
                expect(result.success).toBe(false);
                const paths = getIssuePaths(
                    (result as unknown as ParseFailure).error.issues,
                );
                for (const field of requiredFields) {
                    expect(paths).toContain(field);
                }
            });
        }
    },
);

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

    it.each([
        { field: 'firstName', value: 'Jane' },
        { field: 'lastName', value: 'Smith' },
    ])('should accept input with only $field', ({ field, value }) => {
        const result = UpdateProfileRequestSchema.safeParse({ [field]: value });
        expect(result.success).toBe(true);
        expect(
            (result as { data: Record<string, unknown> }).data[field],
        ).toBe(value);
    });

    it('should reject when both fields are missing', () => {
        const result = UpdateProfileRequestSchema.safeParse({});
        expect(result.success).toBe(false);
        const messages = (
            result as unknown as ParseFailure
        ).error.issues.map(i => i.message);
        expect(messages).toContain(
            'At least one field (firstName or lastName) is required',
        );
    });

    it.each(['firstName', 'lastName'])(
        'should reject empty %s string',
        field => {
            const result = UpdateProfileRequestSchema.safeParse({
                [field]: '',
            });
            expect(result.success).toBe(false);
        },
    );

    it.each(['firstName', 'lastName'])(
        'should reject whitespace-only %s',
        field => {
            const result = UpdateProfileRequestSchema.safeParse({
                [field]: '   ',
            });
            expect(result.success).toBe(false);
        },
    );

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
});
