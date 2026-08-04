import React from 'react';
import { StyleSheet, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

interface PainSliderProps {
  value: number;
  onChange: (val: number) => void;
}

export function PainSlider({ value, onChange }: PainSliderProps) {
  const theme = useTheme();
  return (
    <View>
      <View style={styles.header}>
        <Text variant="body" style={{ fontWeight: '600' }}>Pain Level</Text>
        <View style={[styles.badge, { backgroundColor: theme.colors.primaryDeep }]}>
          <Text style={styles.badgeText}>{value} / 10</Text>
        </View>
      </View>
      <Slider
        minimumValue={0}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={(v) => onChange(v as number)}
        minimumTrackTintColor={theme.colors.primaryDeep}
        maximumTrackTintColor={theme.colors.border}
        thumbTintColor={theme.colors.primaryDeep}
        style={styles.slider}
        accessibilityLabel="Pain level slider"
      />
      <View style={styles.labels}>
        <Text variant="helper" color="muted">None</Text>
        <Text variant="helper" color="muted">Severe</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  slider: { height: 40 },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
});
