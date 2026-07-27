import { create } from 'zustand';

export type DownloadState =
  | 'idle'
  | 'checking_wifi'
  | 'downloading'
  | 'extracting'
  | 'verifying'
  | 'ready'
  | 'error'
  | 'paused';

interface DownloadStore {
  state: DownloadState;
  progress: number;
  errorMessage: string | null;
  bytesDownloaded: number;
  totalBytes: number;

  setState: (state: DownloadState) => void;
  setProgress: (progress: number) => void;
  setError: (message: string) => void;
  setBytes: (downloaded: number, total: number) => void;
  reset: () => void;
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  state: 'idle',
  progress: 0,
  errorMessage: null,
  bytesDownloaded: 0,
  totalBytes: 0,

  setState: (state) => set({ state }),
  setProgress: (progress) => set({ progress }),
  setError: (message) => set({ state: 'error', errorMessage: message }),
  setBytes: (downloaded, total) => set({ bytesDownloaded: downloaded, totalBytes: total }),
  reset: () => set({
    state: 'idle',
    progress: 0,
    errorMessage: null,
    bytesDownloaded: 0,
    totalBytes: 0,
  }),
}));
