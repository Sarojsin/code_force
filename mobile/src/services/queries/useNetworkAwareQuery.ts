import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { useNetworkStatus } from 'src/services/sync';
import { isNetworkError } from 'src/services/sync/isNetworkError';

interface NetworkAwareResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  hasContent: boolean;
  isOffline: boolean;
  isServerError: boolean;
  refetch: () => Promise<any>;
}

export function useNetworkAwareQuery<T>(
  options: UseQueryOptions<T> & { queryKey: any[]; queryFn: any }
): NetworkAwareResult<T> {
  const { isConnected } = useNetworkStatus();
  const query = useQuery(options);

  const isOffline = !isConnected;
  const isServerError = !isOffline && !!query.error && !isNetworkError(query.error);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    hasContent: !!query.data && (Array.isArray(query.data) ? query.data.length > 0 : true),
    isOffline,
    isServerError,
    refetch: query.refetch,
  };
}
