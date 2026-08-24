import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenSkeleton, Text as Txt, ErrorState, EmptyState } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useBreathingExercises } from 'src/services/queries/wellness';
import { BreathingExerciseCard, BreathingTimer } from 'src/components/ui/wellness/BreathingExerciseCard';
import type { BreathingExercise } from 'src/services/api';

export function BreathingListScreen() {
  const theme = useTheme();
  const { data: exercises, isLoading, isError, refetch } = useBreathingExercises();
  const [activeExercise, setActiveExercise] = useState<BreathingExercise | null>(null);

  const handlePress = useCallback((exercise: BreathingExercise) => {
    setActiveExercise(exercise);
  }, []);

  const handleClose = useCallback(() => {
    setActiveExercise(null);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: BreathingExercise }) => (
      <BreathingExerciseCard
        exercise={item}
        phaseColor={theme.colors.primary}
        onPress={() => handlePress(item)}
      />
    ),
    [handlePress, theme.colors.primary],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScreenSkeleton variant="list" count={4} label="Loading exercises…" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ErrorState message="Couldn't load breathing exercises." onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={exercises ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        windowSize={5}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={7}
        ListHeaderComponent={
          <View style={styles.header}>
            <Txt variant="h1">Breathing Exercises</Txt>
            <Txt variant="body" color="secondary">Guided exercises to calm your mind.</Txt>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            message="No exercises available right now."
          />
        }
      />

      {activeExercise && (
        <BreathingTimer
          exercise={activeExercise}
          visible={true}
          onClose={handleClose}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 24 },
  header: { marginBottom: 24 },
});
