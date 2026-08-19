import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from 'src/components/ui';

import { BentoGridProps } from './types';

function BentoGridBase({
  diaryAssetStatus,
  onJournal,
  onDiary,
  onVideos,
}: BentoGridProps) {
  return (
    <>
      <View style={styles.bentoRow}>
        <View style={styles.bentoHalfLeft}>
          <Pressable onPress={onJournal} style={styles.bentoCard}>
            <View style={styles.bentoIcon}>
              <LinearGradient colors={['#FFB3C6', '#FF6B8A']} style={styles.bentoGradient} />
              <Text style={styles.bentoEmoji}>📒</Text>
            </View>
            <Text variant="h3" style={styles.bentoTitle}>Simple Journal</Text>
            <Text variant="caption" color="muted">Quick thoughts in seconds</Text>
          </Pressable>
        </View>
        <View style={styles.bentoHalfRight}>
          <Pressable onPress={onDiary} style={styles.bentoCard}>
            <View style={styles.bentoIcon}>
              <LinearGradient colors={['#E8D5B7', '#D4A574']} style={styles.bentoGradient} />
              <Text style={styles.bentoEmoji}>📖</Text>
            </View>
            <Text variant="h3" style={styles.bentoTitle}>Memory Diary</Text>
            <View style={styles.bentoSubRow}>
              <Text variant="caption" color="muted">Create a beautiful scrapbook</Text>
              {diaryAssetStatus !== 'ready' && (
                <Text style={styles.bentoBadge}>⬇</Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={onVideos} style={[styles.bentoCard, styles.bentoCardWide]}>
        <View style={styles.bentoIcon}>
          <LinearGradient colors={['#60A5FA', '#3B82F6']} style={styles.bentoGradient} />
          <Text style={styles.bentoEmoji}>🏥</Text>
        </View>
        <Text variant="h3" style={styles.bentoTitle}>Health Library</Text>
        <Text variant="caption" color="muted">Videos, articles & tips from health experts</Text>
      </Pressable>
    </>
  );
}

export const BentoGrid = memo(BentoGridBase);

const styles = StyleSheet.create({
  bentoRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bentoHalfLeft: {
    flex: 1,
    marginRight: 6,
  },
  bentoHalfRight: {
    flex: 1,
    marginLeft: 6,
  },
  bentoCard: {
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
    minHeight: 110,
    backgroundColor: '#fff',
    borderRadius: 20,
  },
  bentoCardWide: {
    marginBottom: 24,
  },
  bentoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    borderRadius: 12,
  },
  bentoGradient: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 12,
  },
  bentoEmoji: {
    fontSize: 20,
  },
  bentoTitle: {
    marginTop: 8,
  },
  bentoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bentoBadge: {
    fontSize: 10,
    color: '#D97706',
  },
});

export default BentoGrid;