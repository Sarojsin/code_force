import { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiaryTimeline } from '../../services/queries/diary';

export function DiaryTimelineScreen({ navigation }: any) {
  const { top } = useSafeAreaInsets();
  const now = new Date();
  const [year] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const { data: entries } = useDiaryTimeline(year, month);

  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Calendar Timeline</Text>
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setMonth(m => m === 1 ? 12 : m - 1)}>
          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName} {year}</Text>
        <TouchableOpacity onPress={() => setMonth(m => m === 12 ? 1 : m + 1)}>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.date}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.entryCard}>
            <Text style={styles.entryDate}>{item.date}</Text>
            <Text style={styles.entryCount}>{item.count} page{item.count > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No entries this month</Text>
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
  monthNav: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, paddingVertical: 16 },
  chevron: { fontSize: 32, color: '#410403', paddingHorizontal: 16 },
  monthTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 20, color: '#1b1c17' },
  entryCard: { marginHorizontal: 24, padding: 16, backgroundColor: '#fff', borderRadius: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryDate: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 16, color: '#410403' },
  entryCount: { fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#554240' },
  empty: { textAlign: 'center', paddingTop: 60, fontFamily: 'WorkSans_400Regular', fontSize: 16, color: '#88726f' },
});
