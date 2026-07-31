import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiaryPages } from '../../services/queries/diary';

export function DiaryScreen({ route, navigation }: any) {
  const { diaryId } = route.params;
  const { top } = useSafeAreaInsets();
  const { data: pages } = useDiaryPages(diaryId);

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Page Overview</Text>
      </View>
      <FlatList
        data={pages}
        numColumns={2}
        columnWrapperStyle={styles.row}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.pageCard}
            onPress={() => navigation.navigate('DiaryPage', { diaryId, pageId: item.id })}
          >
            <Text style={styles.pageDate}>{item.page_date}</Text>
            {item.memory_title && <Text style={styles.pageTitle} numberOfLines={2}>{item.memory_title}</Text>}
            <Text style={styles.pageNum}>Page {item.page_number}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No pages yet</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => navigation.navigate('DiaryEditor', { diaryId })}
            >
              <Text style={styles.addBtnText}>Create First Page</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f1' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 12 },
  back: { fontSize: 24, color: '#410403' },
  title: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 24, color: '#410403' },
  row: { justifyContent: 'space-between', paddingHorizontal: 16 },
  pageCard: { width: '48%', height: 120, backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 12, elevation: 2, justifyContent: 'space-between' },
  pageDate: { fontFamily: 'WorkSans_600SemiBold', fontSize: 11, color: '#88726f', letterSpacing: 1 },
  pageTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 16, color: '#1b1c17', marginVertical: 4 },
  pageNum: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#554240' },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 20, color: '#554240', marginBottom: 16 },
  addBtn: { backgroundColor: '#410403', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  addBtnText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 14, color: '#fff' },
});
