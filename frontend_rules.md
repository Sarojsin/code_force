SheCare React Native Frontend: Modern, Interactive, Smooth UI Rules
Follow these rules to build a production‑grade, delightful, and performant mobile app. Every rule focuses on user experience, code maintainability, and platform consistency.

1. Navigation & Screen Architecture
Rule 1.1 – Use React Navigation 7+ with a hybrid stack:

Bottom tabs for primary modules: Wellness, Cycle, Pregnancy, Safety, Profile.

Native stack for nested screens inside each tab (e.g., journal details, SOS history).

Authentication stack separate (unauthenticated only).

Rule 1.2 – Predefine navigation param types using TypeScript for compile‑time safety.

Rule 1.3 – Keep navigation state in a central store (Zustand / Redux Toolkit) only for deep linking and restoring state after app kill. Do not store transient UI state there.

Rule 1.4 – Use screens folder grouped by feature, mirroring backend modules:

text
src/screens/
├── auth/
├── cycle/
├── wellness/
├── pregnancy/
├── safety/
├── family/
├── profile/
└── chat/
2. State Management
Rule 2.1 – Use Zustand for global app state (authentication, user profile, feature flags). Lightweight, no boilerplate.

Rule 2.2 – Use React Query (TanStack Query) for all server‑state (fetching, caching, background updates). Never put API responses in Zustand.

Rule 2.3 – Use AsyncStorage (encrypted with react-native-encrypted-storage) for offline‑first data: user preferences, recent journal drafts, cached predictions.

Rule 2.4 – Local UI state (modal visibility, form inputs) stays inside component using useState or useReducer.

Rule 2.5 – Implement offline queue for actions (e.g., saving journal entry when offline). Sync when connection resumes.

3. Styling & Theming
Rule 3.1 – Use styled-components or NativeWind (Tailwind for RN) for consistent, maintainable styles. Choose one and stick.

Rule 3.2 – Design a design system in a central theme/ folder:

Colors (primary, secondary, success, danger, neutral palette)

Typography (font sizes, weights, line heights)

Spacing (4px grid: 4, 8, 12, 16, 24, 32, 48)

Border radius (sm=4, md=8, lg=12, xl=16)

Shadows (elevation for Android, shadow for iOS)

Rule 3.3 – Support light and dark mode natively. Use useColorScheme from React Native. All components must adapt without layout shifts.

Rule 3.4 – Avoid inline styles – extract to StyleSheet.create or styled components. Reuse theme values, never hardcode colors or spacing in components.

Rule 3.5 – Use semantic naming for colors, not literal (color.primary instead of color.blue500). Allows easy rebranding.

4. Component Design
Rule 4.1 – Build a shared component library in src/components/ui/:

Button (variants: primary, secondary, outline, danger)

Card, Input, Modal, BottomSheet, Toast, Loader, EmptyState

Calendar (customized for period tracking)

MoodPicker, SymptomGrid

Rule 4.2 – Every UI component must be reusable, accessible, and responsive (supports different screen sizes and orientations).

Rule 4.3 – Follow atomic design:

Atoms: Button, Text, Icon

Molecules: FormField with label + input + error

Organisms: PeriodLogCard, JournalEntryCard

Templates: Screen layout with header + content + footer

Rule 4.4 – Use React Native Paper or NativeBase as a baseline, but override styles to match custom design. Do not rely solely on third‑party components – you will lose control.

Rule 4.5 – Document components using Storybook for React Native (optional but valuable for large teams).

5. Animations & Interactions
Rule 5.1 – Use React Native Reanimated 3 for high‑performance, gesture‑driven animations. Avoid the old Animated API for complex interactions.

Rule 5.2 – Implement micro‑interactions that give feedback:

Button press scaling (scale to 0.96)

List item swipe actions (archive, delete)

Pull‑to‑refresh with haptic feedback

Tab switch with cross‑fade or slide

Rule 5.3 – Use LayoutAnimation (or Reanimated’s withSpring) for list insertions / deletions.

Rule 5.4 – Add skeleton loaders for every async data fetch (use react-native-skeleton-placeholder). Never show blank spaces.

Rule 5.5 – Use Lottie for complex animations (e.g., breathing exercise visual, pregnancy milestone confetti). Optimize by pre‑loading animations.

Rule 5.6 – Motion must respect reduced motion accessibility setting (useReducedMotion).

