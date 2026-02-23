import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const EVENTBUS_PATH = process.env.EVENTBUS_PATH ?? '/tmp/eventbus/events.jsonl';

interface EventbusEntry {
    topic: string;
    type: string;
    data: Record<string, unknown>;
}

/**
 * Clear the eventbus output file. Call before tests to avoid stale events.
 */
export function clearEventbusFile(): void {
    writeFileSync(EVENTBUS_PATH, '');
}

/**
 * Extract the plain reset key for a given email from the eventbus output.
 * Returns the most recent reset key for that email, or null if not found.
 */
export function getResetKeyForEmail(email: string): string | null {
    if (!existsSync(EVENTBUS_PATH)) return null;

    const content = readFileSync(EVENTBUS_PATH, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Search from the end (most recent first)
    for (let i = lines.length - 1; i >= 0; i--) {
        const entry: EventbusEntry = JSON.parse(lines[i]);
        if (
            entry.type === 'PASSWORD_RESET_REQUESTED' &&
            (entry.data as { email: string }).email === email
        ) {
            return (entry.data as { resetKey: string }).resetKey;
        }
    }

    return null;
}
