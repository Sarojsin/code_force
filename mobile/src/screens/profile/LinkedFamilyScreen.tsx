/**
 * LinkedFamilyScreen — view linked family members and permissions.
 */

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Button, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  permissions: ('view_cycle' | 'view_sos' | 'view_journal' | 'receive_alerts')[];
}

const MOCK_MEMBERS: FamilyMember[] = [
  { id: '1', name: 'Mom', phone: '+1234567890', relationship: 'Mother', permissions: ['view_sos', 'receive_alerts'] },
  { id: '2', name: 'Sarah', phone: '+1234567891', relationship: 'Sister', permissions: ['view_cycle', 'view_sos', 'receive_alerts'] },
];

const permLabels: Record<string, string> = {
  view_cycle: 'View cycle data',
  view_sos: 'View SOS alerts',
  view_journal: 'Read journal',
  receive_alerts: 'Receive alerts',
};

export function LinkedFamilyScreen() {
  const theme = useTheme();

  const renderItem = ({ item }: { item: FamilyMember }) => (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`${item.name}, ${item.relationship}`}>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
          <Txt variant="h3" color="primary">{item.name.charAt(0)}</Txt>
        </View>
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Txt variant="h3">{item.name}</Txt>
          <Txt variant="bodySmall" color="secondary">{item.relationship} &middot; {item.phone}</Txt>
          <View style={styles.permissions}>
            {item.permissions.map(p => (
              <View key={p} style={[styles.permBadge, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.sm }]}>
                <Txt variant="caption" color="primary">{permLabels[p]}</Txt>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_MEMBERS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Linked Family</Txt>
            <Txt variant="body" color="secondary">Family members connected to your account.</Txt>
          </View>
        }
        ListFooterComponent={
          <Button label="Link new member" variant="outline" fullWidth style={{ marginTop: theme.spacing.md }} />
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No family members linked yet.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  permissions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  permBadge: { paddingHorizontal: 8, paddingVertical: 2 },
});
