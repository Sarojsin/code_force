import * as Sentry from '@sentry/react-native';
import { useOfflineStore } from 'src/stores/offlineStore';

export function initSyncBreadcrumbs() {
  useOfflineStore.subscribe((state, prevState) => {
    if (state.operations.length > prevState.operations.length) {
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `Operation queued: ${state.operations[state.operations.length - 1]?.type}`,
        level: 'info',
        data: { queueSize: state.operations.length },
      });
    }

    if (state.operations.length < prevState.operations.length) {
      const count = prevState.operations.length - state.operations.length;
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `${count} operation(s) synced successfully`,
        level: 'info',
        data: {
          queueSizeBefore: prevState.operations.length,
          queueSizeAfter: state.operations.length,
        },
      });
    }
  });
}
