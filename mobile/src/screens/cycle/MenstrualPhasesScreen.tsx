/**
 * MenstrualPhasesScreen — 4 gradient glassmorphism cards with swipe.
 * UI_UX spec: Menstrual_Phases.md
 */

import React, { useRef, useState } from 'react';
import { StyleSheet, View, Dimensions, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { RouteProp, useRoute } from '@react-navigation/native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  scrollTo, useDerivedValue,
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, LinearGradient, Stop, Rect, Defs } from 'react-native-svg';

import { Text } from 'src/components/ui';
import { useTheme, palette } from 'src/theme';
import type { CalendarStackParamList } from 'src/navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_MARGIN = 12;

type Rt = RouteProp<CalendarStackParamList, 'PhaseDetail'>;

interface PhaseData {
  key: string;
  title: string;
  subtitle: string;
  gradient: string[];
  icon: string;
  duration: string;
  hormones: { name: string; level: number }[];
  energy: number;
  mood: number;
  nutrition: string[];
  exercise: string[];
  symptoms: string[];
}

const PHASES: PhaseData[] = [
  {
    key: 'menstrual',
    title: 'Menstrual',
    subtitle: 'Day 1–5',
    gradient: ['#D63B3B', '#FF5C8A'],
    icon: '🩸',
    duration: 'Day 1 – Day 5',
    hormones: [
      { name: 'Estrogen', level: 1 },
      { name: 'Progesterone', level: 1 },
    ],
    energy: 1,
    mood: 2,
    nutrition: ['Iron-rich foods 🥦', 'Vitamin C for absorption 🫐', 'Stay hydrated 💧', 'Warm meals 🥣'],
    exercise: ['Gentle yoga 🧘', 'Light walking 🚶', 'Avoid high intensity ❌'],
    symptoms: ['Cramps', 'Fatigue', 'Bloating', 'Headache'],
  },
  {
    key: 'follicular',
    title: 'Follicular',
    subtitle: 'Day 6–13',
    gradient: ['#FFB74D', '#FFD54F'],
    icon: '🌱',
    duration: 'Day 6 – Day 13',
    hormones: [
      { name: 'Estrogen', level: 4 },
      { name: 'Progesterone', level: 1 },
    ],
    energy: 4,
    mood: 5,
    nutrition: ['Complex carbs 🌾', 'Leafy greens 🥗', 'Omega-3 fatty acids 🐟'],
    exercise: ['Cardio 🏃‍♀️', 'Strength training 🏋️', 'Dance 💃'],
    symptoms: ['Increased energy', 'Clear skin', 'Higher libido'],
  },
  {
    key: 'ovulation',
    title: 'Ovulation',
    subtitle: 'Day 14–16',
    gradient: ['#4CAF50', '#81C784'],
    icon: '✨',
    duration: 'Day 14 – Day 16',
    hormones: [
      { name: 'LH', level: 5 },
      { name: 'FSH', level: 5 },
    ],
    energy: 5,
    mood: 5,
    nutrition: ['Antioxidant-rich berries 🫐', 'Lean protein 🍗', 'Hydrating fruits 🍉'],
    exercise: ['HIIT 🔥', 'Running 🏃', 'Swimming 🏊‍♀️'],
    symptoms: ['Peak energy', 'Clear communication', 'High confidence'],
  },
  {
    key: 'luteal',
    title: 'Luteal',
    subtitle: 'Day 17–28',
    gradient: ['#7E57C2', '#9B7BFF'],
    icon: '🌙',
    duration: 'Day 17 – Day 28',
    hormones: [
      { name: 'Progesterone', level: 5 },
      { name: 'Estrogen', level: 3 },
    ],
    energy: 2,
    mood: 2,
    nutrition: ['Magnesium-rich foods 🥜', 'Dark chocolate 🍫', 'Herbal teas 🍵', 'Complex carbs 🌾'],
    exercise: ['Pilates 🤸', 'Stretching 🧘', 'Light yoga'],
    symptoms: ['PMS', 'Bloating', 'Mood swings', 'Food cravings', 'Fatigue'],
  },
];

function StarRating({ level, color }: { level: number; color: string }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(s => (
        <View key={s} style={[styles.star, { backgroundColor: s <= level ? color : 'rgba(255,255,255,0.3)', borderRadius: 2 }]} />
      ))}
    </View>
  );
}

