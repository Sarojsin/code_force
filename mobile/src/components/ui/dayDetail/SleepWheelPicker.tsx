import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

const HOURS = Array.from({ length: 13 }, (_, i) => i); // 0-12
const MINUTES = [0, 15, 30, 45];

interface SleepWheelProps {
  totalMinutes: number;
  onChange: (minutes: number) => void;
}

function WheelColumn({
  items,
  selected,
  onSelect,
  formatItem,
  theme,
  label,
}: {
  items: number[];
  selected: number;
  onSelect: (v: number) => void;
  formatItem: (v: number) => string;
  theme: ReturnType<typeof useTheme>;
  label: string;
}) {
  return (
    <View style={styles.wheelCol}>
      <Text variant="helper" color="muted" style={{ textAlign: 'center', marginBottom: 4 }}>{label}</Text>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.wheelScroll}
        contentContainerStyle={styles.wheelContent}
      >
        {items.map((item) => {
          const isSel = item === selected;
          return (
            <Pressable
              key={item}
              onPress={() => onSelect(item)}
              accessibilityLabel={`${item} ${label}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSel }}
              style={[
                styles.wheelItem,
                {
                  backgroundColor: isSel ? theme.colors.primaryDeep : 'transparent',
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: isSel ? '#FFFFFF' : theme.colors.textStrong,
                    fontWeight: isSel ? '700' : '400',
                  },
                ]}
              >
                {formatItem(item)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function SleepWheelPicker({ totalMinutes, onChange }: SleepWheelProps) {
  const theme = useTheme();
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const setHours = useCallback((h: number) => {
    onChange(h * 60 + minutes);
  }, [minutes, onChange]);

  const setMinutes = useCallback((m: number) => {
    onChange(hours * 60 + m);
  }, [hours, onChange]);

  return (
    <View style={styles.container}>
      <View style={styles.display}>
        <Text variant="h2" style={{ color: theme.colors.primaryDeep }}>
          {hours}h {minutes.toString().padStart(2, '0')}m
        </Text>
      </View>
      <View style={styles.wheels}>
        <WheelColumn
          items={HOURS}
          selected={hours}
          onSelect={setHours}
          formatItem={(v) => `${v}h`}
          theme={theme}
          label="Hours"
        />
        <WheelColumn
          items={MINUTES}
          selected={minutes}
          onSelect={setMinutes}
          formatItem={(v) => `${v.toString().padStart(2, '0')}m`}
          theme={theme}
          label="Min"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  display: { alignItems: 'center', paddingVertical: 8 },
  wheels: { flexDirection: 'row', gap: 16, justifyContent: 'center' },
  wheelCol: { flex: 1, maxWidth: 120 },
  wheelScroll: { maxHeight: 160 },
  wheelContent: { gap: 4, paddingVertical: 8 },
  wheelItem: { paddingVertical: 10, alignItems: 'center' },
  wheelText: { fontSize: 16 },
});
