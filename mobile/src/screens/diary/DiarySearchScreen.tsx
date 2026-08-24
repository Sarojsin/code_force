import { memo, useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiarySearch } from '../../services/queries/diary';
import { diaryLocal } from '../../services/localDb';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ErrorState } from '../../components/ui';

const SearchResultCard = memo(function SearchResultCard({
  title,
  date,
}: {
  title: string;
  date: string;
}) {
  return (
    <TouchableOpacity style={styles.resultCard}>
      <Text style={styles.resultTitle}>{title}</Text>
      <Text style={styles.resultMeta}>{date}</Text>
    </TouchableOpacity>
  );
});

export function DiarySearchScreen({ navigation }: any) {
  const { top } = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<any[]>([]);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: serverResults, isError, refetch } = useDiarySearch({ q: debouncedQuery });

  useEffect(() => {
    let cancelled = false;
    if (debouncedQuery.length === 0) {
      setLocalResults([]);
      return;
    }
    diaryLocal.search.search(debouncedQuery).then((results) => {
      if (!cancelled) setLocalResults(results);
    }).catch(() => {
      if (!cancelled) setLocalResults([]);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const results = localResults.length > 0 ? localResults : serverResults;

  const renderItem = useCallback(
    ({ item }: { item: { id?: string; page_ids?: string[]; memory_title?: string | null; page_date: string } }) => (
      <SearchResultCard title={item.memory_title ?? 'Untitled'} date={item.page_date} />
    ),
    [],
  );

  if (isError && debouncedQuery.length > 0 && localResults.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search sunset, birthday, mom..."
            placeholderTextColor="#88726f"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
        <ErrorState
          message="Search is unavailable right now."
          onRetry={() => refetch()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Search sunset, birthday, mom..."
          placeholderTextColor="#88726f"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id ?? item.page_ids?.[0] ?? item.page_date}
        renderItem={renderItem}
        initialNumToRender={7}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
        ListEmptyComponent={
          query.length > 0 ? (
            <Text style={styles.empty}>No results found</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f1' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12 },
  back: { fontSize: 24, color: '#410403' },
  searchInput: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#dbc1bd', fontFamily: 'WorkSans_400Regular', fontSize: 16, backgroundColor: '#fff' },
  resultCard: { marginHorizontal: 24, padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 8 },
  resultTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 16, color: '#1b1c17' },
  resultMeta: { fontFamily: 'WorkSans_400Regular', fontSize: 12, color: '#554240', marginTop: 4 },
  empty: { textAlign: 'center', paddingTop: 60, fontFamily: 'WorkSans_400Regular', fontSize: 16, color: '#88726f' },
});
