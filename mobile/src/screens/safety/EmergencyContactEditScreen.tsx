import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import { useCreateEmergencyContact, useUpdateEmergencyContact, useEmergencyContacts } from 'src/services/queries';
import type { EmergencyContact } from 'src/services/api';
import type { SafetyStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<SafetyStackParamList, 'EmergencyContactEdit'>;
type Rt = RouteProp<SafetyStackParamList, 'EmergencyContactEdit'>;

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  phone: z.string().min(8, 'Valid phone required').regex(/^\+/, 'Include country code, e.g. +977'),
  relationship: z.string().min(1, 'Relationship is required').max(50),
});
type ContactForm = z.infer<typeof contactSchema>;

export function EmergencyContactEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { id } = route.params;
  const isEditing = !!id;
  const { data: contacts } = useEmergencyContacts();
  const createMutation = useCreateEmergencyContact();
  const updateMutation = useUpdateEmergencyContact();

  const existingContact: EmergencyContact | undefined = isEditing ? contacts?.find((c: EmergencyContact) => c.id === id) : undefined;

  const { control, handleSubmit, formState } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: existingContact?.name ?? '',
      phone: existingContact?.phone_number ?? '',
      relationship: existingContact?.relationship ?? '',
    },
    mode: 'onBlur',
  });

  const onSubmit = async (data: ContactForm) => {
    try {
      if (isEditing && id) {
        await updateMutation.mutateAsync({
          id,
          data: {
            name: data.name,
            phone_number: data.phone,
            relationship: data.relationship,
          },
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          phone_number: data.phone,
          relationship: data.relationship,
        });
      }
      navigation.goBack();
    } catch (err) {
      logger.error('EmergencyContactEditScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>
            {isEditing ? 'Edit Contact' : 'Add Contact'}
          </Txt>
          <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
            {isEditing ? 'Update emergency contact details.' : 'Add someone to notify in an emergency.'}
          </Txt>

          <FormField control={control} name="name" label="Full name" placeholder="Jane Doe" accessibilityLabel="Contact full name" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="phone" label="Phone number" placeholder="+9779812345678" keyboardType="phone-pad" accessibilityLabel="Phone number with country code" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="relationship" label="Relationship" placeholder="Mother, Partner, Doctor..." accessibilityLabel="Relationship to you" />

          <View style={{ height: theme.spacing.xl }} />
          <Button
            label={isEditing ? 'Save changes' : 'Add contact'}
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid}
            loading={createMutation.isPending || updateMutation.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
});
