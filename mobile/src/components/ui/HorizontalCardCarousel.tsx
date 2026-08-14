import React from 'react';
import { ScrollView, StyleSheet, Dimensions } from 'react-native';

export const CAROUSEL_CARD_WIDTH = 280;

interface HorizontalCardCarouselProps {
  cardWidth?: number;
  accessibilityLabel?: string;
  children: React.ReactNode;
}

/**
 * Generic horizontal-snap carousel (plan sanity check #5). Extracted from
 * RecommendationCarousel so both the DayDetailSheet cards and the Health
 * Library recommended tier share identical scroll behaviour.
 */
export function HorizontalCardCarousel({
  cardWidth = CAROUSEL_CARD_WIDTH,
  accessibilityLabel,
  children,
}: HorizontalCardCarouselProps) {
  const { width } = Dimensions.get('window');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth}
      decelerationRate="fast"
      contentOffset={{ x: Math.max(0, (width - cardWidth) / 2 - 16), y: 0 }}
      accessibilityRole="list"
      accessibilityLabel={accessibilityLabel}
      contentContainerStyle={styles.scroll}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, paddingHorizontal: 2, paddingVertical: 2, marginTop: 4 },
});