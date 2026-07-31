import { View, ScrollView, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

interface ScrapbookCanvasProps {
  children: ReactNode;
  background?: 'paper' | 'grid' | 'none';
}

export function ScrapbookCanvas({ children, background = 'paper' }: ScrapbookCanvasProps) {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={[styles.canvas, background === 'grid' && styles.gridBg]}>
        {children}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, marginHorizontal: 12 },
  scrollContent: { paddingVertical: 16 },
  canvas: {
    minHeight: 600,
    backgroundColor: '#fffcf5',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#410403',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#f0eee6',
  },
  gridBg: {},
});
