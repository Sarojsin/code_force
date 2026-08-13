import { logger } from '../logger';

describe('logger scrub', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('surfaces the cause chain so wrapped DB errors are not masked', () => {
    const native = new Error('Error code 5: database is locked');
    (native as any).code = 'ERR_INTERNAL_SQLITE_ERROR';
    const wrapped = new Error('Failed query: insert into "mood_logs"...', { cause: native });

    logger.error('mood_logs.upsertMany failed', wrapped);

    const [prefix, payload] = consoleErrorSpy.mock.calls[0];
    expect(prefix).toBe('mood_logs.upsertMany failed');
    expect(payload).toMatchObject({
      message: expect.stringContaining('Failed query'),
      name: 'Error',
      cause: {
        message: 'Error code 5: database is locked',
        name: 'Error',
        code: 'ERR_INTERNAL_SQLITE_ERROR',
      },
    });
  });

  it('does not leak non-whitelisted fields from a nested cause', () => {
    const inner = new Error('boom');
    (inner as any).notes = 'private medical note';
    const wrapped = new Error('outer', { cause: inner });

    logger.error('x.failed', wrapped);

    const [, payload] = consoleErrorSpy.mock.calls[0];
    expect(payload.cause.notes).toBeUndefined();
    expect(payload.cause.message).toBe('boom');
  });

  it('stops recursing past the cause chain limit', () => {
    const leaf = new Error('leaf');
    const mid = new Error('mid', { cause: leaf });
    const top = new Error('top', { cause: mid });

    logger.error('x.failed', top);

    const [, payload] = consoleErrorSpy.mock.calls[0];
    expect(payload.cause.cause.cause).toBeUndefined();
  });
});