function PhaseCard({ phase, index }: { phase: PhaseData; index: number }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.cardWrapper, animStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={[styles.card, { borderRadius: theme.radius.xl }]}
      >
        {/* Gradient background */}
        <Svg style={StyleSheet.absoluteFill} width={CARD_WIDTH} height={480} viewBox={`0 0 ${CARD_WIDTH} 480`}>
          <Defs>
            <LinearGradient id={`grad-${index}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={phase.gradient[0]} stopOpacity="1" />
              <Stop offset="100%" stopColor={phase.gradient[1]} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={CARD_WIDTH} height="480" fill={`url(#grad-${index})`} rx="24" />
        </Svg>

        {/* Glassmorphism overlay */}
        <View style={[styles.glassOverlay, { borderRadius: theme.radius.xl }]}>
          <View style={styles.cardHeader}>
            <Text variant="h2" style={{ color: '#fff', fontSize: 22 }}>{phase.icon} {phase.title}</Text>
            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.85)' }}>{phase.subtitle}</Text>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.metricsRow}>
              <View style={styles.metric}>
                <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>Energy</Text>
                <StarRating level={phase.energy} color="#fff" />
              </View>
              <View style={styles.metric}>
                <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)' }}>Mood</Text>
                <StarRating level={phase.mood} color="#fff" />
              </View>
            </View>

            <View style={styles.hormoneRow}>
              <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 4 }}>Hormones</Text>
              {phase.hormones.map(h => (
                <View key={h.name} style={styles.hormoneItem}>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)', width: 100 }}>{h.name}</Text>
                  <View style={styles.hormoneBar}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <View key={i} style={[styles.hormoneDot, { backgroundColor: i <= h.level ? '#fff' : 'rgba(255,255,255,0.25)' }]} />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>🥗 Nutrition</Text>
            {phase.nutrition.map(n => (
              <Text key={n} variant="caption" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{n}</Text>
            ))}

            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>🏃 Exercise</Text>
            {phase.exercise.map(e => (
              <Text key={e} variant="caption" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{e}</Text>
            ))}

            <Text variant="bodySmall" style={{ color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>⚡ Symptoms</Text>
            <View style={styles.symptomRow}>
              {phase.symptoms.map(s => (
                <View key={s} style={[styles.symptomChip, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: theme.radius.pill }]}>
                  <Text variant="caption" style={{ color: '#fff' }}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function MenstrualPhasesScreen() {
  const theme = useTheme();
  const route = useRoute<Rt>();
  const navigation = useNavigation();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const initialPhase = PHASES.findIndex(p => p.key === route.params?.phase);
  const startIndex = initialPhase >= 0 ? initialPhase : 0;

  React.useLayoutEffect(() => {
    navigation.setOptions({ title: PHASES[startIndex]?.title ?? 'Phase Guide' });
  }, [navigation, startIndex]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#1A1D26' }]}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_WIDTH + CARD_MARGIN}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 24, gap: CARD_MARGIN }}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_MARGIN));
            setActiveIndex(idx);
            navigation.setOptions({ title: PHASES[idx]?.title ?? 'Phase Guide' });
          }}
        >
          {PHASES.map((phase, idx) => (
            <PhaseCard key={phase.key} phase={phase} index={idx} />
          ))}
        </Animated.ScrollView>

        {/* Page indicator dots */}
        <View style={styles.pageDots}>
          {PHASES.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                {
                  backgroundColor: idx === activeIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                  width: idx === activeIndex ? 24 : 8,
                  borderRadius: 4,
                },
              ]}
            />
          ))}
        </View>
      </GestureHandlerRootView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  cardWrapper: { width: CARD_WIDTH },
  card: { width: CARD_WIDTH, height: 480, overflow: 'hidden' },
  glassOverlay: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
  },
  cardHeader: { marginBottom: 16 },
  cardBody: {},
  metricsRow: { flexDirection: 'row', gap: 24, marginBottom: 12 },
  metric: { flex: 1 },
  starRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  star: { width: 16, height: 4 },
  hormoneRow: { marginBottom: 8 },
  hormoneItem: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  hormoneBar: { flexDirection: 'row', gap: 4 },
  hormoneDot: { width: 12, height: 12, borderRadius: 6 },
  symptomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  symptomChip: { paddingHorizontal: 10, paddingVertical: 4 },
  pageDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 16 },
  dot: { height: 8 },
});
