import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useCompanionStore } from '../../stores/companionStore';
import { useHealthMetricsStore } from '../../stores/healthMetricsStore';
import { HealthMetricCard } from '../../components/ui/HealthMetricCard';
import { StreakBadge } from '../../components/ui/StreakBadge';
import { useFocusEffect } from '@react-navigation/native';
import { getDailyTips } from '../../services/healthTips';
import type { HealthTipCategory } from '../../services/healthTips';

const METRICS_CONFIG = [
  {
    key: 'sleep' as const,
    icon: '\u{1F6CF}\u{FE0F}',
    label: 'Sleep',
    target: '8 hrs',
    getValue: (v: any) => (v?.hours ? `${v.hours}h` : '--'),
    parseTarget: '8',
    logPrompt: 'How many hours did you sleep?',
  },
  {
    key: 'food' as const,
    icon: '\u{1F37D}\u{FE0F}',
    label: 'Food',
    target: '3 meals',
    getValue: (v: any) => {
      if (!v?.mealType) return '--';
      const count = v.mealType === 'snack' ? 0 : 1;
      return `${count}/3`;
    },
    parseTarget: '3',
    logPrompt: 'What did you eat?',
  },
  {
    key: 'water' as const,
    icon: '\u{1F4A7}',
    label: 'Water',
    target: '2000mL',
    getValue: (v: any) => (v?.amount ? `${v.amount}mL` : '--'),
    parseTarget: '2000',
    logPrompt: 'How much water did you drink (mL)?',
  },
  {
    key: 'exercise' as const,
    icon: '\u{1F3CB}\u{FE0F}',
    label: 'Exercise',
    target: '30 min',
    getValue: (v: any) => (v?.duration ? `${v.duration}min` : '--'),
    parseTarget: '30',
    logPrompt: 'How many minutes did you exercise?',
  },
  {
    key: 'medication' as const,
    icon: '\u{1F48A}',
    label: 'Medication',
    target: 'Taken',
    getValue: (v: any) => (v?.taken ? '\u2705' : '--'),
    parseTarget: '1',
    logPrompt: 'Did you take your medication?',
  },
];

