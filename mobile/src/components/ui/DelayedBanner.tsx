import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from 'src/theme';
import { Card } from './Card';
import { Text } from './Text';
import { Button } from './Button';

const DISMISS_KEY_PREFIX = 'shecare.delayed_banner_dismissed_';

interface DelayedBannerProps {
  predictionId: string;
}

export function DelayedBanner({ predictionId }: DelayedBannerProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [dismissed, setDismissed] = useState(true); // default hidden until check completes

  useEffect(() => {
    AsyncStorage.getItem(`${DISMISS_KEY_PREFIX}${predictionId}`).then((val) => {
      setDismissed(val === 'true');
    });
  }, [predictionId]);

  const handleDismiss = useCallback(async () => {
    setDismissed(true);
    await AsyncStorage.setItem(`${DISMISS_KEY_PREFIX}${predictionId}`, 'true');
  }, [predictionId]);

  const handleLogPeriod = useCallback(() => {
    navigation.navigate('Main', { screen: 'Calendar', params: { screen: 'LogPeriod' } });
  }, [navigation]);

  if (dismissed) return null;

  return (
    <Card
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.warning + '15',
          borderColor: theme.colors.warning + '30',
          borderWidth: 1,
        },
      ]}
    >
      <Text variant="bodySmall" color="secondary" style={styles.message}>
        Your period is significantly delayed. Tap the Calendar to log your start date when it
        arrives.
      </Text>
      <View style={styles.actions}>
        <Button
          label="Log Period"
          size="sm"
          variant="outline"
          onPress={handleLogPeriod}
          style={styles.actionBtn}
        />
        <Button
          label="Dismiss"
          size="sm"
          variant="outline"
          onPress={handleDismiss}
          style={styles.actionBtn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: 12 },
  message: { marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { minHeight: 44 },
});
