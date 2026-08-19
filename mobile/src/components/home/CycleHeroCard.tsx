import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from 'src/components/ui';

import { CircleProps, CycleHeroCardProps } from './types';

const RING = 2 * Math.PI * 34;

// Memoized per-phase progress ring (pure SVG; no hooks) so only the sections
// whose props actually change re-render on a cycle update.
function PhaseRingBase({ cycleDay, predictedCycleLength }: CircleProps) {
  const progress = cycleDay && predictedCycleLength ? cycleDay / predictedCycleLength : 0;
  return (
    <Svg width={78} height={78} viewBox="0 0 78 78">
      <SvgCircle cx="39" cy="39" r="34" stroke="rgba(255,255,255,0.2)" strokeWidth="5" fill="none" />
      <SvgCircle
        cx="39"
        cy="39"
        r="34"
        stroke="#fff"
        strokeWidth="5"
        fill="none"
        strokeDasharray={RING}
        strokeLinecap="round"
        strokeDashoffset={RING * (1 - progress)}
      />
    </Svg>
  );
}

const PhaseRing = memo(PhaseRingBase);

function CycleHeroCardBase({
  phaseColor,
  cycleDay,
  phaseName,
  phaseEmoji,
  phaseDesc,
  nextPeriodDays,
  predictedCycleLength,
}: CycleHeroCardProps) {
  return (
    <LinearGradient
      colors={[phaseColor + 'CC', phaseColor]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.heroCard}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={[styles.decoCircle, styles.decoCircleLarge]} />
        <View style={[styles.decoCircle, styles.decoCircleSmall]} />
      </View>
      <View style={styles.heroContent}>
        <View style={styles.heroTop}>
          <View style={styles.phasePill}>
            <View style={styles.dot} />
            <Text style={styles.phasePillText}>CYCLE DAY {cycleDay} · {phaseName.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{phaseEmoji} {phaseName} Phase</Text>
        <Text style={styles.heroSubtitle}>{phaseDesc}</Text>
        <View style={styles.heroRingSection}>
          <View style={styles.ringWrap}>
            <PhaseRing cycleDay={cycleDay} predictedCycleLength={predictedCycleLength} />
            <View style={styles.ringLabel}>
              <Text style={styles.ringDay}>{cycleDay}</Text>
              <Text style={styles.ringTotal}>/ {predictedCycleLength}</Text>
            </View>
          </View>
        </View>
        <View style={styles.heroDivider} />
        <View style={styles.heroStats}>
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{nextPeriodDays ?? '—'}</Text>
            <Text style={styles.heroStatLabel}>Next period</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>{predictedCycleLength ?? '—'}</Text>
            <Text style={styles.heroStatLabel}>Cycle avg</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStatItem}>
            <Text style={styles.heroStatValue}>3</Text>
            <Text style={styles.heroStatLabel}>Streak</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

export const CycleHeroCard = memo(CycleHeroCardBase);

const styles = StyleSheet.create({
  heroCard: {
    minHeight: 240,
    overflow: 'hidden',
    marginBottom: 12,
    borderRadius: 26,
  },
  decoCircle: {
    position: 'absolute',
  },
  decoCircleLarge: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -40,
    right: -40,
  },
  decoCircleSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
    bottom: -20,
    right: -10,
  },
  heroContent: {
    padding: 20,
  },
  heroTop: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 100,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: '#81C784',
  },
  phasePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
  },
  heroRingSection: {
    alignItems: 'flex-end',
    marginTop: -60,
    marginBottom: 8,
  },
  ringWrap: {
    alignItems: 'center',
  },
  ringLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    alignItems: 'center',
  },
  ringDay: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  ringTotal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
  },
  heroDivider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});

export default CycleHeroCard;