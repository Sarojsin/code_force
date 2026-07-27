SheCare — Complete Screen Inventory
Here is the exhaustive list of every screen in the SheCare mobile app, organized by feature and navigation flow.

🚪 Auth & Onboarding (Pre-App)
Auth Stack (Unauthenticated)
#	Screen Name	File	Description	Status
1	SplashScreen	src/screens/SplashScreen.tsx	Branded splash with animation, hydrates auth store	✅ Done
2	LoginScreen	src/screens/auth/LoginScreen.tsx	Email + password login, "Forgot password?" link	✅ Done
3	RegisterScreen	src/screens/auth/RegisterScreen.tsx	Create account with email, password, display name	✅ Done
4	PhoneScreen	src/screens/auth/PhoneScreen.tsx	Phone number entry for OTP (legacy, kept for MFA)	✅ Done
5	OtpScreen	src/screens/auth/OtpScreen.tsx	OTP verification (legacy, kept for MFA)	✅ Done
Onboarding Stack (First-time Users)
#	Screen Name	File	Description	Status
6	WelcomeScreen	src/screens/onboarding/WelcomeScreen.tsx	Intro splash, privacy-first promise, "Get started"	✅ Done
7	PersonalInfoScreen	src/screens/onboarding/PersonalInfoScreen.tsx	Age, Height (cm), Weight (kg)	✅ Done
8	LifestyleScreen	src/screens/onboarding/LifestyleScreen.tsx	Stress, Exercise, Sleep, Diet	✅ Done
9	CurrentCycleScreen	src/screens/onboarding/CurrentCycleScreen.tsx	Cycle start date, length, period length, symptoms	✅ Done
10	PastCycle1Screen	src/screens/onboarding/PastCycleScreen.tsx	Past cycle 1 (reused component)	✅ Done
11	PastCycle2Screen	src/screens/onboarding/PastCycleScreen.tsx	Past cycle 2 (reused component)	✅ Done
12	PastCycle3Screen	src/screens/onboarding/PastCycleScreen.tsx	Past cycle 3 (reused component)	✅ Done
13	CompleteScreen	src/screens/onboarding/CompleteScreen.tsx	Celebration animation, "Go to Dashboard"	✅ Done
📱 Main App (Authenticated)
Bottom Tab: Home
#	Screen Name	File	Description	Status
14	HomeDashboardScreen	src/screens/home/HomeDashboardScreen.tsx	Bento grid dashboard: Hero Profile, Next Period, Cycle Card, Mood Card, AI Snapshot, Chat, Videos, Analytics	✅ Done
15	VideoLibraryScreen	src/screens/home/VideoLibraryScreen.tsx	Educational videos library	🔷 Mock data
Bottom Tab: Calendar
#	Screen Name	File	Description	Status
16	CalendarScreen	src/screens/calendar/CalendarScreen.tsx	Monthly calendar with 4-phase color coding, day details bottom sheet	✅ Done
17	MenstrualPhasesScreen	src/screens/cycle/MenstrualPhasesScreen.tsx	Horizontal swipeable cards for 4 phases (Menstrual, Follicular, Ovulation, Luteal)	✅ Done
18	CycleDashboardScreen	src/screens/cycle/CycleDashboardScreen.tsx	Cycle dashboard with prediction detail, sticky card, countdown, mini calendar	✅ Done
19	LogPeriodScreen	src/screens/cycle/LogPeriodScreen.tsx	Form: start date, end date, flow, symptoms, mood, energy, notes	✅ Done
20	CycleHistoryScreen	src/screens/cycle/CycleHistoryScreen.tsx	FlatList of past cycles sorted by date	✅ Done
21	CyclePredictionsScreen	src/screens/cycle/CyclePredictionsScreen.tsx	Prediction detail + history comparison table (Mint/Peach/Blush)	✅ Done
22	CycleAnalyticsScreen	src/screens/cycle/CycleAnalyticsScreen.tsx	Average cycle length, symptoms bar chart, moods bar chart	🔷 Mock data
Bottom Tab: Wellness
#	Screen Name	File	Description	Status
23	WellnessHomeScreen	src/screens/wellness/WellnessHomeScreen.tsx	Wellness dashboard: Journal, Mood, Breathing, Insights	🔷 Mock data
24	JournalListScreen	src/screens/wellness/JournalListScreen.tsx	List of journal entries	✅ Done
25	JournalEntryScreen	src/screens/wellness/JournalEntryScreen.tsx	Write/edit journal with mood, symptoms, sentiment analysis	✅ Done
26	MoodLogScreen	src/screens/wellness/MoodLogScreen.tsx	Log mood with intensity slider	✅ Done
27	MoodHistoryScreen	src/screens/wellness/MoodHistoryScreen.tsx	History of mood logs	✅ Done
28	BreathingListScreen	src/screens/wellness/BreathingListScreen.tsx	List of breathing exercises	✅ Done
29	InsightsScreen	src/screens/wellness/InsightsScreen.tsx	AI insights, recommendations, quotes	🔷 Mock data
Bottom Tab: Health Hub (Luna DLC)
#	Screen Name	File	Description	Status
30	HealthHubScreen	src/screens/companion/HealthHubScreen.tsx	Health metrics dashboard: Sleep, Food, Water, Exercise, Medication	🚧 Phase 2
31	LunaInstallScreen	src/screens/companion/LunaInstallScreen.tsx	Feature store: Download Luna (~4.5 MB) with progress	🚧 Phase 2
Bottom Tab: Profile
#	Screen Name	File	Description	Status
32	ProfileHomeScreen	src/screens/profile/ProfileHomeScreen.tsx	Profile home: Avatar, name, email, quick stats	🔷 Placeholder
33	EditProfileScreen	src/screens/profile/EditProfileScreen.tsx	Edit display name, email, password	✅ Done
34	ChangePasswordScreen	src/screens/profile/ChangePasswordScreen.tsx	Change password form	✅ Done
35	SettingsScreen	src/screens/profile/SettingsScreen.tsx	Settings with Luna toggles, logout	✅ Done
36	LinkedFamilyScreen	src/screens/profile/LinkedFamilyScreen.tsx	Family member links	🔷 Mock data
Safety Stack (Inside Profile or Main)
#	Screen Name	File	Description	Status
37	SafetyHomeScreen	src/screens/safety/SafetyHomeScreen.tsx	Safety dashboard: SOS button, emergency contacts	✅ Done
38	EmergencyContactsScreen	src/screens/safety/EmergencyContactsScreen.tsx	List of emergency contacts	✅ Done
39	EmergencyContactEditScreen	src/screens/safety/EmergencyContactEditScreen.tsx	Add/edit emergency contact	✅ Done
40	SOSActiveScreen	src/screens/safety/SOSActiveScreen.tsx	SOS active state, countdown, resolve/cancel	✅ Done
41	SosHistoryScreen	src/screens/safety/SosHistoryScreen.tsx	History of SOS alerts	✅ Done
Pregnancy Stack (DLC)
#	Screen Name	File	Description	Status
42	PregnancyHomeScreen	src/screens/pregnancy/PregnancyHomeScreen.tsx	Pregnancy dashboard: due date, week counter	🔷 Placeholder
43	PregnancyProfileScreen	src/screens/pregnancy/PregnancyProfileScreen.tsx	Pregnancy profile: LMP, due date, weight tracking	🔷 Placeholder
44	PregnancyDailyLogScreen	src/screens/pregnancy/PregnancyDailyLogScreen.tsx	Daily pregnancy symptoms, kick counter, contraction timer	🔷 Placeholder
45	PregnancyMilestonesScreen	src/screens/pregnancy/PregnancyMilestonesScreen.tsx	Week-by-week milestones	🔷 Placeholder
46	PregnancyRecommendationsScreen	src/screens/pregnancy/PregnancyRecommendationsScreen.tsx	Health recommendations for pregnancy	🔷 Placeholder
Family Stack (DLC)
#	Screen Name	File	Description	Status
47	FamilyHomeScreen	src/screens/family/FamilyHomeScreen.tsx	Family dashboard: linked members, invites	🔷 Mock data
48	InviteFamilyScreen	src/screens/family/InviteFamilyScreen.tsx	Invite family members via email/phone	🔷 Mock data
AI Chat Stack (DLC)
#	Screen Name	File	Description	Status
49	ChatHomeScreen	src/screens/chat/ChatHomeScreen.tsx	List of chat conversations	🔷 Mock data
50	ChatRoomScreen	src/screens/chat/ChatRoomScreen.tsx	Chat room with AI assistant	🔷 Mock data
51	AIChatScreen	src/screens/chat/AIChatScreen.tsx	AI health assistant chat (deprecated for Phase 3)	🔷 Mock data
Nurse Content Stack (DLC)
#	Screen Name	File	Description	Status
52	ContentListScreen	src/screens/nurse_content/ContentListScreen.tsx	List of nurse-approved health content	🔷 Mock data
53	ContentDetailScreen	src/screens/nurse_content/ContentDetailScreen.tsx	Detailed view of health content	🔷 Mock data
Voice Journal (DLC)
#	Screen Name	File	Description	Status
54	VoiceJournalScreen	src/screens/voice/VoiceJournalScreen.tsx	Voice recording for journal entries	❌ Not implemented
55	VoiceHistoryScreen	src/screens/voice/VoiceHistoryScreen.tsx	History of voice journals	🔷 Mock data
Admin (Hidden)
#	Screen Name	File	Description	Status
56	AdminDashboardScreen	src/screens/admin/AdminDashboardScreen.tsx	Admin dashboard for content management	🔷 Mock data
57	UserManagementScreen	src/screens/admin/UserManagementScreen.tsx	User management for admins	🔷 Mock data
📊 Screen Count Summary
Category	Count	Status
Auth & Onboarding	13	✅ All done
Core Tabs (Home, Calendar, Wellness, Profile)	23	✅ 14 done, 9 in progress/mock
Safety	5	✅ All done
DLC (Pregnancy, Family, Chat, Nurse, Voice)	14	🔷 Mostly mock/placeholder
Health Hub (Luna)	2	🚧 Phase 2
Admin	2	🔷 Mock data
Total	59	