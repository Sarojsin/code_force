import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { HomeScreenRouter } from './screenRouters';
import { MoodLogScreen } from 'src/screens/wellness/MoodLogScreen';
import { CyclePredictionsScreen } from 'src/screens/cycle/CyclePredictionsScreen';
import { VideoLibraryScreen } from 'src/screens/wellness/VideoLibraryScreen';
import { ContentDetailScreen } from 'src/screens/wellness/ContentDetailScreen';
import { JournalListScreen } from 'src/screens/wellness/JournalListScreen';
import { JournalEntryScreen } from 'src/screens/wellness/JournalEntryScreen';
import { MoodHistoryScreen } from 'src/screens/wellness/MoodHistoryScreen';
import { BreathingListScreen } from 'src/screens/wellness/BreathingListScreen';
import { InsightsScreen } from 'src/screens/wellness/InsightsScreen';
import { HealthHubScreen } from 'src/screens/companion/HealthHubScreen';
import { SOSActiveScreen } from 'src/screens/safety/SOSActiveScreen';
import { SafetyHomeScreen } from 'src/screens/safety/SafetyHomeScreen';
import { EmergencyContactsScreen } from 'src/screens/safety/EmergencyContactsScreen';
import { EmergencyContactEditScreen } from 'src/screens/safety/EmergencyContactEditScreen';
import { SosHistoryScreen } from 'src/screens/safety/SosHistoryScreen';
import { DiaryLibraryScreen } from 'src/screens/diary/DiaryLibraryScreen';
import { DiaryScreen } from 'src/screens/diary/DiaryScreen';
import { DiaryPageScreen } from 'src/screens/diary/DiaryPageScreen';
import { DiaryEditorScreen } from 'src/screens/diary/DiaryEditorScreen';
import { DiaryTimelineScreen } from 'src/screens/diary/DiaryTimelineScreen';
import { DiarySearchScreen } from 'src/screens/diary/DiarySearchScreen';
import { DiaryAssetInstallScreen } from 'src/screens/diary/DiaryAssetInstallScreen';

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
      <Stack.Screen name="HomeDashboard" component={HomeScreenRouter} options={{ title: 'Home', headerShown: false }} />
      <Stack.Screen name="MoodLog" component={MoodLogScreen} options={{ title: 'Log Mood' }} />
      <Stack.Screen name="MoodHistory" component={MoodHistoryScreen} options={{ title: 'Mood History' }} />
      <Stack.Screen name="CyclePredictions" component={CyclePredictionsScreen} options={{ title: 'Predictions' }} />
      <Stack.Screen name="Videos" component={VideoLibraryScreen} options={{ title: 'Videos' }} />
      <Stack.Screen name="ContentDetail" component={ContentDetailScreen} options={{ title: 'Content' }} />
      <Stack.Screen name="JournalList" component={JournalListScreen} options={{ title: 'Journal' }} />
      <Stack.Screen name="JournalEntry" component={JournalEntryScreen} options={{ title: 'Journal Entry' }} />
      <Stack.Screen name="DiaryLibrary" component={DiaryLibraryScreen} options={{ title: 'Memory Diaries' }} />
      <Stack.Screen name="DiaryScreen" component={DiaryScreen} options={{ title: 'Diary' }} />
      <Stack.Screen name="DiaryPage" component={DiaryPageScreen} options={{ title: 'Memory Page' }} />
      <Stack.Screen name="DiaryEditor" component={DiaryEditorScreen} options={{ title: 'Edit Page', headerShown: false }} />
      <Stack.Screen name="DiaryTimeline" component={DiaryTimelineScreen} options={{ title: 'Timeline' }} />
      <Stack.Screen name="DiarySearch" component={DiarySearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="DiaryAssetInstall" component={DiaryAssetInstallScreen} options={{ title: 'Diary Assets' }} />
      <Stack.Screen name="BreathingList" component={BreathingListScreen} options={{ title: 'Breathing' }} />
      <Stack.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
      <Stack.Screen name="HealthHub" component={HealthHubScreen} options={{ title: 'Health Hub' }} />
      <Stack.Screen name="SafetyHome" component={SafetyHomeScreen} options={{ title: 'Safety' }} />
      <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency Contacts' }} />
      <Stack.Screen name="EmergencyContactEdit" component={EmergencyContactEditScreen} options={{ title: 'Edit Contact' }} />
      <Stack.Screen name="SosHistory" component={SosHistoryScreen} options={{ title: 'SOS History' }} />
      <Stack.Screen name="SOSActive" component={SOSActiveScreen} options={{ title: 'SOS Active', headerShown: false }} />
    </Stack.Navigator>
  );
}
