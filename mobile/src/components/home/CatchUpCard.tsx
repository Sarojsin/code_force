import React from 'react';
import { View, StyleSheet } from 'react-native';

import { BackfillCard, Card, EndDatePromptCard, Text } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCatchUp } from 'src/hooks/useCatchUp';
import { toLocalDateStr } from 'src/utils/date';

function CatchUpCardBase() {
  const theme = useTheme();
  const {
    backfillCards,
    busyMonth,
    isDoneOrSkipped,
    isSkipped,
    handleFill,
    handleSkip,
    endDate,
    confirmEndDate,
    skipEndDate,
    endDateLoading,
  } = useCatchUp();

  const hasPending = Boolean(endDate) || backfillCards.length > 0;

  return (
    <View style={styles.wrap}>
      <Text variant="h3" style={{ marginBottom: theme.spacing.md }}>
        Catch up on your cycle
      </Text>

      {endDate && endDate.periodStartDate && (
        <EndDatePromptCard
          visible
          periodStartDate={endDate.periodStartDate}
          daysSinceStart={endDate.daysSinceStart}
          onConfirmEndDate={() =>
            confirmEndDate(toLocalDateStr(new Date()))
          }
          onSkip={skipEndDate}
          loading={endDateLoading}
        />
      )}

      {backfillCards.map((card, idx) => {
        const filled = isDoneOrSkipped(card.monthLabel);
        const previousDone = idx === 0 || isDoneOrSkipped(backfillCards[idx - 1].monthLabel);
        return (
          <BackfillCard
            key={card.monthLabel}
            monthLabel={card.monthLabel}
            cardNumber={idx + 1}
            disabled={!previousDone && !filled}
            isSkipped={isSkipped(card.monthLabel)}
            onFill={(s, e) => handleFill(s, e, card.monthLabel)}
            onSkip={() => handleSkip(card.expectedStart, card.expectedEnd, card.monthLabel)}
            loading={busyMonth === card.monthLabel}
          />
        );
      })}

      {!hasPending && (
        <Card elevated style={[styles.emptyCard, { borderRadius: theme.radius.lg }]}>
          <View style={styles.emptyRow}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <View style={styles.emptyText}>
              <Text variant="body" style={styles.emptyTitle}>You're all caught up</Text>
              <Text variant="bodySmall" color="secondary">
                No missed periods or unconfirmed dates to log right now.
              </Text>
            </View>
          </View>
        </Card>
      )}
    </View>
  );
}

export const CatchUpCard = React.memo(CatchUpCardBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  emptyCard: { marginBottom: 12 },
  emptyRow: { flexDirection: 'row', alignItems: 'center' },
  emptyEmoji: { fontSize: 24 },
  emptyText: { flex: 1, marginLeft: 12 },
  emptyTitle: { fontWeight: '600' },
});
