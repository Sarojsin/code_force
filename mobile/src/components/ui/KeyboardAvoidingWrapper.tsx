import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

interface Props {
  children: ReactNode;
  offset?: number;
  bounces?: boolean;
  contentContainerStyle?: any;
}

export function KeyboardAvoidingWrapper({ children, offset, bounces = true, contentContainerStyle }: Props) {
  const scrollProps = {
    contentContainerStyle: [styles.scroll, contentContainerStyle].filter(Boolean),
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
    bounces,
  };
  if (Platform.OS === 'android') {
    return (
      <View style={styles.flex}>
        <ScrollView {...scrollProps}>
          {children}
        </ScrollView>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={offset ?? 100}>
      <ScrollView {...scrollProps}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
});
