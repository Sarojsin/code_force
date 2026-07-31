import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface FloatingToolbarProps {
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (type: string) => void;
}

const ITEMS = [
  { type: 'text', label: 'Text', icon: 'Aa' },
  { type: 'image', label: 'Image', icon: '🖼' },
  { type: 'sticker', label: 'Sticker', icon: '🌸' },
  { type: 'video', label: 'Video', icon: '🎬' },
  { type: 'voice', label: 'Voice', icon: '🎤' },
  { type: 'mood', label: 'Mood', icon: '😊' },
];

export function FloatingToolbar({ isOpen, onToggle, onAdd }: FloatingToolbarProps) {
  return (
    <View style={styles.container}>
      {isOpen && (
        <View style={styles.menu}>
          {ITEMS.map(item => (
            <TouchableOpacity key={item.type} style={styles.menuItem} onPress={() => onAdd(item.type)}>
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <TouchableOpacity style={styles.fab} onPress={onToggle} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>{isOpen ? '✕' : '+'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 24, right: 24, alignItems: 'flex-end', gap: 8 },
  menu: { backgroundColor: '#f0eee6', borderRadius: 16, padding: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4, gap: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  menuIcon: { fontSize: 20 },
  menuLabel: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, color: '#554240', letterSpacing: 0.5 },
  fab: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#410403', justifyContent: 'center', alignItems: 'center', shadowColor: '#410403', shadowOpacity: 0.25, shadowRadius: 20, elevation: 6 },
  fabIcon: { fontSize: 28, color: '#fff' },
});
