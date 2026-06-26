/**
 * EditProfileScreen — edit display name and phone.
 */

import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Text as Txt, Card } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useAuthStore } from 'src/stores';
import { logger } from 'src/utils';
import type { ProfileStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<ProfileStackParamList, 'EditProfile'>;

const profileEditSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(8).regex(/^\+/, 'Include country code'),
});
type ProfileEditForm = z.infer<typeof profileEditSchema>;

export function EditProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(s => s.user);

  const { control, handleSubmit, formState } = useForm<ProfileEditForm>({
    resolver: zodResolver(profileEditSchema),
    defaultValues: { displayName: user?.display_name ?? '', phone: user?.phone_number ?? '' },
    mode: 'onBlur',
  });

  const onSubmit = async (data: ProfileEditForm) => {
    try {
      logger.info('EditProfileScreen.submit', data);
      navigation.goBack();
    } catch (err) {
      logger.error('EditProfileScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Card style={{ marginBottom: theme.spacing.xl }} padded={false}>
            <View style={[styles.avatarSection, { borderBottomColor: theme.colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
                <Txt variant="display" color="primary">{(user?.display_name ?? 'U').charAt(0).toUpperCase()}</Txt>
              </View>
              <Txt variant="h3" style={{ marginTop: theme.spacing.sm }}>{user?.display_name ?? 'User'}</Txt>
              <Txt variant="bodySmall" color="secondary">{user?.role}</Txt>
            </View>
          </Card>

          <FormField control={control} name="displayName" label="Display name" placeholder="Your name" accessibilityLabel="Display name" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="phone" label="Phone number" placeholder="+1234567890" keyboardType="phone-pad" accessibilityLabel="Phone number" />

          <View style={{ height: theme.spacing.xl }} />
          <Button label="Save changes" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  avatarSection: { alignItems: 'center', padding: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
});