6. Performance Optimization
Rule 6.1 – Use FlatList (not ScrollView) for all lists longer than 5 items. Implement getItemLayout, initialNumToRender={7}, maxToRenderPerBatch={10}.

Rule 6.2 – Memoize components that receive frequent updates: React.memo, useMemo, useCallback. Avoid inline functions in render.

Rule 6.3 – Use Hermes engine (default for React Native 0.70+). Enable in production.

Rule 6.4 – Lazy load screens with React.lazy + Suspense for code splitting. Use @shopify/flash-list for extremely long lists (chat messages).

Rule 6.5 – Optimize images: use react-native-fast-image with caching, WebP format, and appropriate dimensions.

Rule 6.6 – Avoid unnecessary re‑renders by keeping state as local as possible. Use Redux DevTools to detect re‑render issues.

Rule 6.7 – Profile with Flipper and React DevTools before each release.

7. Gestures & Sensors
Rule 7.1 – Use react-native-gesture-handler for all custom gestures (swipe to dismiss, double‑tap SOS, pinch to zoom on charts).

Rule 7.2 – Implement double‑click power button for SOS using react-native-power-button or a library that detects hardware button events. Fallback: long press on a floating action button.

Rule 7.3 – Access device sensors only when needed (GPS for SOS after user permission). Request permissions at the moment of use, not at app start.

Rule 7.4 – For breathing exercises, use Device motion (vibration) to guide inhale/exhale cycles (light vibration at start of each phase).

8. Forms & User Input
Rule 8.1 – Use react-hook-form with zod validation for all forms (period logging, journal entry, profile edit). Reduces boilerplate and improves performance.

Rule 8.2 – Implement auto‑save for journal entries (save draft to AsyncStorage every 30 seconds). Show “Draft saved” toast.

Rule 8.3 – Use keyboard avoiding view for forms that include text inputs. Scroll to focused input automatically.

Rule 8.4 – All date pickers must be native (iOS: @react-native-community/datetimepicker, Android: same). Use bottom sheet for period symptom selection (better UX on large screens).

Rule 8.5 – Validate inputs on both frontend and backend. Frontend validation gives instant feedback.

9. Error Handling & Feedback
Rule 9.1 – Use react-native-toast-message for non‑intrusive feedback (success, error, info). Position at bottom (iOS) or top (Android) per platform convention.

Rule 9.2 – For critical errors (e.g., SOS failed), show a modal with clear actions (retry, call emergency number manually).

Rule 9.3 – Implement a global error boundary that catches render errors and displays a friendly fallback screen with “Restart app” button.

Rule 9.4 – Log errors to Sentry (or similar) only after user consent.

10. Accessibility (a11y)
Rule 10.1 – All interactive elements must have accessibilityLabel, accessibilityRole, and accessibilityHint. Use react-native-a11y to test.

Rule 10.2 – Support dynamic type (iOS) and font scaling (Android). Use scale methods from react-native-size-matters for spacing, but allow text to scale with system settings.

Rule 10.3 – Ensure color contrast ratio >= 4.5:1 for normal text, 3:1 for large text. Use contrast-check during design.

Rule 10.4 – All touch targets must be at least 44x44 points (Apple HIG). Use minHeight and padding to enlarge.

Rule 10.5 – Announce important screen changes via accessibilityLiveRegion (e.g., “SOS activated”).

11. Offline & Network Resilience
Rule 11.1 – Cache API responses with react-query’s persistQueryClient + AsyncStorage. Show stale data while refetching in background.

Rule 11.2 – Detect network status using @react-native-community/netinfo. Show a offline banner when connection lost.

Rule 11.3 – Queue user actions (journal entries, mood logs) when offline. Sync when online, resolve conflicts using last‑write‑wins (timestamp).

Rule 11.4 – For SOS, try to send via API; if offline, store in local queue and keep retrying. Also send SMS directly via device’s SMS app as last resort.

12. Push Notifications
Rule 12.1 – Use react-native-push-notification (or Expo’s equivalent). Request permission after user logs in, not immediately on app open.

Rule 12.2 – Handle notifications when app is in foreground: show an in‑app toast (not a system banner).

Rule 12.3 – Deep link from notification to the relevant screen (e.g., SOS alert details, new message from partner).

Rule 12.4 – Implement notification channels (Android 8+) and critical alerts for SOS (iOS).

13. Theming & Branding
Rule 13.1 – Create a design token file in theme/tokens.json. Use it to generate theme objects for both styled‑components and CSS variables for web (if using React Native Web).

