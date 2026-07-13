import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from './';
import { useTheme } from 'src/theme';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  isOffline?: boolean;
}

export function ErrorState({ message, onRetry, isOffline }: ErrorStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text variant="h3" style={{ textAlign: 'center' }}>
        {isOffline ? "You're offline" : 'Something went wrong'}
      </Text>
      <Text variant="body" style={{ textAlign: 'center', marginTop: 8 }}>
        {message}
      </Text>
      {onRetry && (
        <Button label="Try Again" onPress={onRetry} variant="outline" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
