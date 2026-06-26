/**
 * AdminDashboardScreen — admin dashboard with analytics.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

const STATS = [
  { label: 'Total Users', value: '1,247', change: '+12%', color: '#D1FAE5' },
  { label: 'Active Today', value: '342', change: '+5%', color: '#BFDBFE' },
  { label: 'SOS Alerts (7d)', value: '8', change: '-2%', color: '#FEE2E2' },
  { label: 'Avg Session', value: '14m', change: '+8%', color: '#EDE9FE' },
];

const RECENT_ACTIVITY = [
  { action: 'New user registered', time: '2m ago', user: 'user@example.com' },
  { action: 'SOS triggered', time: '15m ago', user: 'user_0421' },
  { action: 'Content published', time: '1h ago', user: 'nurse_admin' },
  { action: 'Account flagged', time: '3h ago', user: 'user_0387' },
];

export function AdminDashboardScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Admin Dashboard</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Platform overview and moderation tools.</Txt>

        <View style={styles.statsGrid}>
          {STATS.map(stat => (
            <Card key={stat.label} style={[styles.statCard, { backgroundColor: stat.color, borderColor: 'transparent' }]} padded>
              <Txt variant="h2" style={{ marginBottom: 2 }}>{stat.value}</Txt>
              <Txt variant="caption" color="secondary">{stat.label}</Txt>
              <Txt variant="caption" color={stat.change.startsWith('+') ? 'success' : 'danger'}>{stat.change}</Txt>
            </Card>
          ))}
        </View>

        <Card style={{ marginTop: theme.spacing.lg }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Recent Activity</Txt>
          {RECENT_ACTIVITY.map((item, i) => (
            <View key={i} style={[styles.activityRow, i < RECENT_ACTIVITY.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <Txt variant="bodySmall">{item.action}</Txt>
                <Txt variant="caption" color="muted">{item.user}</Txt>
              </View>
              <Txt variant="caption" color="muted">{item.time}</Txt>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { width: '48%', marginBottom: 12, minHeight: 90 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
});
