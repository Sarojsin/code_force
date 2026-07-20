import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  Phone: undefined;
  Otp: { phone: string; expiresIn: number; devCode?: string | null };
  Mfa: { phone: string };
};

export type WellnessStackParamList = {
  WellnessHome: undefined;
  JournalList: undefined;
  JournalEntry: { id: string };
  MoodLog: undefined;
  MoodHistory: undefined;
  BreathingList: undefined;
  Insights: undefined;
  Videos: undefined;
};

export type CycleStackParamList = {
  CycleDashboard: { markEndDate?: boolean } | undefined;
  LogPeriod: undefined;
  CycleHistory: undefined;
  CyclePredictions: undefined;
  CycleAnalytics: undefined;
  PhaseDetail: { phase: string };
};

export type PregnancyStackParamList = {
  PregnancyHome: undefined;
  PregnancyProfile: undefined;
  PregnancyDailyLog: undefined;
  PregnancyMilestones: undefined;
  PregnancyRecommendations: undefined;
};

export type SafetyStackParamList = {
  SafetyHome: undefined;
  EmergencyContacts: undefined;
  EmergencyContactEdit: { id?: string };
  SosHistory: undefined;
  SOSActive: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  ChangePassword: undefined;
  Settings: undefined;
  LinkedFamily: undefined;
};

export type ChatStackParamList = {
  ChatHome: undefined;
  ChatRoom: { roomId: string };
};

export type HomeStackParamList = {
  HomeDashboard: undefined;
  MoodLog: undefined;
  CyclePredictions: undefined;
  Videos: undefined;
  AIChat: undefined;
  JournalList: undefined;
  JournalEntry: { id: string };
  WellnessHub: undefined;
  MoodHistory: undefined;
  BreathingList: undefined;
  Insights: undefined;
};

export type CalendarStackParamList = {
  CalendarMain: undefined;
  PhaseDetail: { phase: string };
  CycleDashboard: { markEndDate?: boolean } | undefined;
  LogPeriod: undefined;
  CycleHistory: undefined;
  CyclePredictions: undefined;
  CycleAnalytics: undefined;
};

export type AnalyticsStackParamList = {
  AnalyticsMain: undefined;
  AnalyticsDetail: { section: string };
};

export type AIChatStackParamList = {
  AIChatMain: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  PersonalInfo: undefined;
  Lifestyle: undefined;
  CurrentCycle: undefined;
  PastCycle1: undefined;
  PastCycle2: undefined;
  PastCycle3: undefined;
  Complete: undefined;
};

export type MainTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Calendar: NavigatorScreenParams<CalendarStackParamList>;
  Analytics: NavigatorScreenParams<AnalyticsStackParamList>;
  AIChat: NavigatorScreenParams<AIChatStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Chat: NavigatorScreenParams<ChatStackParamList>;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
