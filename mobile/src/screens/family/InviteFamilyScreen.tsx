/**
 * InviteFamilyScreen — generate / accept family invite.
 */

import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Share, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

export function InviteFamilyScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [inviteCode] = useState('SHECARE-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on SheCare! Use my invite code: ${inviteCode}`,
      });
      logger.info('InviteFamilyScreen.share');
    } catch (err) {
      logger.error('InviteFamilyScreen.share.failed', err);
    }
  };

  const handleCopy = () => {
    setCopied(true);
    logger.info('InviteFamilyScreen.copy', { inviteCode });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Invite Family</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Share your invite code or enter one to connect.
        </Txt>

        <Card elevated style={{ marginBottom: theme.spacing.lg }}>
          <Txt variant="bodySmall" color="secondary" align="center" style={{ marginBottom: theme.spacing.md }}>Your invite code</Txt>
          <Pressable
            onPress={handleCopy}
            accessibilityRole="button"
            accessibilityLabel={`Invite code: ${inviteCode}. Tap to copy.`}
          >
            <View style={[styles.codeBox, { backgroundColor: theme.colors.primaryMuted, borderColor: theme.colors.primary, borderRadius: theme.radius.md }]}>
              <Txt variant="display" color="primary" align="center" style={{ letterSpacing: 4 }}>{inviteCode}</Txt>
            </View>
          </Pressable>
          <Txt variant="caption" color="muted" align="center" style={{ marginTop: theme.spacing.sm }}>
            {copied ? 'Copied!' : 'Tap to copy'}
          </Txt>
        </Card>

        <Button label="Share invite link" onPress={handleShare} fullWidth style={{ marginBottom: theme.spacing.md }} />
        <Button label="Go back" variant="outline" onPress={() => navigation.goBack()} fullWidth />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  codeBox: { padding: 24, borderWidth: 2, borderStyle: 'dashed' },
});
