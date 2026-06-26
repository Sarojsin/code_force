import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import { useTheme } from 'src/theme';
import { CycleDashboardScreen } from 'src/screens/cycle/CycleDashboardScreen';
import { LogPeriodScreen } from 'src/screens/cycle/LogPeriodScreen';
import { CycleHistoryScreen } from 'src/screens/cycle/CycleHistoryScreen';
import { CyclePredictionsScreen } from 'src/screens/cycle/CyclePredictionsScreen';
import { CycleAnalyticsScreen } from 'src/screens/cycle/CycleAnalyticsScreen';
import { WellnessHomeScreen } from 'src/screens/wellness/WellnessHomeScreen';
import { JournalListScreen } from 'src/screens/wellness/JournalListScreen';
import { JournalEntryScreen } from 'src/screens/wellness/JournalEntryScreen';
import { MoodLogScreen } from 'src/screens/wellness/MoodLogScreen';
import { MoodHistoryScreen } from 'src/screens/wellness/MoodHistoryScreen';
import { BreathingListScreen } from 'src/screens/wellness/BreathingListScreen';
import { InsightsScreen } from 'src/screens/wellness/InsightsScreen';
import { PregnancyHomeScreen } from 'src/screens/pregnancy/PregnancyHomeScreen';
import { PregnancyProfileScreen } from 'src/screens/pregnancy/PregnancyProfileScreen';
import { PregnancyDailyLogScreen } from 'src/screens/pregnancy/PregnancyDailyLogScreen';
import { PregnancyMilestonesScreen } from 'src/screens/pregnancy/PregnancyMilestonesScreen';
import { PregnancyRecommendationsScreen } from 'src/screens/pregnancy/PregnancyRecommendationsScreen';
import { SafetyHomeScreen } from 'src/screens/safety/SafetyHomeScreen';
import { EmergencyContactsScreen } from 'src/screens/safety/EmergencyContactsScreen';
import { EmergencyContactEditScreen } from 'src/screens/safety/EmergencyContactEditScreen';
import { SosHistoryScreen } from 'src/screens/safety/SosHistoryScreen';
import { SOSActiveScreen } from 'src/screens/safety/SOSActiveScreen';
import { ProfileHomeScreen } from 'src/screens/profile/ProfileHomeScreen';
import { EditProfileScreen } from 'src/screens/profile/EditProfileScreen';
import { ChangePasswordScreen } from 'src/screens/profile/ChangePasswordScreen';
import { SettingsScreen } from 'src/screens/profile/SettingsScreen';
import { LinkedFamilyScreen } from 'src/screens/profile/LinkedFamilyScreen';

import type {
  CycleStackParamList,
  PregnancyStackParamList,
  ProfileStackParamList,
  SafetyStackParamList,
  WellnessStackParamList,
} from './types';

function useStackScreenOptions() {
  const theme = useTheme();
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.textPrimary,
    headerTitleStyle: theme.typography.h3,
    cardStyle: { backgroundColor: theme.colors.background },
  };
}

const WellnessNav = createStackNavigator<WellnessStackParamList>();
export function WellnessStack() {
  const opts = useStackScreenOptions();
  return (
    <WellnessNav.Navigator screenOptions={opts}>
      <WellnessNav.Screen name="WellnessHome" component={WellnessHomeScreen} options={{ title: 'Wellness' }} />
      <WellnessNav.Screen name="JournalList" component={JournalListScreen} options={{ title: 'Journal' }} />
      <WellnessNav.Screen name="JournalEntry" component={JournalEntryScreen} options={{ title: 'Journal Entry' }} />
      <WellnessNav.Screen name="MoodLog" component={MoodLogScreen} options={{ title: 'Log Mood' }} />
      <WellnessNav.Screen name="MoodHistory" component={MoodHistoryScreen} options={{ title: 'Mood History' }} />
      <WellnessNav.Screen name="BreathingList" component={BreathingListScreen} options={{ title: 'Breathing' }} />
      <WellnessNav.Screen name="Insights" component={InsightsScreen} options={{ title: 'Insights' }} />
    </WellnessNav.Navigator>
  );
}

const CycleNav = createStackNavigator<CycleStackParamList>();
export function CycleStack() {
  const opts = useStackScreenOptions();
  return (
    <CycleNav.Navigator screenOptions={opts}>
      <CycleNav.Screen name="CycleDashboard" component={CycleDashboardScreen} options={{ title: 'Cycle' }} />
      <CycleNav.Screen name="LogPeriod" component={LogPeriodScreen} options={{ title: 'Log Period' }} />
      <CycleNav.Screen name="CycleHistory" component={CycleHistoryScreen} options={{ title: 'History' }} />
      <CycleNav.Screen name="CyclePredictions" component={CyclePredictionsScreen} options={{ title: 'Predictions' }} />
      <CycleNav.Screen name="CycleAnalytics" component={CycleAnalyticsScreen} options={{ title: 'Analytics' }} />
    </CycleNav.Navigator>
  );
}

const PregnancyNav = createStackNavigator<PregnancyStackParamList>();
export function PregnancyStack() {
  const opts = useStackScreenOptions();
  return (
    <PregnancyNav.Navigator screenOptions={opts}>
      <PregnancyNav.Screen name="PregnancyHome" component={PregnancyHomeScreen} options={{ title: 'Pregnancy' }} />
      <PregnancyNav.Screen name="PregnancyProfile" component={PregnancyProfileScreen} options={{ title: 'My Profile' }} />
      <PregnancyNav.Screen name="PregnancyDailyLog" component={PregnancyDailyLogScreen} options={{ title: 'Daily Log' }} />
      <PregnancyNav.Screen name="PregnancyMilestones" component={PregnancyMilestonesScreen} options={{ title: 'Milestones' }} />
      <PregnancyNav.Screen name="PregnancyRecommendations" component={PregnancyRecommendationsScreen} options={{ title: 'Recommendations' }} />
    </PregnancyNav.Navigator>
  );
}

const SafetyNav = createStackNavigator<SafetyStackParamList>();
export function SafetyStack() {
  const opts = useStackScreenOptions();
  return (
    <SafetyNav.Navigator screenOptions={opts}>
      <SafetyNav.Screen name="SafetyHome" component={SafetyHomeScreen} options={{ title: 'Safety' }} />
      <SafetyNav.Screen name="EmergencyContacts" component={EmergencyContactsScreen} options={{ title: 'Emergency Contacts' }} />
      <SafetyNav.Screen name="EmergencyContactEdit" component={EmergencyContactEditScreen} options={{ title: 'Contact' }} />
      <SafetyNav.Screen name="SosHistory" component={SosHistoryScreen} options={{ title: 'SOS History' }} />
      <SafetyNav.Screen name="SOSActive" component={SOSActiveScreen} options={{ title: 'SOS Active', headerShown: false }} />
    </SafetyNav.Navigator>
  );
}

const ProfileNav = createStackNavigator<ProfileStackParamList>();
export function ProfileStack() {
  const opts = useStackScreenOptions();
  return (
    <ProfileNav.Navigator screenOptions={opts}>
      <ProfileNav.Screen name="ProfileHome" component={ProfileHomeScreen} options={{ title: 'Profile' }} />
      <ProfileNav.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <ProfileNav.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
      <ProfileNav.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <ProfileNav.Screen name="LinkedFamily" component={LinkedFamilyScreen} options={{ title: 'Linked Family' }} />
    </ProfileNav.Navigator>
  );
}
