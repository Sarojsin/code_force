import React from 'react';
import { FlatList, StyleSheet, View, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Button, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useEmergencyContacts, useDeleteEmergencyContact } from 'src/services/queries';
import { logger } from 'src/utils';
import type { SafetyStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<SafetyStackParamList, 'EmergencyContacts'>;

export function EmergencyContactsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { data: contacts, isLoading } = useEmergencyContacts();
  const deleteMutation = useDeleteEmergencyContact();

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Remove Contact',
      `Remove ${name} from your emergency contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
            } catch (err) {
              logger.error('EmergencyContactsScreen.delete.failed', err);
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: { id: string; name: string; phone_number: string; relationship: string | null; is_primary: boolean } }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => navigation.navigate('EmergencyContactEdit', { id: item.id })}
          onLongPress={() => handleDelete(item.id, item.name)}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${item.relationship ?? 'contact'}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Txt variant="h3" color="primary">{item.name.charAt(0)}</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <View style={styles.nameRow}>
                  <Txt variant="h3">{item.name}</Txt>
                  {item.is_primary && (
                    <View style={[styles.primaryBadge, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]}>
                      <Txt variant="caption" color="inverse">Primary</Txt>
                    </View>
                  )}
                </View>
                <Txt variant="bodySmall" color="secondary">{item.relationship ?? ''}</Txt>
                <Txt variant="bodySmall" color="muted">{item.phone_number}</Txt>
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={contacts ?? []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshing={isLoading}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Emergency Contacts</Txt>
            <Txt variant="body" color="secondary">People notified when you trigger SOS. (max 5)</Txt>
          </View>
        }
        ListFooterComponent={
          <Button
            label="Add emergency contact"
            variant="outline"
            onPress={() => navigation.navigate('EmergencyContactEdit', {})}
            fullWidth
            style={{ marginTop: theme.spacing.md }}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Card><Txt variant="body" color="secondary" align="center">Loading contacts...</Txt></Card>
          ) : (
            <Card><Txt variant="body" color="secondary" align="center">No emergency contacts yet.</Txt></Card>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryBadge: { paddingHorizontal: 8, paddingVertical: 2 },
});
