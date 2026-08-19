import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { lazyScreen } from 'src/components/ui/LazyScreen';
import { HomeScreenRouter } from './screenRouters';
import { HealthHubScreen } from 'src/screens/companion/HealthHubScreen';
import { SOSActiveScreen } from 'src/screens/safety/SOSActiveScreen';
import { SafetyHomeScreen } from 'src/screens/safety/SafetyHomeScreen';
import { EmergencyContactsScreen } from 'src/screens/safety/EmergencyContactsScreen';
import { EmergencyContactEditScreen } from 'src/screens/safety/EmergencyContactEditScreen';
import { SosHistoryScreen } from 'src/screens/safety/SosHistoryScreen';

const MoodLogScreen = lazyScreen(() => import('src/screens/wellness/MoodLogScreen'), 'MoodLogScreen');
const CyclePredictionsScreen = lazyScreen(() => import('src/screens/cycle/CyclePredictionsScreen'), 'CyclePredictionsScreen');
const VideoLibraryScreen = lazyScreen(() => import('src/screens/wellness/VideoLibraryScreen'), 'VideoLibraryScreen');
const ContentDetailScreen = lazyScreen(() => import('src/screens/wellness/ContentDetailScreen'), 'ContentDetailScreen');
const JournalListScreen = lazyScreen(() => import('src/screens/wellness/JournalListScreen'), 'JournalListScreen');
const JournalEntryScreen = lazyScreen(() => import('src/screens/wellness/JournalEntryScreen'), 'JournalEntryScreen');
const MoodHistoryScreen = lazyScreen(() => import('src/screens/wellness/MoodHistoryScreen'), 'MoodHistoryScreen');
const BreathingListScreen = lazyScreen(() => import('src/screens/wellness/BreathingListScreen'), 'BreathingListScreen');
const InsightsScreen = lazyScreen(() => import('src/screens/wellness/InsightsScreen'), 'InsightsScreen');
const DiaryLibraryScreen = lazyScreen(() => import('src/screens/diary/DiaryLibraryScreen'), 'DiaryLibraryScreen');
const DiaryScreen = lazyScreen(() => import('src/screens/diary/DiaryScreen'), 'DiaryScreen');
const DiaryPageScreen = lazyScreen(() => import('src/screens/diary/DiaryPageScreen'), 'DiaryPageScreen');
const DiaryEditorScreen = lazyScreen(() => import('src/screens/diary/DiaryEditorScreen'), 'DiaryEditorScreen');
const DiaryTimelineScreen = lazyScreen(() => import('src/screens/diary/DiaryTimelineScreen'), 'DiaryTimelineScreen');
const DiarySearchScreen = lazyScreen(() => import('src/screens/diary/DiarySearchScreen'), 'DiarySearchScreen');
const DiaryAssetInstallScreen = lazyScreen(() => import('src/screens/diary/DiaryAssetInstallScreen'), 'DiaryAssetInstallScreen');

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
