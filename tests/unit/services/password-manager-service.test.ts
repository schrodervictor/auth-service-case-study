import 'reflect-metadata';

import { PasswordManagerServiceImpl } from '../../../src/services/password-manager-service';

describe('PasswordManagerServiceImpl', () => {
    let service: PasswordManagerServiceImpl;

    beforeEach(() => {
        service = new PasswordManagerServiceImpl();
    });

    describe('toHash', () => {
        it('should return a string with exactly one dot delimiter', async () => {
            const hash = await service.toHash('password123');

            const parts = hash.split('.');
            expect(parts).toHaveLength(2);
        });

        it('should return valid hex strings for both parts', async () => {
            const hash = await service.toHash('password123');
            const [salt, key] = hash.split('.');

            expect(salt).toMatch(/^[0-9a-f]+$/);
            expect(key).toMatch(/^[0-9a-f]+$/);
        });

        it('should return a salt of 64 hex characters (32 bytes)', async () => {
            const hash = await service.toHash('password123');
            const [salt] = hash.split('.');

            expect(salt).toHaveLength(64);
        });

        it('should return a key of 128 hex characters (64 bytes)', async () => {
            const hash = await service.toHash('password123');
            const [, key] = hash.split('.');

            expect(key).toHaveLength(128);
        });

        it('should produce different hashes for the same password (random salt)', async () => {
            const hash1 = await service.toHash('password123');
            const hash2 = await service.toHash('password123');

            expect(hash1).not.toBe(hash2);
        });

        it('should produce a valid hash for an empty string password', async () => {
            const hash = await service.toHash('');
            const parts = hash.split('.');

            expect(parts).toHaveLength(2);
            expect(parts[0]).toHaveLength(64);
            expect(parts[1]).toHaveLength(128);
        });
    });

    describe('compare', () => {
        it('should return true for a matching password', async () => {
            const hash = await service.toHash('correctPassword');

            const result = await service.compare(hash, 'correctPassword');

            expect(result).toBe(true);
        });

        it('should return false for a wrong password', async () => {
            const hash = await service.toHash('correctPassword');

            const result = await service.compare(hash, 'wrongPassword');

            expect(result).toBe(false);
        });

        it('should return false for an empty supplied password', async () => {
            const hash = await service.toHash('correctPassword');

            const result = await service.compare(hash, '');

            expect(result).toBe(false);
        });

        it('should return false for a malformed stored password (no dot)', async () => {
            const result = await service.compare('nodothere', 'password');

            expect(result).toBe(false);
        });

        it('should return false for a stored password with wrong-length key hex', async () => {
            // Valid salt (64 hex chars) but truncated key
            const fakeSalt = 'a'.repeat(64);
            const shortKey = 'b'.repeat(64); // Should be 128
            const malformed = `${fakeSalt}.${shortKey}`;

            const result = await service.compare(malformed, 'password');

            expect(result).toBe(false);
        });

        it('should return false for a stored password with invalid hex characters', async () => {
            const invalidSalt = 'g'.repeat(64); // 'g' is not valid hex
            const invalidKey = 'z'.repeat(128);
            const malformed = `${invalidSalt}.${invalidKey}`;

            const result = await service.compare(malformed, 'password');

            expect(result).toBe(false);
        });

        it('should return false for an empty stored password string', async () => {
            const result = await service.compare('', 'password');

            expect(result).toBe(false);
        });
    });

    describe('round-trip', () => {
        it('should return true when comparing with the correct password', async () => {
            const password = 'mySecurePassword!';
            const hash = await service.toHash(password);

            expect(await service.compare(hash, password)).toBe(true);
        });

        it('should return false when comparing with an incorrect password', async () => {
            const password = 'mySecurePassword!';
            const hash = await service.toHash(password);

            expect(await service.compare(hash, 'differentPassword')).toBe(
                false,
            );
        });

        it('should work with special characters (unicode, spaces, symbols)', async () => {
            const password = '🔒 pässwörd! @#$%^&*() 你好';
            const hash = await service.toHash(password);

            expect(await service.compare(hash, password)).toBe(true);
            expect(await service.compare(hash, 'wrong')).toBe(false);
        });

        it('should work with very long passwords (1000+ characters)', async () => {
            const password = 'a'.repeat(1500);
            const hash = await service.toHash(password);

            expect(await service.compare(hash, password)).toBe(true);
            expect(await service.compare(hash, 'b'.repeat(1500))).toBe(false);
        });
    });
});
