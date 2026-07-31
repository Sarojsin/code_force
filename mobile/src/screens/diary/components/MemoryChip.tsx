import { View, Text, StyleSheet } from 'react-native';

interface MemoryChipProps {
  label: string;
  variant?: 'tag' | 'person' | 'location' | 'weather';
}

const variantStyles: Record<string, { bg: string; color: string }> = {
  tag: { bg: '#ffca98', color: '#7a532a' },
  person: { bg: '#e4d5c5', color: '#5e1914' },
  location: { bg: '#d4e0cf', color: '#2d4632' },
  weather: { bg: '#d0e0eb', color: '#2a4a6b' },
};

export function MemoryChip({ label, variant = 'tag' }: MemoryChipProps) {
  const vs = variantStyles[variant];
  return (
    <View style={[styles.chip, { backgroundColor: vs.bg }]}>
      <Text style={[styles.label, { color: vs.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    transform: [{ rotate: '-2deg' }],
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  label: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.08,
  },
});