export function HealthHubScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useCompanionStore((s) => s.userId);
  const todayLogs = useHealthMetricsStore((s) => s.todayLogs);
  const streaks = useHealthMetricsStore((s) => s.streaks);
  const completion = useHealthMetricsStore((s) => s.completion);
  const isLoading = useHealthMetricsStore((s) => s.isLoading);
  const hydrate = useHealthMetricsStore((s) => s.hydrate);
  const logMetric = useHealthMetricsStore((s) => s.logMetric);

  const [tips, setTips] = useState<{ category: HealthTipCategory; tip: string }[]>([]);
  const [tipsLoading, setTipsLoading] = useState(true);

  const loadTips = useCallback(async () => {
    setTipsLoading(true);
    const result = await getDailyTips();
    setTips(result);
    setTipsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        hydrate(userId);
        loadTips();
      }
    }, [userId, hydrate, loadTips])
  );

  const [logModal, setLogModal] = useState<{
    visible: boolean;
    metricKey: string;
    label: string;
    placeholder: string;
    keyboardType?: 'default' | 'numeric';
  }>({ visible: false, metricKey: '', label: '', placeholder: '' });

  const [logInput, setLogInput] = useState('');

  const handleLog = useCallback(
    async (metricKey: string) => {
      if (!userId) return;

      switch (metricKey) {
        case 'sleep':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Hours slept',
            placeholder: '8',
            keyboardType: 'numeric',
          });
          break;
        case 'water':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Amount in mL',
            placeholder: '250',
            keyboardType: 'numeric',
          });
          break;
        case 'exercise':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Duration in minutes',
            placeholder: '30',
            keyboardType: 'numeric',
          });
          break;
        case 'food':
          setLogModal({
            visible: true,
            metricKey,
            label: 'Meal type (breakfast/lunch/dinner/snack)',
            placeholder: 'lunch',
            keyboardType: 'default',
          });
          break;
        case 'medication':
          await logMetric(userId, 'medication', {
            name: 'Supplements',
            taken: true,
          });
          break;
      }
    },
    [userId, logMetric]
  );

  const handleLogSubmit = useCallback(async () => {
    if (!userId) return;
    const { metricKey } = logModal;
    const value = logInput.trim();

    switch (metricKey) {
      case 'sleep': {
        const h = parseFloat(value);
        if (!isNaN(h) && h > 0) await logMetric(userId, 'sleep', { hours: h });
        break;
      }
      case 'water': {
        const a = parseInt(value, 10);
        if (!isNaN(a) && a > 0) await logMetric(userId, 'water', { amount: a });
        break;
      }
      case 'exercise': {
        const d = parseInt(value, 10);
        if (!isNaN(d) && d > 0) {
          await logMetric(userId, 'exercise', { type: 'general', duration: d });
        }
        break;
      }
      case 'food': {
        const valid = ['breakfast', 'lunch', 'dinner', 'snack'];
        if (valid.includes(value)) {
          await logMetric(userId, 'food', { mealType: value });
        }
        break;
      }
    }
    setLogInput('');
    setLogModal((prev) => ({ ...prev, visible: false }));
  }, [userId, logModal, logInput, logMetric]);

  const completionPercent = completion.total > 0
    ? (completion.logged.length / completion.total) * 100
    : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
        Health Hub
      </Text>
      <View style={styles.lunaBubble}>
        <Text style={[styles.bubbleText, { color: theme.colors.textPrimary }]}>
          {isLoading
            ? 'Loading your stats...'
            : completion.logged.length === 0
              ? 'Good morning! Let\'s start tracking today!'
              : `You've logged ${completion.logged.length}/5 metrics! Keep going!`}
        </Text>
      </View>

      <View style={styles.grid}>
        {METRICS_CONFIG.map((cfg) => {
          const logs = todayLogs[cfg.key] || [];
          const lastLog = logs[logs.length - 1];
          const val = cfg.getValue(lastLog?.value);
          return (
            <HealthMetricCard
              key={cfg.key}
              icon={cfg.icon}
              label={cfg.label}
              value={val}
              target={cfg.target}
              logged={logs.length > 0}
              streak={streaks[cfg.key] || 0}
              onPress={() => handleLog(cfg.key)}
            />
          );
        })}
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Today's Progress
        </Text>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${completionPercent}%`,
                backgroundColor: theme.colors.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.colors.textMuted }]}>
          {completion.logged.length} of {completion.total} metrics logged
        </Text>
        <View style={styles.metricDots}>
          {METRICS_CONFIG.map((cfg) => (
            <Text key={cfg.key}>
              {cfg.icon}{' '}
              {completion.logged.includes(cfg.key) ? '\u2705' : '\u2B1C'}
            </Text>
          ))}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          Streaks
        </Text>
        <View style={styles.streakRow}>
          {METRICS_CONFIG.map((cfg) => (
            <StreakBadge
              key={cfg.key}
              metricType={cfg.label}
              count={streaks[cfg.key] || 0}
              icon={cfg.icon}
            />
          ))}
        </View>
      </View>

      <View
        style={[
          styles.section,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
          {'\uD83D\uDCA1'} Health Tips
        </Text>
        {tipsLoading ? (
          <Text style={{ color: theme.colors.textMuted }}>Loading tips...</Text>
        ) : tips.length === 0 ? (
          <Text style={{ color: theme.colors.textMuted }}>
            Check back later for more tips!
          </Text>
        ) : (
          tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>{'\u2022'}</Text>
              <Text style={[styles.tipText, { color: theme.colors.textPrimary }]}>
                {tip.tip}
              </Text>
            </View>
          ))
        )}
      </View>

      <Modal
        visible={logModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogModal((prev) => ({ ...prev, visible: false }))}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
              Log {logModal.label}
            </Text>
            <TextInput
              value={logInput}
              onChangeText={setLogInput}
              placeholder={logModal.placeholder}
              keyboardType={logModal.keyboardType || 'default'}
              autoFocus
              style={[
                styles.modalInput,
                {
                  backgroundColor: theme.colors.background,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.textMuted,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => {
                  setLogInput('');
                  setLogModal((prev) => ({ ...prev, visible: false }));
                }}
                style={styles.modalBtn}
              >
                <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleLogSubmit} style={styles.modalBtn}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 24, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  lunaBubble: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f0f8ff',
  },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressText: { fontSize: 13, marginBottom: 8 },
  metricDots: { flexDirection: 'row', justifyContent: 'space-around' },
  streakRow: { flexDirection: 'row', flexWrap: 'wrap' },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 14,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tipBullet: {
    fontSize: 14,
    marginRight: 8,
    color: '#666',
  },
  tipText: {
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
