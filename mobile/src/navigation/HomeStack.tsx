import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { HomeDashboardScreen } from 'src/screens/home/HomeDashboardScreen';
import { MoodLogScreen } from 'src/screens/wellness/MoodLogScreen';
import { CyclePredictionsScreen } from 'src/screens/cycle/CyclePredictionsScreen';
import { VideoLibraryScreen } from 'src/screens/home/VideoLibraryScreen';
import { AIChatScreen } from 'src/screens/chat/AIChatScreen';
import { JournalListScreen } from 'src/screens/wellness/JournalListScreen';
import { JournalEntryScreen } from 'src/screens/wellness/JournalEntryScreen';
import { MoodHistoryScreen } from 'src/screens/wellness/MoodHistoryScreen';
import { BreathingListScreen } from 'src/screens/wellness/BreathingListScreen';
import { InsightsScreen } from 'src/screens/wellness/InsightsScreen';

import type { HomeStackParamList } from './types';

const Stack = createStackNavigator<HomeStackParamList>();

export function HomeStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.textPrimary,
        headerTitleStyle: theme.typography.h3,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="HomeDashboard" component={HomeDashboardScreen} options={{ title: 'Home', headerShown: false }} />
      <Stack.Screen name="MoodLog" component={MoodLogScreen} options={{ title: 'Log Mood' }} />
      <Stack.Screen name="MoodHistory" component={MoodHistoryScreen} options={{ title: 'Mood History' }} />
      <Stack.Screen name="CyclePredictions" component={CyclePredictionsScreen} options={{ title: 'Predictions' }} />
      <Stack.Screen name="Videos" component={VideoLibraryScreen} options={{ title: 'Videos' }} />
      <Stack.Screen name="AIChat" component={AIChatScreen} options={{ title: 'AI Chat', headerShown: false }} />
      <Stack.Screen name="JournalList" component={JournalListScreen} options={{ title: 'Journal' }} />
      <Stack.Screen name="JournalEntry" component={JournalEntryScreen} options={{ title: 'Journal Entry' }} />
      <Stack.Screen name="BreathingList" component={BreathingListScreen} options={{ title: 'Breathing' }} />
      <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
    </Stack.Navigator>
  );
}
