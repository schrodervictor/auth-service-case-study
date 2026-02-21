/**
 * Unit test example — no external dependencies required.
 * Run with: npm run test:unit
 */
describe('Unit test example', () => {
    describe('Array.prototype.includes', () => {
        it('returns true when the element exists', () => {
            expect([1, 2, 3].includes(2)).toBe(true);
        });

        it('returns false when the element does not exist', () => {
            expect([1, 2, 3].includes(4)).toBe(false);
        });
    });

    describe('JSON round-trip', () => {
        it('preserves object structure through serialization', () => {
            const original = { name: 'test', value: 42, nested: { ok: true } };
            const result = JSON.parse(JSON.stringify(original));
            expect(result).toEqual(original);
        });
    });
});
