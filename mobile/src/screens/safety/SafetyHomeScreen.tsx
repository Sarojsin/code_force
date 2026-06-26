import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useEmergencyContacts, useActiveSos } from 'src/services/queries';
import type { SafetyStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<SafetyStackParamList, 'SafetyHome'>;

export function SafetyHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: contacts } = useEmergencyContacts();
  const { data: activeAlert } = useActiveSos();

  useEffect(() => {
    if (activeAlert) {
      navigation.navigate('SOSActive');
    }
  }, [activeAlert, navigation]);

  const handleSosPress = () => {
    navigation.navigate('SOSActive');
  };

  const primaryContact = contacts?.find((c: { is_primary: boolean }) => c.is_primary);
  const contactCount = contacts?.length ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Safety</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Emergency contacts and SOS alert system.
        </Txt>

        <Button
          label="SOS — Emergency Alert"
          variant="danger"
          fullWidth
          onPress={handleSosPress}
          style={{ marginBottom: theme.spacing.lg, paddingVertical: theme.spacing.lg }}
        />

        <Card elevated style={{ marginBottom: theme.spacing.lg }}>
          <View style={styles.contactHeader}>
            <Txt variant="h3">Emergency Contacts</Txt>
            <View style={[styles.contactCount, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
              <Txt variant="caption" color="primary">{contactCount}/5</Txt>
            </View>
          </View>
          {primaryContact && (
            <View style={{ marginTop: theme.spacing.sm }}>
              <Txt variant="body" color="secondary">Primary: {primaryContact.name}</Txt>
              <Txt variant="bodySmall" color="muted">{primaryContact.phone_number}</Txt>
            </View>
          )}
          <Button
            label={contactCount === 0 ? 'Add emergency contacts' : 'Manage contacts'}
            variant="outline"
            onPress={() => navigation.navigate('EmergencyContacts')}
            fullWidth
            style={{ marginTop: theme.spacing.md }}
          />
        </Card>

        <Button
          label="SOS History"
          variant="secondary"
          onPress={() => navigation.navigate('SosHistory')}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
  contactHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contactCount: { paddingHorizontal: 10, paddingVertical: 2 },
});
