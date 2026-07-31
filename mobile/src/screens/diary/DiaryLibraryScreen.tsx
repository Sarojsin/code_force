import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState, useEffect } from 'react';
import { useDiaries, useCreateDiary } from '../../services/queries/diary';
import { DiaryCard } from './components/DiaryCard';

export function DiaryLibraryScreen({ navigation }: any) {
  const { top } = useSafeAreaInsets();
  const { data: diaries } = useDiaries();
  const createDiary = useCreateDiary();
  const [showCreate, setShowCreate] = useState(false);
  const [diaryTitle, setDiaryTitle] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!showCreate) return;
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, [showCreate]);

  const handleCreate = async () => {
    const title = diaryTitle.trim() || 'My Memory Diary';
    try {
      const diary = await createDiary.mutateAsync({ title, cover_color: 'primary' });
      setShowCreate(false);
      setDiaryTitle('');
      navigation.navigate('DiaryEditor', { diaryId: diary.id });
    } catch {
      Alert.alert('Error', 'Could not create diary. Please try again.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Digital Heirlooms</Text>
        <TouchableOpacity>
          <Text style={styles.searchIcon}>🔍</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>My Memories</Text>
      <View style={styles.divider} />

      <FlatList
        data={diaries}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <DiaryCard diary={item} onPress={() => navigation.navigate('Diary', { diaryId: item.id })} />
        )}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.newDiaryCard}
            onPress={() => setShowCreate(true)}
          >
            <View style={styles.addIcon}>
              <Text style={styles.addIconText}>+</Text>
            </View>
            <Text style={styles.newDiaryLabel}>START A NEW VOLUME</Text>
          </TouchableOpacity>
        }
      />

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>New Memory Diary</Text>
            <TextInput
              ref={inputRef}
              style={styles.modalInput}
              placeholder="Diary name"
              placeholderTextColor="#88726f"
              value={diaryTitle}
              onChangeText={setDiaryTitle}
            />
            <TouchableOpacity style={styles.modalBtn} onPress={handleCreate}>
              <Text style={styles.modalBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontFamily: 'LibreCaslonText_700Bold', fontSize: 32, color: '#410403' },
  searchIcon: { fontSize: 20 },
  sectionTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 24, color: '#410403', textAlign: 'center' },
  divider: { width: 96, height: 2, backgroundColor: '#dbc1bd', alignSelf: 'center', marginVertical: 8 },
  row: { justifyContent: 'space-between', paddingHorizontal: 16 },
  newDiaryCard: { height: 320, width: '100%', borderWidth: 2, borderStyle: 'dashed', borderColor: '#dbc1bd', borderRadius: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f4ec', marginBottom: 16 },
  addIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#5e1914', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  addIconText: { fontSize: 32, color: '#e17e72' },
  newDiaryLabel: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, letterSpacing: 1, color: '#410403' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { backgroundColor: '#fbf9f1', borderRadius: 20, padding: 24, width: '80%', maxWidth: 340 },
  modalTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 20, color: '#410403', textAlign: 'center', marginBottom: 20 },
  modalInput: { fontFamily: 'WorkSans_400Regular', fontSize: 16, color: '#1b1c17', backgroundColor: '#fffcf5', borderWidth: 1, borderColor: '#e4e3db', borderRadius: 10, padding: 12, marginBottom: 16 },
  modalBtn: { backgroundColor: '#410403', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 14, color: '#fff' },
});