Rule 13.2 – Allow users to choose app icon variants (e.g., different colored icons for period/pregnancy mode). Use react-native-dynamic-app-icon (iOS only). On Android, provide multiple icons in build.

Rule 13.3 – Use custom fonts (e.g., Nunito, Inter) for better readability. Load them with react-native-asset and pre‑fetch.

Rule 13.4 – Implement splash screen that displays the logo while loading fonts and initial data. Use react-native-splash-screen or react-native-bootsplash.

14. Security & Data Privacy (Client Side)
Rule 14.1 – Store sensitive data (auth tokens, encryption keys) in expo-secure-store (Expo) or react-native-encrypted-storage (bare RN). Never use AsyncStorage for tokens.

Rule 14.2 – Implement biometric authentication (FaceID / Fingerprint) for accessing sensitive sections like health records or revealing medical notes.

Rule 14.3 – Clear app state from memory when backgrounded (for high‑sensitivity mode). Use AppState to detect background and wipe in‑memory stores.

Rule 14.4 – Never log sensitive data (journal content, GPS coordinates) to console, even in development.

15. Testing & Quality Assurance
Rule 15.1 – Write unit tests for utility functions, validation, and state management using Jest.

Rule 15.2 – Write component tests with React Native Testing Library (focus on user interactions, not implementation).

Rule 15.3 – Use Maestro or Detox for end‑to‑end tests: critical flows (login → log period → trigger SOS).

Rule 15.4 – Run tests on both iOS and Android simulators in CI.

16. Development Environment
Rule 16.1 – Use TypeScript strict mode. No any – define proper interfaces for all props and state.

Rule 16.2 – Use ESLint (with @react-native-community/eslint-config) and Prettier. Enforce with pre‑commit hook.

Rule 16.3 – Use absolute imports configured via babel-plugin-module-resolver. Example: import { Button } from 'src/components/ui/Button'.

Rule 16.4 – Use Fast Refresh effectively: keep state outside of module scope.

Rule 16.5 – Use React Native Debugger (standalone) for Redux/React Query inspection.

17. Build & Release
Rule 17.1 – Use CodePush (AppCenter) for over‑the‑air updates of JavaScript bundles (critical fixes only). Never bypass app store review for new features requiring permissions.

Rule 17.2 – Set minSdkVersion = 24 (Android 7+) and targetSdkVersion = 33. For iOS, deploy target iOS 14+.

Rule 17.3 – Reduce APK/IPA size:

Enable ProGuard for Android (strip debug symbols)

Use hermes-engine for bytecode

Compress images and remove unused fonts

Use app-bundle for Android

Rule 17.4 – Automate builds with Fastlane for App Store / Play Store submission. Include screenshots and metadata generation.

18. Code Organization (Folder Structure)
text
src/
├── app/
│   ├── App.tsx
│   └── providers.tsx          # Theme, QueryClient, Navigation container
├── screens/                   # Feature screens
│   ├── cycle/
│   │   ├── CycleDashboard.tsx
│   │   ├── LogPeriodScreen.tsx
│   │   └── CycleHistoryScreen.tsx
│   └── ...
├── components/
│   ├── ui/                    # shared UI
│   └── business/              # domain‑specific components (e.g., PeriodCalendar)
├── navigation/
│   ├── RootNavigator.tsx
│   ├── AuthStack.tsx
│   └── types.ts
├── stores/                    # Zustand stores
├── services/                  # API calls (React Query hooks)
├── hooks/                     # custom hooks
├── utils/                     # helpers, formatters, validators
├── constants/                 # static data (e.g., symptom list, moods)
├── theme/
├── types/                     # global TypeScript declarations
└── assets/                    # images, fonts, lottie files
19. Continuous Improvement
Rule 19.1 – Collect app performance metrics (time to interactive, frame drops) via Firebase Performance Monitoring.

Rule 19.2 – Monitor crash‑free rate – must be >99.5% before public release.

Rule 19.3 – Run user satisfaction surveys (in‑app) after key interactions. Use Net Promoter Score (NPS) for overall.

Rule 19.4 – Every two weeks, review the rules and update based on new React Native best practices.

Following these rules will make SheCare feel like a premium, native app – smooth, responsive, and delightful. The modular approach ensures new features (voice journal, hospital integration) fit seamlessly without breaking existing UI.