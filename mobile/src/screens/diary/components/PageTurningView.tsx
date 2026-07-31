import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';

interface PageTurningViewProps {
  children: ReactNode;
  pageNumber: number;
  totalPages: number;
  onPrev?: () => void;
  onNext?: () => void;
}

export function PageTurningView({ children, pageNumber, totalPages, onPrev, onNext }: PageTurningViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.page}>{children}</View>
      <View style={styles.footer}>
        <TouchableOpacity onPress={onPrev} disabled={!onPrev || pageNumber <= 1} style={[styles.navBtn, (pageNumber <= 1) && styles.disabled]}>
          <Text style={styles.navText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.pageInfo}>
          <Text style={styles.pageNum}>{pageNumber}</Text>
          <Text style={styles.total}>/ {totalPages}</Text>
        </View>
        <TouchableOpacity onPress={onNext} disabled={!onNext || pageNumber >= totalPages} style={[styles.navBtn, (pageNumber >= totalPages) && styles.disabled]}>
          <Text style={styles.navText}>›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
    backgroundColor: '#f0eee6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  disabled: { opacity: 0.3 },
  navText: { fontSize: 24, color: '#410403', lineHeight: 28 },
  pageInfo: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  pageNum: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 18, color: '#410403' },
  total: { fontFamily: 'WorkSans_400Regular', fontSize: 14, color: '#88726f' },
});
