import React, { ReactNode } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from 'src/theme';
import { Text } from './Text';

export interface ScreenLayoutProps {
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  padded?: boolean;
  children: ReactNode;
  headerRight?: ReactNode;
  loading?: boolean;
}

export function ScreenLayout({
  title,
  subtitle,
  scroll = true,
  padded = true,
  children,
  headerRight,
  loading,
}: ScreenLayoutProps) {
  const theme = useTheme();

  const content = (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {loading ? (
        <View style={[styles.centered, styles.flex]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={[styles.flex, padded && { paddingHorizontal: theme.spacing.lg }]}>
          {(title || headerRight) && (
            <View style={[styles.header, { paddingTop: theme.spacing.lg }]}>
              <View style={styles.headerLeft}>
                {title && <Text variant="h2">{title}</Text>}
                {subtitle && (
                  <Text variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.xs }}>
                    {subtitle}
                  </Text>
                )}
              </View>
              {headerRight && <View style={styles.headerRight}>{headerRight}</View>}
            </View>
          )}
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.flex} accessibilityLabel={title || 'Screen'}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={padded ? { paddingBottom: theme.spacing.xxxl } : undefined}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 16,
  },
  headerLeft: { flex: 1 },
  headerRight: { marginLeft: 12 },
});
