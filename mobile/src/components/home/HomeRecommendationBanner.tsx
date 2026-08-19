import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from 'src/theme';
import { Text } from 'src/components/ui';
import { useTodayRecommendation } from 'src/hooks/useTodayRecommendation';
import { useCompanionStore } from 'src/stores/companionStore';

/**
 * Compact "Today's Insight" banner for the Home screen.
 * Shows a single recommendation or motivation card.
 * Tap → navigates to the Wellness tab for the full carousel.
 * NEVER shows seek_care (pain ≥ 7) — safety guardrail.
 * Hidden when the "Show health insights" settings toggle is OFF.
 */
function HomeRecommendationBannerBase() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const showInsights = useCompanionStore((s) => s.showInsights);
  const { card } = useTodayRecommendation();

  if (!showInsights || !card) return null;

  return (
    <Pressable
      onPress={() =>
        navigation.navigate('Main', { screen: 'Wellness' })
      }
      accessibilityRole="button"
      accessibilityLabel={`Today's insight: ${card.title}`}
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
        },
      ]}
    >
      <Text style={styles.icon}>{card.icon}</Text>
      <Text
        variant="bodySmall"
        numberOfLines={1}
        ellipsizeMode="tail"
        style={[styles.title, { color: theme.colors.textPrimary }]}
      >
        {card.title}
      </Text>
      <ChevronRight size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export const HomeRecommendationBanner = React.memo(HomeRecommendationBannerBase);

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    fontSize: 20,
    marginRight: 10,
  },
  title: {
    flex: 1,
    marginRight: 8,
  },
});