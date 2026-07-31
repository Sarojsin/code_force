import { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiarySearch } from '../../services/queries/diary';
import { diaryLocal } from '../../services/localDb';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export function DiarySearchScreen({ navigation }: any) {
  const { top } = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<any[]>([]);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { data: serverResults } = useDiarySearch({ q: debouncedQuery });

  useEffect(() => {
    let cancelled = false;
    if (debouncedQuery.length === 0) {
      setLocalResults([]);
      return;
    }
    diaryLocal.search.search(debouncedQuery).then((results) => {
      if (!cancelled) setLocalResults(results);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const results = localResults.length > 0 ? localResults : serverResults;

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
        keyExtractor={(item) => item.id ?? item.page_ids?.[0]}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultCard}>
            <Text style={styles.resultTitle}>{item.memory_title ?? 'Untitled'}</Text>
            <Text style={styles.resultMeta}>{item.page_date}</Text>
          </TouchableOpacity>
        )}
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
