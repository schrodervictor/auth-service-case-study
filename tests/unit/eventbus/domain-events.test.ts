import { DomainEvents } from '../../../src/eventbus/domain-events';

describe('DomainEvents', () => {
    it('should be a const object', () => {
        expect(typeof DomainEvents).toBe('object');
    });

    it('should have TEST_EVENT', () => {
        expect(DomainEvents.TEST_EVENT).toBe('TEST_EVENT');
    });

    it('should have PASSWORD_RESET_REQUESTED', () => {
        expect(DomainEvents.PASSWORD_RESET_REQUESTED).toBe(
            'PASSWORD_RESET_REQUESTED',
        );
    });
});
