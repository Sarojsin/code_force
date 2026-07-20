import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from 'src/theme';
import { Modal } from './Modal';
import { DatePickerField } from './DatePickerField';
import { Button } from './Button';
import { Text } from './Text';

const endDateSchema = z.object({
  endDate: z.string().min(1, 'Please select a date'),
});

interface MarkEndDateModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (endDate: string) => void;
  onSkip: () => void;
  loading?: boolean;
  periodStartDate: string;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function MarkEndDateModal({
  visible,
  onClose,
  onConfirm,
  onSkip,
  loading,
  periodStartDate,
}: MarkEndDateModalProps) {
  const theme = useTheme();
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(endDateSchema),
    defaultValues: { endDate: toDateStr(new Date()) },
  });

  return (
    <Modal visible={visible} onClose={onClose} title="Confirm End Date">
      <Text variant="body" style={{ marginBottom: theme.spacing.md }}>
        When did your period that started on{' '}
        {new Date(periodStartDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })}{' '}
        end?
      </Text>
      <DatePickerField
        control={control}
        name="endDate"
        label="Period end date"
        maximumDate={new Date()}
      />
      <Button
        label="Confirm"
        fullWidth
        onPress={handleSubmit((data) => onConfirm(data.endDate))}
        loading={loading}
        style={{ marginTop: theme.spacing.md }}
      />
      <Button
        label="Skip — I'll add it later"
        fullWidth
        variant="outline"
        onPress={onSkip}
        style={{ marginTop: theme.spacing.sm }}
      />
    </Modal>
  );
}
