// diaryEvents.test.ts — luna2 phase5 §1.0 emitter existence + payload tests.
// Guards against silent no-ops: every diary event string lives in the diary
// service source, is wired from a real mutation point, and actually fires on
// the event bus.

import * as fs from 'fs';
import * as path from 'path';

import { eventBus } from '../../services/eventBus';
import { useAuthStore } from 'src/stores/authStore';
import {
  emitDiaryPageCreated,
  emitDiaryPhotoAdded,
  emitDiaryPageSaved,
  emitDiaryOpened,
  emitDiaryMediaSynced,
  DIARY_EVENT_NAMES,
} from '../../services/diary/diaryEvents';

describe('diary event emitters', () => {
  const fired: string[] = [];
  const payloads: Record<string, any> = {};
  let subs: (() => void)[] = [];

  beforeEach(() => {
    fired.length = 0;
    for (const k of Object.keys(payloads)) delete payloads[k];
    useAuthStore.setState({ user: null });
    subs = DIARY_EVENT_NAMES.map((name) =>
      eventBus.on(name, (p) => {
        fired.push(name);
        payloads[name] = p;
      }),
    );
  });

  afterEach(() => {
    subs.forEach((u) => u());
    subs = [];
    eventBus.clear();
    useAuthStore.setState({ user: null });
  });

  it('every emitter fires the matching event with the correct payload', () => {
    emitDiaryPageCreated({ userId: 'u1', diaryId: 'd1', pageId: 'p1', page_date: '2026-08-06' });
    emitDiaryPhotoAdded({ userId: 'u1', mediaId: 'm1', mimeType: 'image/jpeg' });
    emitDiaryPageSaved({ userId: 'u1', diaryId: 'd1', pageId: 'p1' });
    emitDiaryOpened({ userId: 'u1', diaryId: 'd1', pageId: 'p1' });
    emitDiaryMediaSynced({ userId: 'u1', mediaId: 'm1', s3Key: 'k' });

    expect(fired).toEqual([
      'diary_page_created',
      'diary_photo_added',
      'diary_page_saved',
      'diary_opened',
      'diary_media_synced',
    ]);

    expect(payloads.diary_page_created).toEqual({
      userId: 'u1',
      diaryId: 'd1',
      pageId: 'p1',
      page_date: '2026-08-06',
    });
    expect(payloads.diary_photo_added).toEqual({
      userId: 'u1',
      mediaId: 'm1',
      mimeType: 'image/jpeg',
    });
    expect(payloads.diary_page_saved).toEqual({ userId: 'u1', diaryId: 'd1', pageId: 'p1' });
    expect(payloads.diary_opened).toEqual({ userId: 'u1', diaryId: 'd1', pageId: 'p1' });
    expect(payloads.diary_media_synced).toEqual({ userId: 'u1', mediaId: 'm1', s3Key: 'k' });
  });

  it('resolves userId from the auth store when not supplied', () => {
    useAuthStore.setState({ user: { id: 'auth-user', email: 'a@b.c' } as any });

    emitDiaryPageSaved({ diaryId: 'd1', pageId: 'p1' });

    expect(fired).toEqual(['diary_page_saved']);
    expect(payloads.diary_page_saved.userId).toBe('auth-user');
  });

  it('silently no-ops (never throws) when there is no authenticated user', () => {
    expect(() => {
      emitDiaryPageCreated({ diaryId: 'd1', pageId: 'p1', page_date: '2026-08-06' });
      emitDiaryPhotoAdded({ mediaId: 'm1' });
      emitDiaryPageSaved({ diaryId: 'd1', pageId: 'p1' });
      emitDiaryOpened({ diaryId: 'd1', pageId: 'p1' });
      emitDiaryMediaSynced({ mediaId: 'm1' });
    }).not.toThrow();

    expect(fired).toEqual([]);
  });

  it('guarded emit never throws when a listener throws', () => {
    const boom = eventBus.on('diary_page_created', () => {
      throw new Error('listener exploded');
    });

    expect(() => emitDiaryPageCreated({ userId: 'u1', diaryId: 'd1', pageId: 'p1', page_date: '2026-08-06' })).not.toThrow();
    boom();
  });

  it('every diary event string lives in the diary service source', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../services/diary/diaryEvents.ts'), 'utf-8');
    for (const name of DIARY_EVENT_NAMES) {
      expect(src).toContain(`'${name}'`);
    }
  });

  it('every emitter helper is wired from a real diary mutation point', () => {
    const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), 'utf-8');

    const pageCreate = read('../../services/queries/diary.ts');
    expect(pageCreate).toContain('emitDiaryPageCreated');

    const upload = read('../../services/diary/useDiaryMediaUpload.ts');
    expect(upload).toContain('emitDiaryPhotoAdded');
    expect(upload).toContain('emitDiaryMediaSynced');

    const editor = read('../../screens/diary/DiaryEditorScreen.tsx');
    expect(editor).toContain('emitDiaryPageSaved');

    const pageScreen = read('../../screens/diary/DiaryPageScreen.tsx');
    expect(pageScreen).toContain('emitDiaryOpened');
  });
});
