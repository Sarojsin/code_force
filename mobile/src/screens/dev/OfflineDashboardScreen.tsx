import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { useOfflineStore } from 'src/stores/offlineStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';
import { useNetworkStatus } from 'src/services/sync';
import { syncAll } from 'src/services/sync/syncEngine';
import { Card, Text, Button } from 'src/components/ui';
import { useTheme } from 'src/theme';

export function OfflineDashboardScreen() {
  const { isConnected, connectionType } = useNetworkStatus();
  const operations = useOfflineStore((s) => s.operations);
  const lastSyncAt = useSyncMetricsStore((s) => s.lastSyncAt);
  const lastSyncStatus = useSyncMetricsStore((s) => s.lastSyncStatus);
  const lastSyncDuration = useSyncMetricsStore((s) => s.lastSyncDuration);
  const totalSyncCycles = useSyncMetricsStore((s) => s.totalSyncCycles);
  const failedSyncCycles = useSyncMetricsStore((s) => s.failedSyncCycles);
  const totalOpsPushed = useSyncMetricsStore((s) => s.totalOpsPushed);
  const maxQueueSize = useSyncMetricsStore((s) => s.maxQueueSize);
  const theme = useTheme();

  const handleForceSync = useCallback(async () => {
    Toast.show({ type: 'info', text1: 'Syncing...' });
    try {
      await syncAll();
      Toast.show({ type: 'success', text1: 'Sync completed' });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync failed', text2: e?.message });
    }
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text variant="h1">Sync Dashboard</Text>

        <Card style={{ marginTop: 16 }}>
          <Text variant="h3">Network</Text>
          <Text>Connected: {isConnected ? 'Yes' : 'No'}</Text>
          <Text>Type: {connectionType || 'N/A'}</Text>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text variant="h3">Queue</Text>
          <Text>Pending operations: {operations.length}</Text>
          {operations.map((op) => (
            <View key={op.id} style={[styles.opItem, { backgroundColor: theme.colors.surface }]}>
              <Text variant="bodySmall">Type: {op.type}</Text>
              <Text variant="bodySmall">Priority: {op.priority}</Text>
              <Text variant="bodySmall">Retries: {op.retryCount}/{op.maxRetries}</Text>
              <Text variant="bodySmall">Created: {new Date(op.createdAt).toLocaleString()}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text variant="h3">Metrics</Text>
          <Text>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'Never'}</Text>
          <Text>Last status: {lastSyncStatus || 'N/A'}</Text>
          <Text>Last duration: {lastSyncDuration ? `${lastSyncDuration}ms` : 'N/A'}</Text>
          <Text>Total cycles: {totalSyncCycles}</Text>
          <Text>Failed: {failedSyncCycles}</Text>
          <Text>Ops pushed: {totalOpsPushed}</Text>
          <Text>Max queue: {maxQueueSize}</Text>
        </Card>

        <View style={{ marginTop: 16, gap: 8 }}>
          <Button label="Force Sync" onPress={handleForceSync} variant="primary" />
          <Button label="Clear Queue" onPress={() => useOfflineStore.getState().clear()} variant="outline" />
          <Button label="Reset Metrics" onPress={() => useSyncMetricsStore.getState().reset()} variant="outline" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  opItem: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
  },
});
