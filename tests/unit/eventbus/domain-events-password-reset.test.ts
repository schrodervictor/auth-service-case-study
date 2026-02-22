import { DomainEvents } from '../../../src/eventbus/domain-events';

describe('DomainEvents — PASSWORD_RESET_REQUESTED', () => {
    it('should have PASSWORD_RESET_REQUESTED constant', () => {
        expect(DomainEvents.PASSWORD_RESET_REQUESTED).toBe('PASSWORD_RESET_REQUESTED');
    });

    it('should have PASSWORD_RESET_REQUESTED as a string value', () => {
        expect(typeof DomainEvents.PASSWORD_RESET_REQUESTED).toBe('string');
    });
});
