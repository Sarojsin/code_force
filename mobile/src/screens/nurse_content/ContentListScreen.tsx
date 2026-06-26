/**
 * ContentListScreen — educational content list.
 */

import React from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface ContentItem {
  id: string;
  title: string;
  category: string;
  summary: string;
  readTime: string;
  icon: string;
}

const MOCK_CONTENT: ContentItem[] = [
  { id: '1', title: 'Understanding Your Cycle', category: 'Menstrual Health', summary: 'Learn about the phases of your menstrual cycle.', readTime: '5 min', icon: '&#128200;' },
  { id: '2', title: 'Nutrition During Pregnancy', category: 'Pregnancy', summary: 'Essential nutrients for a healthy pregnancy.', readTime: '8 min', icon: '&#129374;' },
  { id: '3', title: 'Mental Health & Wellness', category: 'Wellness', summary: 'Tips for managing stress and anxiety.', readTime: '6 min', icon: '&#129495;' },
  { id: '4', title: 'Emergency Contraception', category: 'Sexual Health', summary: 'Types and how they work.', readTime: '4 min', icon: '&#128137;' },
  { id: '5', title: 'Breast Self-Exam Guide', category: 'Preventive Care', summary: 'Step-by-step guide for breast health.', readTime: '3 min', icon: '&#128069;' },
  { id: '6', title: 'Birth Control Options', category: 'Sexual Health', summary: 'Compare different methods.', readTime: '10 min', icon: '&#128138;' },
];

export function ContentListScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const renderItem = ({ item }: { item: ContentItem }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.96); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={() => (navigation as any).navigate('ContentDetail', { id: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`${item.title}, ${item.category}`}
        >
          <Card elevated style={{ marginBottom: theme.spacing.md }}>
            <View style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.md }]}>
                <Txt variant="h2">{item.icon}</Txt>
              </View>
              <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
                <Txt variant="caption" color="muted">{item.category}</Txt>
                <Txt variant="h3" style={{ marginTop: 2 }}>{item.title}</Txt>
                <Txt variant="bodySmall" color="secondary" style={{ marginTop: 4 }} numberOfLines={2}>{item.summary}</Txt>
                <Txt variant="caption" color="muted" style={{ marginTop: 6 }}>{item.readTime} read</Txt>
              </View>
            </View>
          </Card>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_CONTENT}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Educational Content</Txt>
            <Txt variant="body" color="secondary">Articles and guides curated for you.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No content available yet.</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
