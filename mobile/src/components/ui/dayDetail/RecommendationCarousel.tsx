import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { RecommendationCard } from 'src/utils/expertRecommendations';

interface RecommendationCarouselProps {
  cards: RecommendationCard[];
  /** Card ids already marked done by the user. */
  completed: string[];
  onToggle: (id: string) => void;
}

const CARD_WIDTH = 280;

export function RecommendationCarousel({ cards, completed, onToggle }: RecommendationCarouselProps) {
  const theme = useTheme();
  const { width } = Dimensions.get('window');

  const handleToggle = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(id);
    },
    [onToggle],
  );

  if (cards.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        contentOffset={{ x: Math.max(0, (width - CARD_WIDTH) / 2 - 16), y: 0 }}
        accessibilityRole="list"
        accessibilityLabel="Daily recommendations"
        contentContainerStyle={styles.scroll}
      >
        {cards.map((card) => {
          const isDone = completed.includes(card.id);
          return (
            <View
              key={card.id}
              style={[
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: isDone ? theme.colors.success : theme.colors.border,
                  borderRadius: theme.radius.cardLg,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={{ fontSize: 22 }}>{card.icon}</Text>
                {card.cta ? (
                  <Text variant="caption" style={{ color: theme.colors.textMuted }}>
                    {card.cta}
                  </Text>
                ) : (
                  <View />
                )}
              </View>
              <Text variant="body" style={styles.title}>
                {card.title}
              </Text>
              <Text variant="bodySmall" color="secondary" style={styles.body}>
                {card.body}
              </Text>
              <Pressable
                onPress={() => handleToggle(card.id)}
                style={[
                  styles.doneBtn,
                  { borderColor: isDone ? theme.colors.success : theme.colors.primary, borderRadius: theme.radius.sm },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isDone }}
                accessibilityLabel={isDone ? 'Mark as not done' : 'Mark as done'}
              >
                <Text style={{ fontSize: 16, color: isDone ? theme.colors.success : theme.colors.primary }}>
                  {isDone ? '✓' : '○'}
                </Text>
                <Text variant="bodySmall" style={{ color: isDone ? theme.colors.success : theme.colors.primary }}>
                  {isDone ? 'Done' : 'Mark done'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  scroll: { gap: 12, paddingHorizontal: 2, paddingVertical: 2 },
  card: {
    width: CARD_WIDTH,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontWeight: '700' },
  body: { lineHeight: 20 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    paddingVertical: 10,
    marginTop: 4,
    minHeight: 44,
  },
});