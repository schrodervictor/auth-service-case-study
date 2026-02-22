/**
 * Test helper that silences and captures console output.
 *
 * Usage:
 *   const captured = silenceConsole('log', 'error');
 *   // ... code that logs ...
 *   expect(captured.log).toContainEqual(expect.stringContaining('expected'));
 *   captured.restore();
 *
 * Or with auto-restore in beforeEach/afterEach:
 *   let captured: CapturedConsole;
 *   beforeEach(() => { captured = silenceConsole('log'); });
 *   afterEach(() => { captured.restore(); });
 */

type ConsoleMethod = 'log' | 'error' | 'warn';

export interface CapturedConsole {
    readonly log: string[];
    readonly error: string[];
    readonly warn: string[];
    restore(): void;
}

export function silenceConsole(...methods: ConsoleMethod[]): CapturedConsole {
    const captured: CapturedConsole = {
        log: [],
        error: [],
        warn: [],
        restore: () => {
            for (const spy of spies) {
                spy.mockRestore();
            }
        },
    };

    const spies: jest.SpyInstance[] = [];

    for (const method of methods) {
        const spy = jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
            captured[method].push(args.map(String).join(' '));
        });
        spies.push(spy);
    }

    return captured;
}
