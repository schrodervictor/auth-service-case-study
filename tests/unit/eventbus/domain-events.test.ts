import { DomainEvents } from '../../../src/eventbus/domain-events';

describe('DomainEvents', () => {
    it('should have TEST_EVENT', () => {
        expect(DomainEvents.TEST_EVENT).toBe('TEST_EVENT');
    });

    it('should be a const object', () => {
        expect(typeof DomainEvents).toBe('object');
    });
});
