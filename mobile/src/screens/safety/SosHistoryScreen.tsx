import React, { useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Skeleton, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useSosHistory } from 'src/services/queries';

const statusColors = { cancelled: '#FEF3C7', resolved: '#D1FAE5', active: '#FEE2E2' } as const;

type SosAlert = { id: string; triggered_at: string; cancelled_at: string | null; resolved_at: string | null; sms_status: string; manual_intervention_needed: boolean; latitude: number; longitude: number };

function getStatus(alert: { cancelled_at: string | null; resolved_at: string | null }): 'cancelled' | 'resolved' | 'active' {
  if (alert.cancelled_at) return 'cancelled';
  if (alert.resolved_at) return 'resolved';
  return 'active';
}

const SosCard = React.memo(function SosCard({ item }: { item: SosAlert }) {
  const theme = useTheme();
  const status = getStatus(item);
  return (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`SOS alert from ${new Date(item.triggered_at).toLocaleString()}`}>
      <View style={styles.row}>
        <View style={[styles.statusDot, { backgroundColor: statusColors[status], borderRadius: theme.radius.pill }]}>
          <Txt variant="caption" color="primary" align="center">&#9679;</Txt>
        </View>
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <View style={styles.topRow}>
            <Txt variant="h3" color={status === 'active' ? 'danger' : 'primary'}>
              {new Date(item.triggered_at).toLocaleDateString()}
            </Txt>
            <Txt variant="caption" color="muted">{status}</Txt>
          </View>
          <Txt variant="bodySmall" color="secondary">SMS: {item.sms_status}</Txt>
          {item.manual_intervention_needed && (
            <Txt variant="caption" color="danger">Manual intervention needed</Txt>
          )}
        </View>
      </View>
    </Card>
  );
});

export function SosHistoryScreen() {
  const theme = useTheme();
  const { data: alerts, isLoading } = useSosHistory();

  const renderItem = useCallback(({ item }: { item: SosAlert }) => (
    <SosCard item={item} />
  ), []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={alerts ?? []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshing={isLoading}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={7}
        ListHeaderComponent={useMemo(() => (
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">SOS History</Txt>
            <Txt variant="body" color="secondary">Your past emergency alerts.</Txt>
          </View>
        ), [])}
        ListEmptyComponent={useMemo(() => (
          isLoading ? (
            <View style={{ padding: theme.spacing.lg }}>
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} style={{ marginBottom: 12 }} />
              <Skeleton height={80} />
            </View>
          ) : (
            <Card><Txt variant="body" color="secondary" align="center">No SOS alerts triggered.</Txt></Card>
          )
        ), [isLoading])}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  statusDot: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
