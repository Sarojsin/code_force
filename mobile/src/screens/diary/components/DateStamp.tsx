import { View, Text, StyleSheet } from 'react-native';
import { typography } from 'src/theme';

interface DateStampProps {
  date: string;
  format?: 'full' | 'short' | 'dayMonth';
}

const MONTHS = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

export function DateStamp({ date, format = 'full' }: DateStampProps) {
  const d = new Date(date);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const dow = DAYS[d.getDay()];

  return (
    <View style={styles.container}>
      <Text style={styles.dayNum}>{day}</Text>
      <View style={styles.right}>
        <Text style={styles.month}>{format === 'short' ? month.slice(0, 3) : month}</Text>
        <Text style={styles.dow}>{dow} · {year}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fbf9f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e3db',
  },
  dayNum: {
    fontFamily: 'LibreCaslonText_600SemiBold',
    fontSize: 28,
    color: '#410403',
    lineHeight: 32,
  },
  right: { justifyContent: 'center' },
  month: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: typography.label.fontSize,
    color: '#554240',
    letterSpacing: 1.5,
  },
  dow: {
    fontFamily: 'WorkSans_400Regular',
    fontSize: typography.annotation.fontSize,
    color: '#88726f',
    letterSpacing: 0.5,
  },
});
