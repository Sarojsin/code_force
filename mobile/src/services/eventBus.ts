type EventMap = {
  period_logged: { userId: string; cycleEntryId: string; date: string };
  period_corrected: { userId: string; cycleEntryId: string; correction: unknown };
  period_approaching: { userId: string; daysUntil: number };
  period_end_marked: { userId: string; cycleEntryId: string };

  journal_saved: { userId: string; journalId: string; sentiment?: string };
  mood_logged: { userId: string; moodLogId: string; mood: string; intensity: number };
  water_logged: { userId: string; amount: number };
  food_logged: { userId: string; mealType: string; notes?: string };
  exercise_completed: { userId: string; type: string; duration: number };
  exercise_logged: { userId: string; type: string; duration: number };
  medication_logged: { userId: string; name: string; taken: boolean };
  sleep_logged: { userId: string; hours: number };

  sos_triggered: { userId: string; sosId: string };

  luna_petted: { userId: string };
  luna_outfit_changed: { userId: string; outfitId: string | null };
  luna_animation_changed: { state: string };
  luna_installed: { userId: string };
  luna_uninstalled: { userId: string };

  diary_assets_installed: { userId: string; version: string };
  diary_assets_uninstalled: { userId: string };

  diary_page_created: { userId: string; diaryId: string; pageId: string; page_date: string };
  diary_photo_added: { userId: string; mediaId: string; mimeType?: string };
  diary_page_saved: { userId: string; diaryId: string; pageId: string };
  diary_opened: { userId: string; diaryId: string; pageId: string };
  diary_media_synced: { userId: string; mediaId: string; s3Key?: string };

  day_logged: { userId: string; logDate: string; mood?: string | null; moodIntensity?: number | null };

  app_foregrounded: {};
  app_backgrounded: {};
  onboarding_completed: { userId: string };
};

type EventName = keyof EventMap;
type EventPayload<N extends EventName> = EventMap[N];
type Listener<N extends EventName> = (payload: EventPayload<N>) => void;

class EventBus {
  private listeners = new Map<EventName, Set<Listener<any>>>();

  on<N extends EventName>(event: N, listener: Listener<N>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.off(event, listener);
  }

  once<N extends EventName>(event: N, listener: Listener<N>): () => void {
    const wrapper: Listener<N> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  off<N extends EventName>(event: N, listener?: Listener<N>): void {
    if (listener) {
      this.listeners.get(event)?.delete(listener);
    } else {
      this.listeners.delete(event);
    }
  }

  emit<N extends EventName>(event: N, payload: EventPayload<N>): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[EventBus] Error in listener for "${event}":`, error);
      }
    });
  }

  clear(): void {
    this.listeners.clear();
  }

  listenerCount<N extends EventName>(event: N): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const eventBus = new EventBus();
export type { EventMap, EventName, EventPayload, Listener };
