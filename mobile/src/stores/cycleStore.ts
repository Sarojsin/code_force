import { create } from 'zustand';
import { EncryptedStorage } from 'src/services/storage';

interface CycleState {
  localCorrectionDelta: number;
  deltaPredictionId: string | null;
  lastPredictedStart: string | null;
}

interface CycleActions {
  setLocalCorrection: (delta: number, predictionId: string) => void;
  resetLocalDelta: () => void;
  loadPersistedDelta: () => Promise<void>;
}

async function persistDelta(delta: number) {
  try {
    await EncryptedStorage.setItem('local_correction_delta', String(delta));
  } catch {
    // fail silently
  }
}

export const useCycleStore = create<CycleState & CycleActions>((set) => ({
  localCorrectionDelta: 0,
  deltaPredictionId: null,
  lastPredictedStart: null,

  setLocalCorrection: (delta, predictionId) => {
    set({ localCorrectionDelta: delta, deltaPredictionId: predictionId });
    persistDelta(delta);
  },

  resetLocalDelta: () => {
    set({ localCorrectionDelta: 0, deltaPredictionId: null, lastPredictedStart: null });
    persistDelta(0);
  },

  loadPersistedDelta: async () => {
    try {
      const stored = await EncryptedStorage.getItem('local_correction_delta');
      if (stored !== null) {
        set({ localCorrectionDelta: parseFloat(stored) });
      }
    } catch {
      // fail silently
    }
  },
}));
