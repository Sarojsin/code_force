import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

const STICKER_CATEGORIES: Record<string, string[]> = {
  Nature: ['🌿','🌸','🌻','🍂','🌲','🌺','🍀','🌷','🌙','⭐','☀️','🌈'],
  Love: ['❤️','💕','💖','💗','💝','🥰','😘','💌'],
  Travel: ['✈️','🗺️','📍','🌍','🏖️','⛰️','🏔️','🌊'],
  Food: ['🍰','🥂','🍷','☕','🍪','🍓','🍋','🧁'],
  Creative: ['🎨','✍️','📖','🎵','🎶','📸','🎭','✨'],
  Everyday: ['☕','📱','🎧','🕯️','🪴','🧸','🎀','💫'],
};

interface StickerPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function StickerPicker({ visible, onSelect, onClose }: StickerPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Stickers</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          {Object.entries(STICKER_CATEGORIES).map(([cat, emojis]) => (
            <View key={cat} style={styles.category}>
              <Text style={styles.catTitle}>{cat}</Text>
              <View style={styles.grid}>
                {emojis.map((emoji) => (
                  <TouchableOpacity key={emoji} onPress={() => onSelect(emoji)} style={styles.stickerBtn}>
                    <Text style={[styles.emoji, { fontFamily: 'System' }]}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: '#fbf9f1',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: 'LibreCaslonText_600SemiBold',
    fontSize: 20,
    color: '#410403',
  },
  close: { fontSize: 20, color: '#554240' },
  category: { marginBottom: 16 },
  catTitle: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 12,
    color: '#88726f',
    letterSpacing: 1,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0eee6',
  },
  emoji: { fontSize: 22 },
});
