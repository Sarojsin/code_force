import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Flame,
  Leaf,
  Droplet,
  Bone,
  Heart,
  HeartPulse,
  Moon,
  Wind,
  CloudFog,
  CloudLightning,
  CloudRain,
  Eye,
  Target,
  Repeat,
  MapPin,
  Utensils,
  Waves,
  Turtle,
  Sparkles,
  Scale,
  Thermometer,
  type LucideProps,
} from 'lucide-react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { RecommendationCard } from 'src/utils/expertRecommendations';

interface RecommendationCarouselProps {
  cards: RecommendationCard[];
  /** Card ids already marked done by the user. */
  completed: string[];
  onToggle: (id: string) => void;
  /** Fired when a CTA button is pressed. Caller resolves navigation/side-effects. */
  onAction: (action: NonNullable<RecommendationCard['action']>, card: RecommendationCard) => void;
}

const CARD_WIDTH = 280;

/** Maps the engine's framework-agnostic icon keys to Lucide icons (plan §8). */
const ICON_BY_KEY: Record<string, React.FC<LucideProps>> = {
  '🔥': Flame,
  '🌿': Leaf,
  '💧': Droplet,
  '🦴': Bone,
  '💗': Heart,
  '💓': HeartPulse,
  '😴': Moon,
  '🌙': Moon,
  '🌀': Wind,
  '🌫️': CloudFog,
  '🌩️': CloudLightning,
  '⛈️': CloudRain,
  '👁️': Eye,
  '🎯': Target,
  '🔄': Repeat,
  '📌': MapPin,
  '🍽️': Utensils,
  '🌊': Waves,
  '🐢': Turtle,
  '✨': Sparkles,
  '⚖️': Scale,
  '🌡️': Thermometer,
};

/** Actions that render an interactive CTA button (null/mark-done never do). */
const ACTIONABLE_ACTIONS: ReadonlySet<string> = new Set([
  'water',
  'breathing',
  'days-stretch',
  'walk',
  'journal',
  'doctor',
]);

const ACTION_HINTS: Record<string, string> = {
  water: 'Add one glass of water to today log',
  breathing: 'Open breathing exercise',
  'days-stretch': 'Open stretch exercise',
  walk: 'Start a gentle walk',
  journal: 'Open journal',
  doctor: 'Note to discuss with your doctor',
};

function CardIcon({ icon, color }: { icon: string; color: string }) {
  const Icon = ICON_BY_KEY[icon];
  if (Icon) {
    return <Icon size={22} color={color} accessible={false} />;
  }
  return <Text style={{ fontSize: 22 }} accessible={false}>{icon}</Text>;
}

export function RecommendationCarousel({ cards, completed, onToggle, onAction }: RecommendationCarouselProps) {
  const theme = useTheme();
  const { width } = Dimensions.get('window');

  const handleToggle = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onToggle(id);
    },
    [onToggle],
  );

  const handleAction = useCallback(
    (card: RecommendationCard) => {
      if (!card.action || !ACTIONABLE_ACTIONS.has(card.action)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAction(card.action as NonNullable<RecommendationCard['action']>, card);
    },
    [onAction],
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
                <CardIcon icon={card.icon} color={isDone ? theme.colors.success : theme.colors.textStrong} />
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
              {card.action && ACTIONABLE_ACTIONS.has(card.action) ? (
                <Pressable
                  onPress={() => handleAction(card)}
                  style={[
                    styles.ctaBtn,
                    { borderColor: theme.colors.primary, borderRadius: theme.radius.md },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={card.cta ?? 'Take suggested action'}
                  accessibilityHint={card.action ? ACTION_HINTS[card.action] : undefined}
                >
                  <Text variant="bodySmall" style={{ color: theme.colors.primary }}>{card.cta}</Text>
                </Pressable>
              ) : (
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
              )}
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
  ctaBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingVertical: 12,
    marginTop: 4,
    minHeight: 44,
  },
});