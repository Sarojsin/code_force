import { eventBus } from '../eventBus';

describe('EventBus', () => {
  beforeEach(() => eventBus.clear());

  it('emits and receives an event', () => {
    const listener = jest.fn();
    eventBus.on('journal_saved', listener);
    eventBus.emit('journal_saved', { userId: 'u1', journalId: 'j1' });
    expect(listener).toHaveBeenCalledWith({ userId: 'u1', journalId: 'j1' });
  });

  it('supports multiple listeners on same event', () => {
    const a = jest.fn();
    const b = jest.fn();
    eventBus.on('mood_logged', a);
    eventBus.on('mood_logged', b);
    eventBus.emit('mood_logged', { userId: 'u1', moodLogId: 'm1', mood: 'happy', intensity: 3 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes specific listener', () => {
    const a = jest.fn();
    const unsub = eventBus.on('period_logged', a);
    unsub();
    eventBus.emit('period_logged', { userId: 'u1', cycleEntryId: 'c1', date: '2026-07-25' });
    expect(a).not.toHaveBeenCalled();
  });

  it('once fires only once', () => {
    const listener = jest.fn();
    eventBus.once('period_approaching', listener);
    eventBus.emit('period_approaching', { userId: 'u1', daysUntil: 3 });
    eventBus.emit('period_approaching', { userId: 'u1', daysUntil: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clear removes all listeners', () => {
    eventBus.on('journal_saved', jest.fn());
    eventBus.on('mood_logged', jest.fn());
    eventBus.clear();
    expect(eventBus.listenerCount('journal_saved')).toBe(0);
    expect(eventBus.listenerCount('mood_logged')).toBe(0);
  });

  it('off with no listener removes all for that event', () => {
    eventBus.on('sos_triggered', jest.fn());
    eventBus.on('sos_triggered', jest.fn());
    eventBus.off('sos_triggered');
    expect(eventBus.listenerCount('sos_triggered')).toBe(0);
  });

  it('listener error does not crash other listeners', () => {
    const a = jest.fn(() => { throw new Error('boom'); });
    const b = jest.fn();
    eventBus.on('luna_petted', a);
    eventBus.on('luna_petted', b);
    expect(() => eventBus.emit('luna_petted', { userId: 'u1' })).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
