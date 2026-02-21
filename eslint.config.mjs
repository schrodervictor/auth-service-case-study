import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        rules: {
            'indent': ['error', 4],
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },
    {
        files: ['tests/**/*.ts'],
        plugins: { jest },
        rules: {
            ...jest.configs.recommended.rules,
        },
    },
    {
        files: ['src/typeormconfig.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'coverage/'],
    },
);
