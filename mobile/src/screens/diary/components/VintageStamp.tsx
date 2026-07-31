import { View, Text, StyleSheet } from 'react-native';

interface VintageStampProps {
  text: string;
  rotation?: number;
  variant?: 'corner' | 'ribbon';
}

export function VintageStamp({ text, rotation = -8, variant = 'corner' }: VintageStampProps) {
  return (
    <View style={[styles.container, variant === 'ribbon' ? styles.ribbon : null, { transform: [{ rotate: `${rotation}deg` }] }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fbf9f1',
    borderWidth: 2,
    borderColor: '#410403',
    paddingHorizontal: 8,
    paddingVertical: 3,
    opacity: 0.7,
  },
  ribbon: {
    backgroundColor: '#410403',
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 4,
    opacity: 0.85,
  },
  text: {
    fontFamily: 'GreatVibes_400Regular',
    fontSize: 14,
    color: '#410403',
    letterSpacing: 0.5,
  },
});
