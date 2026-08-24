import { memo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiaryPages } from '../../services/queries/diary';
import { ScreenSkeleton, ErrorState } from '../../components/ui';

const PageCard = memo(function PageCard({
  page,
  onPress,
}: {
  page: { id: string; page_date: string; memory_title?: string | null; page_number?: number | null };
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity style={styles.pageCard} onPress={() => onPress(page.id)}>
      <Text style={styles.pageDate}>{page.page_date}</Text>
      {page.memory_title && <Text style={styles.pageTitle} numberOfLines={2}>{page.memory_title}</Text>}
      <Text style={styles.pageNum}>Page {page.page_number ?? 1}</Text>
    </TouchableOpacity>
  );
});

export function DiaryScreen({ route, navigation }: any) {
  const { diaryId } = route.params;
  const { top } = useSafeAreaInsets();
  const { data: pages, isLoading, isError, refetch } = useDiaryPages(diaryId);

  const handleOpenPage = useCallback(
    (pageId: string) => navigation.navigate('DiaryPage', { diaryId, pageId }),
    [navigation, diaryId],
  );

  const handleCreatePage = useCallback(() => navigation.navigate('DiaryEditor', { diaryId }), [navigation, diaryId]);

  const renderItem = useCallback(
    ({ item }: { item: { id: string; page_date: string; memory_title?: string | null; page_number?: number | null } }) => (
      <PageCard page={item} onPress={handleOpenPage} />
    ),
    [handleOpenPage],
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <ScreenSkeleton variant="list" count={4} label="Loading pages…" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <ErrorState message="Couldn't load the pages of this diary." onRetry={() => refetch()} />
      </View>
    );
  }

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
        renderItem={renderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No pages yet</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleCreatePage}
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
