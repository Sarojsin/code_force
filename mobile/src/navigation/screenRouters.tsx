import React, { useEffect } from 'react';
import { usePregnancyModeStore } from 'src/stores/pregnancyModeStore';
import { HomeDashboardScreen } from 'src/screens/home/HomeDashboardScreen';
import { PregnancyHomeScreen } from 'src/screens/pregnancy/PregnancyHomeScreen';
import { CalendarScreen } from 'src/screens/calendar/CalendarScreen';
import { PregnancyCalendarScreen } from 'src/screens/pregnancy/PregnancyCalendarScreen';

export function HomeScreenRouter() {
  const isActive = usePregnancyModeStore((s) => s.isActive);
  const hydrate = usePregnancyModeStore((s) => s.hydrate);
  const setWeek = usePregnancyModeStore((s) => s.setWeek);

  useEffect(() => { hydrate(); }, [hydrate]);

  if (isActive) {
    return (
      <PregnancyHomeScreen
        onWeekChange={setWeek}
      />
    );
  }

  return <HomeDashboardScreen />;
}

export function CalendarScreenRouter() {
  const isActive = usePregnancyModeStore((s) => s.isActive);

  if (isActive) {
    return <PregnancyCalendarScreen />;
  }

  return <CalendarScreen />;
}
