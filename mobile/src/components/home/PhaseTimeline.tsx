import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from 'src/components/ui';
import { getPhaseMeta } from 'src/utils';

import { PhaseTimelineProps } from './types';

const PHASES = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const;

function PhaseTimelineBase({ phaseKey }: PhaseTimelineProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.phaseTimeline}>
      {PHASES.map((key) => {
        const meta = getPhaseMeta(key);
        const active = key === phaseKey;
        return (
          <Pressable
            key={key}
            style={[
              styles.phaseCard,
              {
                backgroundColor: active ? meta.accent : 'rgba(255,255,255,0.75)',
                borderColor: active ? meta.accent : 'rgba(0,0,0,0.06)',
              },
              active && { shadowColor: meta.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
            ]}
          >
            <Text variant="emoji">{meta.emoji}</Text>
            <Text style={[styles.phaseName, { color: active ? '#fff' : '#4A5568' }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export const PhaseTimeline = memo(PhaseTimelineBase);

const styles = StyleSheet.create({
  phaseTimeline: {
    marginBottom: 12,
  },
  phaseCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginRight: 10,
    width: 90,
    borderWidth: 1,
    borderRadius: 16,
  },
  phaseName: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default PhaseTimeline;