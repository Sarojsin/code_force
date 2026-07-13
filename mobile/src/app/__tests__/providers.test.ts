import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => {}),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => {}),
  clear: jest.fn(async () => {}),
}));

describe('persistQueryClient', () => {
  it('restores cached data from AsyncStorage on app start', async () => {
    const cacheData = JSON.stringify({
      clientState: {
        '["cycle","calendar"]': {
          state: { data: { days: ['2025-01-01'] } },
        },
      },
    });

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(cacheData);

    const qc = new QueryClient();
    const persister = createAsyncStoragePersister({
      storage: AsyncStorage,
      key: 'REACT_QUERY_OFFLINE_CACHE',
      throttleTime: 1000,
    });

    await persistQueryClient({
      queryClient: qc,
      persister,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      buster: 'v1',
    });

    const data = qc.getQueryData(['cycle', 'calendar']);
    expect(data).toEqual({ days: ['2025-01-01'] });
  });
});
