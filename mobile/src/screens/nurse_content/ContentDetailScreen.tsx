/**
 * ContentDetailScreen — view educational content.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';

const MOCK_CONTENT = {
  id: '1',
  title: 'Understanding Your Cycle',
  category: 'Menstrual Health',
  readTime: '5 min',
  content: `The menstrual cycle is the monthly series of changes a woman's body goes through in preparation for a possible pregnancy. Each cycle averages 28 days but can range from 21 to 35 days.

The cycle is divided into four phases:

1. Menstrual Phase (Days 1-5)
This is when you have your period. The uterus sheds its lining, and bleeding typically lasts 3-7 days.

2. Follicular Phase (Days 1-13)
The pituitary gland releases FSH, which stimulates the ovaries to produce follicles. Each follicle contains an egg.

3. Ovulation (Day 14)
A surge in LH causes the mature egg to be released from the ovary. This is your most fertile window.

4. Luteal Phase (Days 15-28)
The ruptured follicle becomes the corpus luteum, producing progesterone to thicken the uterine lining.

Tracking your cycle helps you understand your body's unique rhythm and identify any irregularities.`,
};

export function ContentDetailScreen() {
  const theme = useTheme();

  const handleBookmark = () => {
    logger.info('ContentDetailScreen.bookmark', { id: MOCK_CONTENT.id });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <View style={[styles.categoryBadge, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.sm, alignSelf: 'flex-start' }]}>
          <Txt variant="caption" color="primary">{MOCK_CONTENT.category}</Txt>
        </View>
        <Txt variant="h1" style={{ marginTop: theme.spacing.sm }}>{MOCK_CONTENT.title}</Txt>
        <Txt variant="caption" color="muted" style={{ marginTop: theme.spacing.xs }}>{MOCK_CONTENT.readTime} read</Txt>

        <Card style={{ marginTop: theme.spacing.lg }}>
          <Txt variant="body" style={{ lineHeight: 24 }}>{MOCK_CONTENT.content}</Txt>
        </Card>

        <View style={styles.actions}>
          <Button label="Bookmark" variant="outline" onPress={handleBookmark} style={{ flex: 1, marginRight: theme.spacing.sm }} />
          <Button label="Share" variant="outline" onPress={() => logger.info('ContentDetailScreen.share')} style={{ flex: 1, marginLeft: theme.spacing.sm }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', marginTop: 24 },
});
