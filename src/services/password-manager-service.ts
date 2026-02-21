import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { injectable } from 'inversify';
import { promisify } from 'util';

export interface PasswordManagerService {
    toHash(password: string): Promise<string>;
    compare(storedPassword: string, suppliedPassword: string): Promise<boolean>;
}

const scryptAsync = promisify(scrypt);
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

/**
 * A utility class to hash user password before storing in DB
 * and compares user supplied password with the stored hash
 */
@injectable()
export class PasswordManagerServiceImpl implements PasswordManagerService {
    async toHash(password: string): Promise<string> {
        const salt = randomBytes(SALT_LENGTH);
        const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
        return `${salt.toString('hex')}.${derivedKey.toString('hex')}`;
    }

    async compare(storedPassword: string, suppliedPassword: string): Promise<boolean> {
        try {
            const parts = storedPassword.split('.');
            if (parts.length !== 2) {
                return false;
            }

            const [saltHex, storedKeyHex] = parts;
            const salt = Buffer.from(saltHex, 'hex');
            const storedKey = Buffer.from(storedKeyHex, 'hex');
            const derivedKey = (await scryptAsync(suppliedPassword, salt, KEY_LENGTH)) as Buffer;

            if (storedKey.length !== derivedKey.length) {
                return false;
            }

            return timingSafeEqual(derivedKey, storedKey);
        } catch {
            return false;
        }
    }
}
