import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { typography } from 'src/theme';

const MOODS = [
  { mood: 'happy', emoji: '😊' },
  { mood: 'calm', emoji: '😌' },
  { mood: 'loved', emoji: '🥰' },
  { mood: 'grateful', emoji: '🙏' },
  { mood: 'peaceful', emoji: '🕊️' },
  { mood: 'sad', emoji: '😢' },
  { mood: 'anxious', emoji: '😰' },
  { mood: 'energetic', emoji: '⚡' },
];

interface MoodPickerProps {
  visible: boolean;
  onSelect: (mood: string) => void;
  onClose: () => void;
}

export function MoodPicker({ visible, onSelect, onClose }: MoodPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <Text style={styles.title}>How are you feeling?</Text>
          <View style={styles.grid}>
            {MOODS.map(({ mood, emoji }) => (
              <TouchableOpacity
                key={mood}
                style={styles.moodItem}
                onPress={() => { onSelect(mood); onClose(); }}
              >
                <Text style={[styles.emoji, { fontFamily: 'System' }]}>{emoji}</Text>
                <Text style={styles.label}>{mood}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fbf9f1', borderRadius: 20, padding: 24, width: '80%', maxWidth: 340 },
  title: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 20, color: '#410403', textAlign: 'center', marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 },
  moodItem: { alignItems: 'center', width: 64, paddingVertical: 8, borderRadius: 12, backgroundColor: '#fffcf5', borderWidth: 1, borderColor: '#f0eee6' },
  emoji: { fontSize: 28, marginBottom: 4 },
  label: { fontFamily: 'WorkSans_500Medium', fontSize: typography.label.fontSize, color: '#554240' },
  cancel: { marginTop: 16, alignItems: 'center' },
  cancelText: { fontFamily: 'WorkSans_500Medium', fontSize: 14, color: '#88726f' },
});
