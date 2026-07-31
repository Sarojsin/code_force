import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ObjectToolOverlayProps {
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBringFront?: () => void;
  onSendBack?: () => void;
}

export function ObjectToolOverlay({ onEdit, onDuplicate, onDelete, onBringFront, onSendBack }: ObjectToolOverlayProps) {
  return (
    <View style={styles.tray}>
      {onEdit ? (
        <TouchableOpacity onPress={onEdit} style={styles.pill}>
          <Text style={styles.pillText}>✏️ Edit</Text>
        </TouchableOpacity>
      ) : null}
      {onDuplicate ? (
        <TouchableOpacity onPress={onDuplicate} style={styles.pill}>
          <Text style={styles.pillText}>📋 Copy</Text>
        </TouchableOpacity>
      ) : null}
      {onBringFront ? (
        <TouchableOpacity onPress={onBringFront} style={styles.pill}>
          <Text style={styles.pillText}>⬆️ Front</Text>
        </TouchableOpacity>
      ) : null}
      {onSendBack ? (
        <TouchableOpacity onPress={onSendBack} style={styles.pill}>
          <Text style={styles.pillText}>⬇️ Back</Text>
        </TouchableOpacity>
      ) : null}
      {onDelete ? (
        <TouchableOpacity onPress={onDelete} style={[styles.pill, styles.danger]}>
          <Text style={[styles.pillText, styles.dangerText]}>🗑️ Delete</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#fbf9f1',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e3db',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  pill: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e3db',
  },
  pillText: {
    fontFamily: 'WorkSans_500Medium',
    fontSize: 12,
    color: '#1b1c17',
  },
  danger: { backgroundColor: '#ffdad5', borderColor: '#ffb4aa' },
  dangerText: { color: '#93000a' },
});
